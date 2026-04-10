/**
 * Dana Kematian Workflow Service
 *
 * Business logic service for managing death benefit claim workflows
 */

import { supabase } from '@/lib/supabase';
import {
  DanaKematianStateMachine,
  DanaKematianStatus,
  ClaimValidation,
  TransitionResult,
  validateClaim,
  canTransition,
  calculateProcessingTime,
  isOverdue
} from './dana-kematian-state-machine';

// =====================================================
// TYPES & INTERFACES
// =====================================================

export interface WorkflowAction {
  action: string;
  actor_id: string;
  actor_name: string;
  actor_role: 'cabang' | 'pusat' | 'admin';
  actor_cabang?: string;
  catatan?: string;
  data?: any;
}

export interface TransitionOptions {
  notify_stakeholders?: boolean;
  require_approval?: boolean;
  skip_validation?: boolean;
}

export interface ClaimSummary {
  id: string;
  nama_anggota: string;
  status_proses: DanaKematianStatus;
  cabang_asal_melapor: string;
  tanggal_lapor_keluarga: string;
  besaran_dana_kematian: number;
  processing_days: number;
  is_overdue: boolean;
  required_actions: string[];
}

// =====================================================
// WORKFLOW SERVICE CLASS
// =====================================================

export class DanaKematianWorkflowService {
  /**
   * Create new death benefit claim
   */
  static async createClaim(
    data: any,
    actor: WorkflowAction
  ): Promise<{ success: boolean; claim?: any; error?: string }> {
    try {
      // Validate required fields
      const validation = validateClaim(data);
      if (!validation.is_valid && !validation.missing_documents.length) {
        return {
          success: false,
          error: `Validasi gagal: ${validation.errors.join(', ')}`
        };
      }

      // Determine initial status
      const initialStatus: DanaKematianStatus = validation.missing_documents.length > 0
        ? 'pending_dokumen'
        : 'dilaporkan';

      // Create claim record
      const { data: claim, error } = await supabase
        .from('dana_kematian')
        .insert({
          ...data,
          status_proses: initialStatus,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          data_perubahan: {
            actor: actor,
            created_at: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (error) throw error;

      // Log initial state
      await this.logTransition(
        claim.id,
        initialStatus,
        initialStatus,
        actor,
        'Klaim baru dibuat'
      );

      // Create document records if files uploaded
      if (validation.missing_documents.length === 0) {
        await this.createDocumentRecords(claim.id, data, actor);
      }

      return { success: true, claim };
    } catch (error) {
      console.error('Error creating claim:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Gagal membuat klaim'
      };
    }
  }

  /**
   * Transition claim to new state
   */
  static async transitionClaim(
    claimId: string,
    toStatus: DanaKematianStatus,
    action: WorkflowAction,
    options: TransitionOptions = {}
  ): Promise<TransitionResult> {
    try {
      // Get current claim
      const { data: claim, error: fetchError } = await supabase
        .from('dana_kematian')
        .select('*')
        .eq('id', claimId)
        .single();

      if (fetchError || !claim) {
        return {
          success: false,
          message: 'Klaim tidak ditemukan'
        };
      }

      // Check if transition is allowed
      const validation = canTransition(
        claim.status_proses,
        toStatus,
        action.actor_role,
        claim
      );

      if (!validation.success || !options.skip_validation) {
        return validation;
      }

      // Prepare update data based on new status
      const updateData: any = {
        status_proses: toStatus,
        updated_at: new Date().toISOString(),
        data_perubahan: {
          actor: action,
          previous_status: claim.status_proses,
          new_status: toStatus,
          timestamp: new Date().toISOString()
        }
      };

      // Add status-specific updates
      switch (toStatus) {
        case 'verifikasi_cabang':
          updateData.cabang_tanggal_awal_terima_berkas = action.data?.tanggal_terima || new Date().toISOString();
          updateData.cabang_petugas_verifikator = action.actor_name;
          updateData.cabang_status_kelengkapan = 'lengkap';
          break;

        case 'proses_pusat':
          updateData.pusat_tanggal_awal_terima = new Date().toISOString();
          updateData.pusat_petugas_validator = action.actor_name;
          break;

        case 'penyaluran':
          updateData.besaran_dana_kematian = action.data?.besaran_dana || 0;
          updateData.pusat_tanggal_validasi = new Date().toISOString();
          updateData.pusat_nomor_referensi = action.data?.no_referensi || this.generateReferenceNumber(claimId);
          updateData.pusat_petugas_approver = action.actor_name;
          break;

        case 'selesai':
          updateData.cabang_tanggal_serah_ke_ahli_waris = action.data?.tanggal_penyerahan || new Date().toISOString();
          updateData.cabang_tanggal_lapor_ke_pusat = new Date().toISOString();
          updateData.cabang_petugas_penyerah = action.actor_name;
          updateData.cabang_bukti_penyerahan = action.data?.bukti_penyerahan;
          break;

        case 'ditolak':
          updateData.alasan_penolakan = action.catatan || action.data?.alasan;
          break;

        case 'pending_dokumen':
          updateData.dokumen_kurang = action.data?.dokumen_kurang || [];
          break;
      }

      // Execute transition
      const { error: updateError } = await supabase
        .from('dana_kematian')
        .update(updateData)
        .eq('id', claimId);

      if (updateError) throw updateError;

      // Log transition
      await this.logTransition(
        claimId,
        claim.status_proses,
        toStatus,
        action,
        action.catatan || ''
      );

      // Audit log
      await this.auditLog(claimId, 'transition', action, claim, { ...updateData, status_proses: toStatus });

      // Trigger notifications if enabled
      if (options.notify_stakeholders) {
        await this.notifyStatusChange(claimId, claim.status_proses, toStatus, action);
      }

      return {
        success: true,
        new_status: toStatus,
        message: `Status berhasil diubah ke ${toStatus}`
      };
    } catch (error) {
      console.error('Error transitioning claim:', error);
      return {
        success: false,
        message: `Gagal mengubah status: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Calculate and set benefit amount
   */
  static async calculateBenefit(
    claimId: string,
    actor: WorkflowAction
  ): Promise<{ success: boolean; amount?: number; breakdown?: any; error?: string }> {
    try {
      // Get claim with member data
      const { data: claim, error: fetchError } = await supabase
        .from('dana_kematian')
        .select(`
          *,
          anggota (
            kategori_anggota,
            status_mps,
            tanggal_pensiun
          )
        `)
        .eq('id', claimId)
        .single();

      if (fetchError || !claim) {
        return { success: false, error: 'Klaim tidak ditemukan' };
      }

      // Calculate benefit based on rules
      const calculation = this.performBenefitCalculation(claim);

      // Save calculation record
      const { error: calcError } = await supabase
        .from('perhitungan_dana_kematian')
        .insert({
          dana_kematian_id: claimId,
          kategori_anggota: claim.anggota?.kategori_anggota || claim.status_anggota,
          masa_kerja_tahun: 0, // Would need to calculate from member data
          status_mps: claim.anggota?.status_mps || claim.status_mps,
          dasar_perhitungan: calculation.dasar,
          tambahan_keluarga: calculation.tambahan_keluarga,
          tambahan_mps: calculation.tambahan_mps,
          total_dana: calculation.total,
          rumus_perhitungan: calculation.rumus,
          detail_perhitungan: calculation.detail,
          dihitung_oleh: actor.actor_id,
          tanggal_perhitungan: new Date().toISOString()
        });

      if (calcError) throw calcError;

      // Update claim with benefit amount
      const { error: updateError } = await supabase
        .from('dana_kematian')
        .update({
          besaran_dana_kematian: calculation.total,
          updated_at: new Date().toISOString()
        })
        .eq('id', claimId);

      if (updateError) throw updateError;

      // Audit log
      await this.auditLog(claimId, 'calculate', actor, claim, calculation);

      return {
        success: true,
        amount: calculation.total,
        breakdown: calculation
      };
    } catch (error) {
      console.error('Error calculating benefit:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Gagal menghitung dana'
      };
    }
  }

  /**
   * Perform benefit calculation based on rules
   */
  private static performBenefitCalculation(claim: any): any {
    // Base amounts by category
    const baseAmounts: Record<string, number> = {
      'pegawai': 10000000,
      'istri': 7500000,
      'suami': 7500000,
      'anak': 5000000,
      'meninggal': 0
    };

    const category = claim.anggota?.kategori_anggota || claim.status_anggota;
    let dasar = baseAmounts[category] || 0;
    let tambahanKel = 0;
    let tambahanMPS = 0;

    // Add MPS bonus
    const mpsStatus = claim.anggota?.status_mps || claim.status_mps;
    if (mpsStatus === 'mps') {
      tambahanMPS = 2000000;
    }

    // Add family bonus based on heir status
    if (claim.status_ahli_waris === 'istri' || claim.status_ahli_waris === 'suami') {
      tambahanKel = 1000000;
    }

    const total = dasar + tambahanKel + tambahanMPS;

    return {
      dasar,
      tambahan_keluarga: tambahanKel,
      tambahan_mps: tambahanMPS,
      total,
      rumus: `${this.formatCurrency(dasar)} + ${this.formatCurrency(tambahanKel)} + ${this.formatCurrency(tambahanMPS)} = ${this.formatCurrency(total)}`,
      detail: {
        kategori: category,
        mps: mpsStatus,
        status_ahli_waris: claim.status_ahli_waris,
        breakdown: {
          dasar_perhitungan: dasar,
          bonus_keluarga: tambahanKel,
          bonus_mps: tambahanMPS
        }
      }
    };
  }

  /**
   * Upload document for claim
   */
  static async uploadDocument(
    claimId: string,
    documentData: {
      jenis_dokumen: string;
      nama_file: string;
      url_file: string;
      ukuran_file?: number;
      mime_type?: string;
    },
    actor: WorkflowAction
  ): Promise<{ success: boolean; document?: any; completeness?: any; error?: string }> {
    try {
      // Insert document record
      const { data: document, error: docError } = await supabase
        .from('dokumen_kematian')
        .insert({
          dana_kematian_id: claimId,
          jenis_dokumen: documentData.jenis_dokumen,
          nama_file: documentData.nama_file,
          url_file: documentData.url_file,
          ukuran_file: documentData.ukuran_file,
          mime_type: documentData.mime_type,
          diupload_oleh: actor.actor_id,
          tanggal_upload: new Date().toISOString(),
          status_verifikasi: 'pending'
        })
        .select()
        .single();

      if (docError) throw docError;

      // Check document completeness
      const completeness = await this.checkDocumentCompleteness(claimId);

      // Update claim if now complete
      if (completeness.is_complete) {
        await supabase
          .from('dana_kematian')
          .update({
            cabang_status_kelengkapan: 'lengkap',
            updated_at: new Date().toISOString()
          })
          .eq('id', claimId);
      }

      // Audit log
      await this.auditLog(claimId, 'document_upload', actor, { document }, document);

      return {
        success: true,
        document,
        completeness
      };
    } catch (error) {
      console.error('Error uploading document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Gagal upload dokumen'
      };
    }
  }

  /**
   * Verify document
   */
  static async verifyDocument(
    documentId: string,
    verification: {
      status: 'valid' | 'invalid' | 'perlu_perbaikan';
      catatan?: string;
    },
    actor: WorkflowAction
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('dokumen_kematian')
        .update({
          status_verifikasi: verification.status,
          catatan_verifikasi: verification.catatan,
          diverifikasi_oleh: actor.actor_id,
          tanggal_verifikasi: new Date().toISOString()
        })
        .eq('id', documentId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error verifying document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Gagal verifikasi dokumen'
      };
    }
  }

  /**
   * Get claim summary for dashboard
   */
  static async getClaimSummary(filters?: any): Promise<ClaimSummary[]> {
    try {
      let query = supabase
        .from('dana_kematian')
        .select('*')
        .is('deleted_at', null)
        .order('tanggal_lapor_keluarga', { ascending: false });

      // Apply filters
      if (filters?.status) {
        query = query.eq('status_proses', filters.status);
      }
      if (filters?.cabang) {
        query = query.eq('cabang_asal_melapor', filters.cabang);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data: claims, error } = await query;

      if (error) throw error;

      return (claims || []).map(claim => {
        const machine = new DanaKematianStateMachine(claim);
        const stateInfo = machine.getStateInfo();

        return {
          id: claim.id,
          nama_anggota: claim.nama_anggota,
          status_proses: claim.status_proses,
          cabang_asal_melapor: claim.cabang_asal_melapor,
          tanggal_lapor_keluarga: claim.tanggal_lapor_keluarga,
          besaran_dana_kematian: claim.besaran_dana_kematian || 0,
          processing_days: calculateProcessingTime(claim),
          is_overdue: isOverdue(claim),
          required_actions: stateInfo.required_actions
        };
      });
    } catch (error) {
      console.error('Error getting claim summary:', error);
      return [];
    }
  }

  // =====================================================
// PRIVATE HELPER METHODS
// =====================================================

  /**
   * Log state transition to history
   */
  private static async logTransition(
    claimId: string,
    fromStatus: DanaKematianStatus,
    toStatus: DanaKematianStatus,
    action: WorkflowAction,
    catatan: string
  ): Promise<void> {
    try {
      await supabase
        .from('riwayat_proses_dakem')
        .insert({
          dana_kematian_id: claimId,
          status_dari: fromStatus,
          status_ke: toStatus,
          actor_id: action.actor_id,
          actor_role: action.actor_role,
          actor_nama: action.actor_name,
          actor_cabang: action.actor_cabang,
          catatan: catatan,
          data_perubahan: action.data,
          timestamp: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error logging transition:', error);
    }
  }

  /**
   * Create audit log entry
   */
  private static async auditLog(
    claimId: string,
    actionType: string,
    actor: WorkflowAction,
    oldData?: any,
    newData?: any
  ): Promise<void> {
    try {
      await supabase
        .from('audit_dana_kematian')
        .insert({
          dana_kematian_id: claimId,
          action: actionType,
          actor_id: actor.actor_id,
          actor_role: actor.actor_role,
          actor_nama: actor.actor_name,
          old_data: oldData,
          new_data: newData,
          changes: {
            old: oldData,
            new: newData
          }
        });
    } catch (error) {
      console.error('Error creating audit log:', error);
    }
  }

  /**
   * Create initial document records
   */
  private static async createDocumentRecords(
    claimId: string,
    data: any,
    actor: WorkflowAction
  ): Promise<void> {
    const documentTypes = [
      { field: 'file_surat_kematian', jenis: 'surat_kematian' },
      { field: 'file_sk_pensiun', jenis: 'sk_pensiun' },
      { field: 'file_surat_pernyataan_ahli_waris', jenis: 'surat_ahli_waris' },
      { field: 'file_kartu_keluarga', jenis: 'kartu_keluarga' },
      { field: 'file_e_ktp', jenis: 'ktp_ahli_waris' },
      { field: 'file_surat_nikah', jenis: 'surat_nikah' },
      { field: 'file_buku_rekening', jenis: 'buku_rekening' },
      { field: 'file_surat_kuasa', jenis: 'surat_kuasa' }
    ];

    for (const docType of documentTypes) {
      if (data[docType.field]) {
        await supabase
          .from('dokumen_kematian')
          .insert({
            dana_kematian_id: claimId,
            jenis_dokumen: docType.jenis,
            nama_file: `${docType.jenis}_${claimId}`,
            url_file: data[docType.field],
            diupload_oleh: actor.actor_id,
            tanggal_upload: new Date().toISOString(),
            status_verifikasi: 'pending'
          });
      }
    }
  }

  /**
   * Check document completeness
   */
  private static async checkDocumentCompleteness(claimId: string): Promise<{
    is_complete: boolean;
    total_required: number;
    total_uploaded: number;
    missing: string[];
  }> {
    const requiredDocs = [
      'surat_kematian',
      'sk_pensiun',
      'surat_ahli_waris',
      'kartu_keluarga',
      'ktp_ahli_waris'
    ];

    const { data: documents } = await supabase
      .from('dokumen_kematian')
      .select('jenis_dokumen')
      .eq('dana_kematian_id', claimId)
      .is('deleted_at', null);

    const uploadedTypes = new Set(documents?.map(d => d.jenis_dokumen) || []);
    const missing = requiredDocs.filter(doc => !uploadedTypes.has(doc));

    return {
      is_complete: missing.length === 0,
      total_required: requiredDocs.length,
      total_uploaded: uploadedTypes.size,
      missing
    };
  }

  /**
   * Generate reference number
   */
  private static generateReferenceNumber(claimId: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `DK-${year}${month}-${claimId.slice(0, 8)}-${random}`;
  }

  /**
   * Notify status change (placeholder)
   */
  private static async notifyStatusChange(
    claimId: string,
    fromStatus: DanaKematianStatus,
    toStatus: DanaKematianStatus,
    action: WorkflowAction
  ): Promise<void> {
    // TODO: Implement notification logic
    console.log(`Notification: Claim ${claimId} status changed from ${fromStatus} to ${toStatus}`);
  }

  /**
   * Format currency for display
   */
  private static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }
}

// =====================================================
// EXPORT HELPERS
// =====================================================

export { DanaKematianStateMachine } from './dana-kematian-state-machine';
