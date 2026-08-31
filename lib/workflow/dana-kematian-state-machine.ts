/**
 * Dana Kematian State Machine
 *
 * Manages status transitions and validation rules for death benefit claims
 */

import { getStatusProps } from './dana-kematian-status';

// =====================================================
// TYPES & INTERFACES
// =====================================================

export type DanaKematianStatus =
  | 'draft'
  | 'dilaporkan'
  | 'pending_dokumen'
  | 'verifikasi_cabang'
  | 'revisi_pusat'
  | 'proses_pusat'
  | 'verified'
  | 'batal'
  | 'penyaluran'
  | 'terima_ahli_waris'
  | 'laporan'
  | 'selesai'
  | 'ditolak';

export type UserRole = 'cabang' | 'pusat' | 'admin' | 'system';

export interface StateTransition {
  from: DanaKematianStatus;
  to: DanaKematianStatus;
  allowed_roles: UserRole[];
  condition?: (claim: any) => boolean;
  action?: (claim: any, actor: any, data?: any) => Promise<void>;
  requires_approval?: boolean;
  description: string;
}

export interface TransitionResult {
  success: boolean;
  new_status?: DanaKematianStatus;
  message: string;
  required_actions?: string[];
  validation_errors?: string[];
}

export interface ClaimValidation {
  is_valid: boolean;
  can_proceed: boolean;
  missing_documents: string[];
  errors: string[];
  warnings: string[];
}

// =====================================================
// STATE TRANSITIONS CONFIGURATION
// =====================================================

export const STATE_TRANSITIONS: StateTransition[] = [
  // Draft: complete berkas submitted to PP (Berkas Lengkap)
  {
    from: 'draft',
    to: 'proses_pusat',
    allowed_roles: ['cabang', 'admin'],
    description: 'Berkas lengkap dikirim ke Pusat untuk verifikasi (Berkas Lengkap)',
    condition: (claim) => areDocumentsComplete(claim)
  },

  // Draft can be canceled while incomplete
  {
    from: 'draft',
    to: 'batal',
    allowed_roles: ['cabang', 'admin'],
    description: 'Pengajuan draft dibatalkan oleh cabang'
  },

  // Legacy Phase A to B: Death Report to PC Validation
  {
    from: 'dilaporkan',
    to: 'verifikasi_cabang',
    allowed_roles: ['cabang', 'admin'],
    description: 'PC starts active validation and communication with heir (Waktu-0 → Waktu-1)',
    condition: (claim) => {
      return claim.komunikasi_status === 'completed' &&
             claim.nama_ahli_waris !== null &&
             claim.no_hp_ahli_waris !== null;
    }
  },

  // Legacy: complete documents submitted to PP
  {
    from: 'verifikasi_cabang',
    to: 'proses_pusat',
    allowed_roles: ['cabang', 'admin'],
    description: 'Complete application submitted to PP (Berkas-2 at Waktu-2)',
    condition: (claim) => {
      return areDocumentsComplete(claim) &&
             claim.cabang_tanggal_kirim_ke_pusat !== null &&
             claim.is_validated_pc === true;
    }
  },

  // Legacy: From pending_dokumen to proses_pusat (resubmit after koreksi)
  {
    from: 'pending_dokumen',
    to: 'proses_pusat',
    allowed_roles: ['cabang', 'admin'],
    description: 'Final documents received and submitted to PP (Berkas-2 at Waktu-2)',
    condition: (claim) => {
      return areDocumentsComplete(claim) &&
             claim.cabang_tanggal_kirim_ke_pusat !== null &&
             claim.is_validated_pc === true;
    }
  },

  {
    from: 'revisi_pusat',
    to: 'proses_pusat',
    allowed_roles: ['cabang', 'admin'],
    description: 'Revised documents resubmitted to PP',
    condition: (claim) => areDocumentsComplete(claim)
  },

  // Phase D: PP validation
  {
    from: 'proses_pusat',
    to: 'verified',
    allowed_roles: ['pusat', 'admin'],
    description: 'PP validation completed successfully (Waktu-3)',
    condition: (claim) => {
      return claim.pusat_tanggal_validasi !== null &&
             claim.is_validated_pp === true &&
             claim.besaran_dana_kematian > 0;
    }
  },

  // Return to PC for corrections (Koreksi)
  {
    from: 'proses_pusat',
    to: 'pending_dokumen',
    allowed_roles: ['pusat', 'admin'],
    description: 'PP returned application to PC for corrections',
    requires_approval: false
  },

  // Reject application
  {
    from: 'proses_pusat',
    to: 'ditolak',
    allowed_roles: ['pusat', 'admin'],
    description: 'Application rejected due to eligibility or fraud',
    requires_approval: true
  },

  // PP or PC can cancel a not-yet-distributed submission
  {
    from: 'proses_pusat',
    to: 'batal',
    allowed_roles: ['cabang', 'pusat', 'admin'],
    description: 'Pengajuan dibatalkan sebelum penyaluran'
  },

  // Phase E: Approval to fund transfer
  {
    from: 'verified',
    to: 'penyaluran',
    allowed_roles: ['pusat', 'admin'],
    description: 'Approved and funds transferred to PC (Waktu-4 → Waktu-5)',
    condition: (claim) => {
      return claim.is_approved === true &&
             claim.pusat_tanggal_selesai !== null &&
             claim.is_funds_transferred === true &&
             claim.tanggal_transfer_dana !== null;
    }
  },

  // Reject from verified stage
  {
    from: 'verified',
    to: 'ditolak',
    allowed_roles: ['pusat', 'admin'],
    description: 'Application rejected at approval stage',
    requires_approval: true
  },

  // Phase F1: Fund delivery to heir (requires handover documentation)
  {
    from: 'penyaluran',
    to: 'terima_ahli_waris',
    allowed_roles: ['cabang', 'admin'],
    description: 'Dana diserahkan ke ahli waris dengan berkas serah terima (Waktu-6)',
    condition: (claim) => {
      return claim.is_delivered === true &&
             claim.cabang_tanggal_serah_ke_ahli_waris !== null &&
             claim.file_bukti_penyerahan !== null;
    }
  },

  // Phase F2: Branch report uploaded (Archive Management integration)
  {
    from: 'terima_ahli_waris',
    to: 'laporan',
    allowed_roles: ['cabang', 'admin'],
    description: 'Laporan cabang diupload ke modul Arsip (Waktu-7)',
    condition: (claim) => {
      return !!getClaimMetadata(claim).file_laporan_cabang;
    }
  },

  // Phase F3: Final completion
  {
    from: 'laporan',
    to: 'selesai',
    allowed_roles: ['cabang', 'pusat', 'admin'],
    description: 'Semua laporan lengkap, pengajuan selesai (Waktu-7)',
    condition: (claim) => claim.cabang_tanggal_lapor_ke_pusat !== null
  },

  // Legacy: direct delivery completion (old rows may still use this path)
  {
    from: 'penyaluran',
    to: 'selesai',
    allowed_roles: ['cabang', 'admin'],
    description: 'Funds delivered to heir and all reports submitted (legacy direct path)',
    condition: (claim) => {
      return claim.is_delivered === true &&
             claim.cabang_tanggal_serah_ke_ahli_waris !== null &&
             claim.file_bukti_penyerahan !== null &&
             claim.is_reported === true &&
             claim.cabang_tanggal_lapor_ke_pusat !== null;
    }
  },

  // Reject from delivery stage
  {
    from: 'penyaluran',
    to: 'ditolak',
    allowed_roles: ['pusat', 'admin'],
    description: 'Application rejected during delivery phase',
    requires_approval: true
  },

  // Allow resubmission after rejection
  {
    from: 'ditolak',
    to: 'dilaporkan',
    allowed_roles: ['admin'],
    description: 'Application resubmitted after rejection with new documents',
    requires_approval: true,
    condition: (claim) => {
      return claim.can_resubmit === true &&
             claim.resubmission_deadline !== null &&
             new Date(claim.resubmission_deadline) > new Date();
    }
  }
];

// =====================================================
// VALIDATION FUNCTIONS
// =====================================================

/**
 * Read document_metadata regardless of whether it arrives parsed (Supabase)
 * or as a JSON string.
 */
export function getClaimMetadata(claim: any): Record<string, any> {
  const raw = claim?.document_metadata;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

function hasFile(value: any): boolean {
  return value !== null && value !== undefined && value !== '';
}

/**
 * Check if the 6 mandatory documents (UAT 2026) are present.
 * SK Pensiun may be substituted by the lost-document statement
 * (document_metadata.sk_pensiun_missing + formal explanation).
 */
export function areDocumentsComplete(claim: any): boolean {
  const meta = getClaimMetadata(claim);

  const skPensiunOk =
    hasFile(claim.file_sk_pensiun) ||
    (meta.sk_pensiun_missing === true && !!meta.sk_pensiun_hilang_keterangan);

  // Surat Nikah is conditional: file OR keterangan (remarks) when missing
  const suratNikahOk = hasFile(claim.file_surat_nikah) || !!meta.surat_nikah_keterangan;

  return (
    skPensiunOk &&
    hasFile(claim.file_surat_kematian) && !!meta.akte_kematian_sumber &&
    hasFile(claim.file_surat_pernyataan_ahli_waris) &&
    hasFile(claim.file_kartu_keluarga) && meta.kk_ahli_waris_konfirmasi === true &&
    hasFile(claim.file_e_ktp) &&
    hasFile(claim.file_surat_keterangan) &&
    suratNikahOk
  );
}

/**
 * Validate claim completeness
 */
export function validateClaim(claim: any): ClaimValidation {
  const validation: ClaimValidation = {
    is_valid: true,
    can_proceed: true,
    missing_documents: [],
    errors: [],
    warnings: []
  };

  // Check required fields
  if (!claim.nama_anggota) {
    validation.errors.push('Nama anggota wajib diisi');
    validation.is_valid = false;
  }

  if (!claim.tanggal_meninggal) {
    validation.errors.push('Tanggal meninggal wajib diisi');
    validation.is_valid = false;
  }

  if (!claim.nama_ahli_waris) {
    validation.errors.push('Nama ahli waris wajib diisi');
    validation.is_valid = false;
  }

  // Check documents
  const meta = getClaimMetadata(claim);
  const requiredDocs: Array<{ field: string; name: string; ok: boolean }> = [
    {
      field: 'file_sk_pensiun',
      name: 'SK Pensiun',
      ok: hasFile(claim.file_sk_pensiun) ||
          (meta.sk_pensiun_missing === true && !!meta.sk_pensiun_hilang_keterangan),
    },
    {
      field: 'file_surat_kematian',
      name: 'Akte Kematian',
      ok: hasFile(claim.file_surat_kematian) && !!meta.akte_kematian_sumber,
    },
    {
      field: 'file_surat_pernyataan_ahli_waris',
      name: 'Surat Keterangan / Kuasa Ahli Waris',
      ok: hasFile(claim.file_surat_pernyataan_ahli_waris),
    },
    {
      field: 'file_kartu_keluarga',
      name: 'Kartu Keluarga Ahli Waris',
      ok: hasFile(claim.file_kartu_keluarga) && meta.kk_ahli_waris_konfirmasi === true,
    },
    {
      field: 'file_e_ktp',
      name: 'E-KTP Ahli Waris',
      ok: hasFile(claim.file_e_ktp),
    },
    {
      field: 'file_surat_keterangan',
      name: 'Surat Permohonan',
      ok: hasFile(claim.file_surat_keterangan),
    },
    {
      field: 'file_surat_nikah',
      name: 'Surat Nikah / Keterangan',
      ok: hasFile(claim.file_surat_nikah) || !!meta.surat_nikah_keterangan,
    },
  ];

  requiredDocs.forEach(doc => {
    if (!doc.ok) {
      validation.missing_documents.push(doc.name);
    }
  });

  if (validation.missing_documents.length > 0) {
    validation.can_proceed = false;
    validation.warnings.push('Dokumen belum lengkap');
  }

  // Check heir eligibility
  if (!claim.status_ahli_waris) {
    validation.warnings.push('Status hubungan ahli waris belum ditentukan');
  }

  return validation;
}

/**
 * Check if user has permission to perform transition
 */
export function hasPermission(
  transition: StateTransition,
  userRole: UserRole
): boolean {
  return transition.allowed_roles.includes(userRole) || userRole === 'admin';
}

/**
 * Get valid next states for a claim
 */
export function getNextStates(
  currentStatus: DanaKematianStatus,
  userRole: UserRole
): DanaKematianStatus[] {
  return STATE_TRANSITIONS
    .filter(t => t.from === currentStatus)
    .filter(t => hasPermission(t, userRole))
    .map(t => t.to);
}

/**
 * Get transition details between two states
 */
export function getTransition(
  from: DanaKematianStatus,
  to: DanaKematianStatus
): StateTransition | undefined {
  return STATE_TRANSITIONS.find(t => t.from === from && t.to === to);
}

/**
 * Validate if transition is allowed
 */
export function canTransition(
  from: DanaKematianStatus,
  to: DanaKematianStatus,
  userRole: UserRole,
  claim?: any
): TransitionResult {
  const transition = getTransition(from, to);

  if (!transition) {
    return {
      success: false,
      message: `Transisi dari ${from} ke ${to} tidak tersedia`
    };
  }

  if (!hasPermission(transition, userRole)) {
    return {
      success: false,
      message: `User dengan role ${userRole} tidak memiliki izin untuk transisi ini`
    };
  }

  if (transition.condition && claim) {
    try {
      const conditionMet = transition.condition(claim);
      if (!conditionMet) {
        return {
          success: false,
          message: 'Syarat transisi belum terpenuhi',
          validation_errors: getConditionErrors(transition, claim)
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Error saat memvalidasi syarat transisi',
        validation_errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  return {
    success: true,
    new_status: to,
    message: transition.description
  };
}

/**
 * Get specific error messages for failed conditions
 */
function getConditionErrors(transition: StateTransition, claim: any): string[] {
  const errors: string[] = [];

  switch (transition.to) {
    case 'proses_pusat':
      if (!areDocumentsComplete(claim)) {
        errors.push('Dokumen wajib belum lengkap');
      }
      if (claim.status_proses !== 'draft' && !claim.cabang_tanggal_kirim_ke_pusat) {
        errors.push('Tanggal kirim ke pusat belum diisi');
      }
      break;

    case 'penyaluran':
      if (!claim.besaran_dana_kematian || claim.besaran_dana_kematian <= 0) {
        errors.push('Besaran dana kematian belum ditentukan');
      }
      if (!claim.pusat_tanggal_validasi) {
        errors.push('Tanggal validasi pusat belum diisi');
      }
      break;

    case 'terima_ahli_waris':
      if (!claim.cabang_tanggal_serah_ke_ahli_waris) {
        errors.push('Tanggal penyerahan ke ahli waris belum diisi');
      }
      if (!claim.file_bukti_penyerahan) {
        errors.push('Berkas serah terima (bukti penyerahan) belum diupload');
      }
      break;

    case 'laporan':
      if (!getClaimMetadata(claim).file_laporan_cabang) {
        errors.push('Laporan cabang belum diupload');
      }
      break;

    case 'selesai':
      if (!claim.cabang_tanggal_serah_ke_ahli_waris) {
        errors.push('Tanggal penyerahan ke ahli waris belum diisi');
      }
      if (!claim.cabang_tanggal_lapor_ke_pusat) {
        errors.push('Tanggal lapor ke pusat belum diisi');
      }
      if (!claim.file_bukti_penyerahan) {
        errors.push('Bukti penyerahan belum diupload');
      }
      break;
  }

  return errors;
}

// =====================================================
// STATE MACHINE CLASS
// =====================================================

export class DanaKematianStateMachine {
  private claim: any;
  private currentStatus: DanaKematianStatus;

  constructor(claim: any) {
    this.claim = claim;
    this.currentStatus = claim.status_proses || 'draft';
  }

  /**
   * Get current state
   */
  getCurrentState(): DanaKematianStatus {
    return this.currentStatus;
  }

  /**
   * Get all possible next states
   */
  getPossibleNextStates(userRole: UserRole): DanaKematianStatus[] {
    return getNextStates(this.currentStatus, userRole);
  }

  /**
   * Check if can transition to specific state
   */
  canTransitionTo(to: DanaKematianStatus, userRole: UserRole): TransitionResult {
    return canTransition(this.currentStatus, to, userRole, this.claim);
  }

  /**
   * Execute transition to new state
   */
  async transitionTo(
    to: DanaKematianStatus,
    actor: any,
    data?: any
  ): Promise<TransitionResult> {
    const userRole = actor.role || 'cabang';

    // Validate transition
    const validation = this.canTransitionTo(to, userRole);
    if (!validation.success) {
      return validation;
    }

    const transition = getTransition(this.currentStatus, to);
    if (!transition) {
      return {
        success: false,
        message: 'Transisi tidak tersedia'
      };
    }

    // Execute transition action if defined
    try {
      if (transition.action) {
        await transition.action(this.claim, actor, data);
      }

      // Update claim status
      this.currentStatus = to;
      this.claim.status_proses = to;

      return {
        success: true,
        new_status: to,
        message: `Status berhasil diubah dari ${this.currentStatus} ke ${to}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Gagal melakukan transisi: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate current claim state
   */
  validate(): ClaimValidation {
    return validateClaim(this.claim);
  }

  /**
   * Get required actions for current state
   */
  getRequiredActions(): string[] {
    const actions: Record<DanaKematianStatus, string[]> = {
      'draft': [
        'Lengkapi data pengajuan dan ahli waris',
        'Upload 6 dokumen wajib',
        'Klik Berkas Lengkap untuk mengirim ke Verifikasi Pusat'
      ],
      'dilaporkan': [
        'Upload semua dokumen yang diperlukan',
        'Verifikasi kelengkapan dokumen',
        'Lengkapi data ahli waris'
      ],
      'revisi_pusat': [
        'Upload ulang dokumen yang ditolak oleh PP',
        'Klik Update Data setelah dokumen diupload'
      ],
      'pending_dokumen': [
        'Segera lengkapi dokumen yang kurang',
        'Hubungi ahli waris jika diperlukan'
      ],
      'verifikasi_cabang': [
        'Verifikasi keaslian dokumen',
        'Validasi data ahli waris',
        'Kirim berkas ke pusat jika lengkap'
      ],
      'proses_pusat': [
        'Validasi ulang kelengkapan dokumen',
        'Hitung besaran dana kematian',
        'Proses persetujuan dan transfer dana'
      ],
      'verified': [
        'Persiapkan penyaluran dana',
        'Jadwalkan penyerahan ke ahli waris'
      ],
      'batal': [
        'Pengajuan dibatalkan — data tetap tersimpan sebagai arsip'
      ],
      'penyaluran': [
        'Input tanggal penyerahan ke ahli waris',
        'Upload berkas serah terima (bukti penyerahan)',
        'Konfirmasi penyerahan dana ke ahli waris'
      ],
      'terima_ahli_waris': [
        'Upload laporan cabang',
        'Kirim laporan ke modul Arsip'
      ],
      'laporan': [
        'Pastikan tanggal lapor ke pusat terisi',
        'Selesaikan pengajuan'
      ],
      'selesai': [
        'Arsipkan berkas klaim',
        'Buat laporan penyelesaian'
      ],
      'ditolak': [
        'Informasikan alasan penolakan',
        'Jika dapat diajukan ulang, siapkan dokumen perbaikan'
      ]
    };

    return actions[this.currentStatus] || [];
  }

  /**
   * Get state information
   */
  getStateInfo(): {
    current: DanaKematianStatus;
    can_proceed: boolean;
    next_states: DanaKematianStatus[];
    required_actions: string[];
    validation: ClaimValidation;
  } {
    return {
      current: this.currentStatus,
      can_proceed: this.validate().can_proceed,
      next_states: this.getPossibleNextStates('cabang'),
      required_actions: this.getRequiredActions(),
      validation: this.validate()
    };
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get state label for display (delegates to the central status config)
 */
export function getStateLabel(status: DanaKematianStatus): string {
  return getStatusProps(status).label;
}

/**
 * Get state description for tooltip/help
 */
export function getStateDescription(status: DanaKematianStatus): string {
  const descriptions: Record<DanaKematianStatus, string> = {
    'draft': 'Formulir pengajuan belum dikirim (sedang diproses)',
    'dilaporkan': 'Laporan kematian telah diterima (Waktu-0)',
    'pending_dokumen': 'PP mengembalikan berkas untuk dikoreksi',
    'verifikasi_cabang': 'PC melakukan validasi dan komunikasi aktif dengan ahli waris',
    'revisi_pusat': 'PP menolak dokumen, cabang perlu upload ulang dan kirim kembali',
    'proses_pusat': 'Berkas sedang diverifikasi oleh PP (Waktu-2 → Waktu-3)',
    'verified': 'Valid — terverifikasi oleh PP, menunggu penyaluran dana',
    'batal': 'Pengajuan dibatalkan (data tetap tersimpan)',
    'penyaluran': 'Dana disetujui PP, menunggu penyerahan ke ahli waris',
    'terima_ahli_waris': 'Dana telah diterima ahli waris — berkas serah terima dikirim ke modul Keuangan',
    'laporan': 'Laporan cabang diupload ke modul Manajemen Arsip',
    'selesai': 'Dana telah diserahkan dan semua laporan lengkap (Waktu-7)',
    'ditolak': 'Pengajuan ditolak'
  };
  return descriptions[status] || status;
}

/**
 * Get state color for UI
 */
export function getStateColor(status: DanaKematianStatus): string {
  const colors: Record<DanaKematianStatus, string> = {
    'draft': 'gray',
    'dilaporkan': 'blue',
    'pending_dokumen': 'red',
    'verifikasi_cabang': 'cyan',
    'revisi_pusat': 'red',
    'proses_pusat': 'purple',
    'verified': 'indigo',
    'batal': 'red',
    'penyaluran': 'orange',
    'terima_ahli_waris': 'amber',
    'laporan': 'amber',
    'selesai': 'green',
    'ditolak': 'red'
  };
  return colors[status] || 'gray';
}

/**
 * Get state badge variant (delegates to the central status config)
 */
export function getStateBadgeVariant(status: DanaKematianStatus): 'success' | 'warning' | 'destructive' | 'secondary' {
  return getStatusProps(status).variant;
}

/**
 * Get current phase based on status
 */
export function getCurrentPhase(status: DanaKematianStatus): string {
  const phaseMap: Record<DanaKematianStatus, string> = {
    'draft': 'A. Draft Pengajuan',
    'dilaporkan': 'A. Draft Pengajuan',
    'verifikasi_cabang': 'A. Draft Pengajuan',
    'pending_dokumen': 'B. Koreksi Berkas',
    'revisi_pusat': 'B. Koreksi Berkas',
    'proses_pusat': 'C. Verifikasi Pusat',
    'verified': 'D. Validasi Selesai',
    'batal': 'Batal',
    'penyaluran': 'E. Penyaluran Dana',
    'terima_ahli_waris': 'F. Terima Ahli Waris',
    'laporan': 'G. Laporan',
    'selesai': 'Selesai',
    'ditolak': 'Ditolak'
  };
  return phaseMap[status] || 'Unknown';
}

/**
 * Get next expected waktu based on current status
 */
export function getNextWaktu(status: DanaKematianStatus): string {
  const nextWaktu: Record<DanaKematianStatus, string> = {
    'draft': 'Waktu-2 (Pengiriman ke PP)',
    'dilaporkan': 'Waktu-1 (Initial Documents)',
    'verifikasi_cabang': 'Waktu-1 (Initial Documents)',
    'pending_dokumen': 'Waktu-2 (Final Documents)',
    'revisi_pusat': 'Waktu-2 (Revised Documents)',
    'proses_pusat': 'Waktu-3 (PP Validation)',
    'verified': 'Waktu-4 (Processing Complete)',
    'batal': 'N/A',
    'penyaluran': 'Waktu-6 (Delivery to Heir)',
    'terima_ahli_waris': 'Waktu-7 (Branch Report)',
    'laporan': 'Waktu-7 (Completion)',
    'selesai': 'Complete',
    'ditolak': 'N/A'
  };
  return nextWaktu[status] || 'Unknown';
}

/**
 * Check if status allows communication tracking
 */
export function allowsCommunicationTracking(status: DanaKematianStatus): boolean {
  return ['draft', 'dilaporkan', 'verifikasi_cabang'].includes(status);
}

/**
 * Check if status allows document upload
 */
export function allowsDocumentUpload(status: DanaKematianStatus): boolean {
  return ['draft', 'dilaporkan', 'verifikasi_cabang', 'pending_dokumen', 'revisi_pusat'].includes(status);
}

/**
 * Check if status allows PP actions
 */
export function allowsPPActions(status: DanaKematianStatus): boolean {
  return ['proses_pusat', 'verified'].includes(status);
}

/**
 * Check if status allows delivery actions
 */
export function allowsDeliveryActions(status: DanaKematianStatus): boolean {
  return ['penyaluran'].includes(status);
}

/**
 * Check if status allows reporting
 */
export function allowsReporting(status: DanaKematianStatus): boolean {
  return ['penyaluran', 'terima_ahli_waris', 'laporan', 'selesai'].includes(status);
}

/**
 * Calculate processing time in days
 */
export function calculateProcessingTime(claim: any): number {
  if (!claim.tanggal_lapor_keluarga) {
    return 0;
  }

  const startDate = new Date(claim.tanggal_lapor_keluarga);
  const endDate = claim.cabang_tanggal_lapor_ke_pusat
    ? new Date(claim.cabang_tanggal_lapor_ke_pusat)
    : new Date();

  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Check if claim is overdue
 */
export function isOverdue(claim: any, maxDays: number = 30): boolean {
  const processingDays = calculateProcessingTime(claim);
  return !['selesai', 'ditolak', 'batal'].includes(claim.status_proses) &&
         processingDays > maxDays;
}

/**
 * Get timeline progress percentage
 */
export function getTimelineProgress(claim: any): number {
  if (!claim.waktu_0) return 0;

  const waktuFields = ['waktu_0', 'waktu_1', 'waktu_2', 'waktu_3', 'waktu_4', 'waktu_5', 'waktu_6', 'waktu_7'];
  let completedWaktu = 0;

  for (const field of waktuFields) {
    if (claim[field]) completedWaktu++;
  }

  return (completedWaktu / 8) * 100;
}

/**
 * Get current stage information
 */
export function getCurrentStageInfo(claim: any): {
  stage: string;
  description: string;
  waktu: string;
  percentComplete: number;
  nextStep: string;
} {
  const status = claim.status_proses;

  const stageInfo: Record<string, any> = {
    'draft': {
      stage: 'A. Draft Pengajuan',
      description: 'Formulir pengajuan sedang diisi / belum dikirim',
      waktu: 'Waktu-0 → Waktu-2',
      percentComplete: 8,
      nextStep: 'Lengkapi 6 dokumen wajib lalu klik Berkas Lengkap'
    },
    'dilaporkan': {
      stage: 'A. Draft Pengajuan',
      description: 'Laporan kematian telah diterima',
      waktu: 'Waktu-0',
      percentComplete: 12.5,
      nextStep: 'PC memulai validasi dan komunikasi dengan ahli waris'
    },
    'verifikasi_cabang': {
      stage: 'A. Draft Pengajuan',
      description: 'PC melakukan validasi aktif dan komunikasi dengan ahli waris',
      waktu: 'Waktu-0 → Waktu-1',
      percentComplete: 20,
      nextStep: 'Menerima dan memverifikasi dokumen dari ahli waris'
    },
    'pending_dokumen': {
      stage: 'B. Koreksi Berkas',
      description: 'PP mengembalikan berkas — lengkapi dokumen yang dikoreksi',
      waktu: 'Waktu-1',
      percentComplete: 37.5,
      nextStep: 'Perbaiki dokumen lalu kirim kembali ke PP'
    },
    'revisi_pusat': {
      stage: 'B. Koreksi Berkas',
      description: 'PP menolak satu atau lebih dokumen, cabang perlu mengupload ulang',
      waktu: 'Waktu-2',
      percentComplete: 40,
      nextStep: 'Upload ulang dokumen yang ditolak lalu klik Update Data'
    },
    'proses_pusat': {
      stage: 'C. Verifikasi Pusat',
      description: 'PP menerima dan memverifikasi kelengkapan dokumen',
      waktu: 'Waktu-2 → Waktu-3',
      percentComplete: 50,
      nextStep: 'Menunggu validasi dan persetujuan dari PP'
    },
    'verified': {
      stage: 'D. Validasi Selesai',
      description: 'Valid — terverifikasi oleh PP, siap disalurkan',
      waktu: 'Waktu-3 → Waktu-4',
      percentComplete: 62.5,
      nextStep: 'PP menyetujui dan menyalurkan dana ke cabang'
    },
    'batal': {
      stage: 'Batal',
      description: 'Pengajuan dibatalkan (data tetap tersimpan)',
      waktu: 'N/A',
      percentComplete: 0,
      nextStep: 'Buat pengajuan baru jika diperlukan'
    },
    'penyaluran': {
      stage: 'E. Penyaluran Dana',
      description: 'Dana disetujui PP, menunggu cabang menyerahkan ke ahli waris',
      waktu: 'Waktu-4 → Waktu-6',
      percentComplete: 75,
      nextStep: 'PC input tanggal penyerahan dan upload berkas serah terima'
    },
    'terima_ahli_waris': {
      stage: 'F. Terima Ahli Waris',
      description: 'Dana diterima ahli waris — berkas serah terima diteruskan ke modul Keuangan',
      waktu: 'Waktu-6 → Waktu-7',
      percentComplete: 87.5,
      nextStep: 'Upload laporan cabang ke modul Arsip'
    },
    'laporan': {
      stage: 'G. Laporan',
      description: 'Laporan cabang telah diupload — siap diselesaikan',
      waktu: 'Waktu-7',
      percentComplete: 95,
      nextStep: 'Selesaikan pengajuan'
    },
    'selesai': {
      stage: 'Selesai',
      description: 'Dana telah diserahkan dan semua laporan lengkap',
      waktu: 'Waktu-7',
      percentComplete: 100,
      nextStep: 'Proses selesai'
    },
    'ditolak': {
      stage: 'Ditolak',
      description: 'Pengajuan ditolak',
      waktu: 'N/A',
      percentComplete: 0,
      nextStep: 'Periksa alasan penolakan'
    }
  };

  return stageInfo[status] || stageInfo['draft'];
}

/**
 * Get timeline events for display
 */
export function getTimelineEvents(claim: any): Array<{
  waktu: string;
  label: string;
  date: string | null;
  description: string;
  completed: boolean;
}> {
  return [
    {
      waktu: 'waktu_0',
      label: 'Laporan Kematian',
      date: claim.waktu_0 || claim.created_at || claim.tanggal_lapor_keluarga,
      description: 'Laporan kematian diterima dan data pengajuan dibuat',
      completed: !!(claim.waktu_0 || claim.created_at || claim.tanggal_lapor_keluarga),
    },
    {
      waktu: 'waktu_1',
      label: 'Proses Pengurus Cabang',
      date: claim.waktu_1 || claim.cabang_tanggal_awal_terima_berkas,
      description: 'Pengurus cabang memproses berkas dari ahli waris',
      completed: !!(claim.waktu_1 || claim.cabang_tanggal_awal_terima_berkas),
    },
    {
      waktu: 'waktu_2',
      label: 'Pengiriman ke PP',
      date: claim.waktu_2 || claim.cabang_tanggal_kirim_ke_pusat,
      description: 'Berkas lengkap dikirim ke Pusat Pelayanan',
      completed: !!(claim.waktu_2 || claim.cabang_tanggal_kirim_ke_pusat),
    },
    {
      waktu: 'waktu_3',
      label: 'PP Terima Berkas PC',
      date: claim.waktu_3 || claim.pusat_tanggal_validasi,
      description: 'PP menerima dan memvalidasi berkas dari pengurus cabang',
      completed: !!claim.waktu_3,
    },
    {
      waktu: 'waktu_4',
      label: 'PP Setujui & Salurkan',
      date: claim.waktu_4 || claim.pusat_tanggal_validasi,
      description: 'PP menyetujui pengajuan dan dana siap disalurkan ke ahli waris',
      completed: !!claim.waktu_4,
    },
    {
      waktu: 'waktu_6',
      label: 'PC Serahkan Dana ke Ahli Waris',
      date: claim.waktu_6 || claim.cabang_tanggal_serah_ke_ahli_waris,
      description: 'Pengurus cabang menyerahkan dana kematian kepada ahli waris dan mengupload berkas serah terima (diteruskan ke modul Keuangan)',
      completed: !!(claim.waktu_6 || claim.cabang_tanggal_serah_ke_ahli_waris),
    },
    {
      waktu: 'laporan_cabang',
      label: 'PC Upload Laporan Cabang (Modul Arsip)',
      date: getClaimMetadata(claim).laporan_cabang_uploaded_at || null,
      description: 'PC mengupload laporan cabang ke modul Manajemen Arsip',
      completed: !!getClaimMetadata(claim).file_laporan_cabang,
    },
    {
      waktu: 'laporan_akhir',
      label: 'PC Upload Laporan Akhir Dakem Sesuai Periode Laporan',
      date: claim.cabang_tanggal_lapor_ke_pusat,
      description: 'PC mengupload laporan akhir dana kematian sesuai periode laporan',
      completed: claim.status_proses === 'selesai',
    },
  ];
}

/**
 * Calculate stage duration
 */
export function getStageDurationInfo(claim: any): {
  total: number;
  phases: {
    phaseA: number;
    phaseB: number;
    phaseC: number;
    phaseD: number;
    phaseE: number;
    phaseF: number;
  };
} {
  const result = {
    total: 0,
    phases: {
      phaseA: 0,
      phaseB: 0,
      phaseC: 0,
      phaseD: 0,
      phaseE: 0,
      phaseF: 0
    }
  };

  // Phase A: Waktu-0 only
  if (claim.waktu_0 && claim.waktu_1) {
    result.phases.phaseA = Math.ceil((new Date(claim.waktu_1).getTime() - new Date(claim.waktu_0).getTime()) / (1000 * 60 * 60 * 24));
  }

  // Phase B: Waktu-1 to Waktu-2
  if (claim.waktu_1 && claim.waktu_2) {
    result.phases.phaseB = Math.ceil((new Date(claim.waktu_2).getTime() - new Date(claim.waktu_1).getTime()) / (1000 * 60 * 60 * 24));
  }

  // Phase C: Part of Waktu-1 to Waktu-2
  if (claim.waktu_1 && claim.waktu_2) {
    result.phases.phaseC = Math.ceil((new Date(claim.waktu_2).getTime() - new Date(claim.waktu_1).getTime()) / (1000 * 60 * 60 * 24));
  }

  // Phase D: Waktu-2 to Waktu-3
  if (claim.waktu_2 && claim.waktu_3) {
    result.phases.phaseD = Math.ceil((new Date(claim.waktu_3).getTime() - new Date(claim.waktu_2).getTime()) / (1000 * 60 * 60 * 24));
  }

  // Phase E: Waktu-3 to Waktu-5
  if (claim.waktu_3 && claim.waktu_5) {
    result.phases.phaseE = Math.ceil((new Date(claim.waktu_5).getTime() - new Date(claim.waktu_3).getTime()) / (1000 * 60 * 60 * 24));
  }

  // Phase F: Waktu-5 to Waktu-7
  if (claim.waktu_5 && claim.waktu_7) {
    result.phases.phaseF = Math.ceil((new Date(claim.waktu_7).getTime() - new Date(claim.waktu_5).getTime()) / (1000 * 60 * 60 * 24));
  }

  // Total
  if (claim.waktu_0 && claim.waktu_7) {
    result.total = Math.ceil((new Date(claim.waktu_7).getTime() - new Date(claim.waktu_0).getTime()) / (1000 * 60 * 60 * 24));
  } else if (claim.waktu_0) {
    result.total = Math.ceil((new Date().getTime() - new Date(claim.waktu_0).getTime()) / (1000 * 60 * 60 * 24));
  }

  return result;
}

/**
 * Get stage duration in days
 */
export function getStageDuration(claim: any): {
  dilaporkan: number;
  verifikasi: number;
  proses_pusat: number;
  penyaluran: number;
  total: number;
} {
  const result = {
    dilaporkan: 0,
    verifikasi: 0,
    proses_pusat: 0,
    penyaluran: 0,
    total: 0
  };

  if (claim.tanggal_lapor_keluarga && claim.cabang_tanggal_kirim_ke_pusat) {
    const start = new Date(claim.tanggal_lapor_keluarga);
    const end = new Date(claim.cabang_tanggal_kirim_ke_pusat);
    result.dilaporkan = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  if (claim.cabang_tanggal_kirim_ke_pusat && claim.pusat_tanggal_selesai) {
    const start = new Date(claim.cabang_tanggal_kirim_ke_pusat);
    const end = new Date(claim.pusat_tanggal_selesai);
    result.proses_pusat = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  if (claim.pusat_tanggal_selesai && claim.cabang_tanggal_serah_ke_ahli_waris) {
    const start = new Date(claim.pusat_tanggal_selesai);
    const end = new Date(claim.cabang_tanggal_serah_ke_ahli_waris);
    result.penyaluran = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  if (claim.tanggal_lapor_keluarga && claim.cabang_tanggal_lapor_ke_pusat) {
    const start = new Date(claim.tanggal_lapor_keluarga);
    const end = new Date(claim.cabang_tanggal_lapor_ke_pusat);
    result.total = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  return result;
}
