/**
 * Dana Kematian State Machine
 *
 * Manages status transitions and validation rules for death benefit claims
 */

// =====================================================
// TYPES & INTERFACES
// =====================================================

export type DanaKematianStatus =
  | 'dilaporkan'
  | 'pending_dokumen'
  | 'verifikasi_cabang'
  | 'proses_pusat'
  | 'verified'
  | 'penyaluran'
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
  // Phase A to B: Death Report to PC Validation
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

  // Phase B to C: Initial documents incomplete
  {
    from: 'verifikasi_cabang',
    to: 'pending_dokumen',
    allowed_roles: ['cabang', 'admin'],
    description: 'Initial documents received but incomplete (Berkas-1 at Waktu-1)',
    condition: (claim) => {
      return claim.waktu_1 !== null && !areDocumentsComplete(claim);
    }
  },

  // Phase C to D: Complete documents submitted to PP
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

  // Alternative: From pending_dokumen to proses_pusat
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

  // Return to PC for corrections
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

  // Phase F: Fund delivery and reporting
  {
    from: 'penyaluran',
    to: 'selesai',
    allowed_roles: ['cabang', 'admin'],
    description: 'Funds delivered to heir and all reports submitted (Waktu-6 → Waktu-7)',
    condition: (claim) => {
      return claim.is_delivered === true &&
             claim.cabang_tanggal_serah_ke_ahli_waris !== null &&
             claim.file_bukti_penyerahan !== null &&
             claim.is_reported === true &&
             claim.cabang_tanggal_lapor_ke_pusat !== null &&
             claim.file_berita_acara !== null &&
             claim.file_laporan_keuangan !== null &&
             claim.file_laporan_feedback !== null;
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
 * Check if all required documents are present
 */
function areDocumentsComplete(claim: any): boolean {
  const requiredDocs = [
    'file_surat_kematian',
    'file_sk_pensiun',
    'file_surat_pernyataan_ahli_waris',
    'file_kartu_keluarga',
    'file_e_ktp'
  ];

  return requiredDocs.every(doc => {
    const value = claim[doc];
    return value !== null && value !== undefined && value !== '';
  });
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
  if (!areDocumentsComplete(claim)) {
    const requiredDocs = [
      { field: 'file_surat_kematian', name: 'Surat Kematian' },
      { field: 'file_sk_pensiun', name: 'SK Pensiun' },
      { field: 'file_surat_pernyataan_ahli_waris', name: 'Surat Pernyataan Ahli Waris' },
      { field: 'file_kartu_keluarga', name: 'Kartu Keluarga' },
      { field: 'file_e_ktp', name: 'KTP Ahli Waris' }
    ];

    requiredDocs.forEach(doc => {
      if (!claim[doc.field]) {
        validation.missing_documents.push(doc.name);
      }
    });

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
    case 'verifikasi_cabang':
      if (!areDocumentsComplete(claim)) {
        errors.push('Dokumen belum lengkap');
      }
      if (!claim.cabang_tanggal_awal_terima_berkas) {
        errors.push('Tanggal penerimaan berkas belum diisi');
      }
      break;

    case 'proses_pusat':
      if (!claim.cabang_tanggal_kirim_ke_pusat) {
        errors.push('Tanggal kirim ke pusat belum diisi');
      }
      if (claim.cabang_status_kelengkapan !== 'lengkap') {
        errors.push('Status kelengkapan harus "lengkap"');
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

    case 'selesai':
      if (!claim.cabang_tanggal_serah_ke_ahli_waris) {
        errors.push('Tanggal penyerahan ke ahli waris belum diisi');
      }
      if (!claim.cabang_tanggal_lapor_ke_pusat) {
        errors.push('Tanggal lapor ke pusat belum diisi');
      }
      if (!claim.cabang_bukti_penyerahan) {
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
    this.currentStatus = claim.status_proses || 'dilaporkan';
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
      'dilaporkan': [
        'Upload semua dokumen yang diperlukan',
        'Verifikasi kelengkapan dokumen',
        'Lengkapi data ahli waris'
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
        'Koordinasi dengan keuangan untuk transfer',
        'Jadwalkan penyerahan ke ahli waris'
      ],
      'penyaluran': [
        'Terima dana dari pusat',
        'Jadwalkan penyerahan ke ahli waris',
        'Serahkan dana dan dokumentasikan'
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
 * Get state label for display
 */
export function getStateLabel(status: DanaKematianStatus): string {
  const labels: Record<DanaKematianStatus, string> = {
    'dilaporkan': 'Dilaporkan',
    'pending_dokumen': 'Pending Dokumen',
    'verifikasi_cabang': 'Verifikasi Cabang',
    'proses_pusat': 'Proses Pusat',
    'verified': 'Terverifikasi',
    'penyaluran': 'Penyaluran',
    'selesai': 'Selesai',
    'ditolak': 'Ditolak'
  };
  return labels[status] || status;
}

/**
 * Get state description for tooltip/help
 */
export function getStateDescription(status: DanaKematianStatus): string {
  const descriptions: Record<DanaKematianStatus, string> = {
    'dilaporkan': 'Laporan kematian telah diterima (Waktu-0)',
    'pending_dokumen': 'Menunggu pelengkapan dokumen (Waktu-1)',
    'verifikasi_cabang': 'PC melakukan validasi dan komunikasi aktif dengan ahli waris',
    'proses_pusat': 'Berkas sedang diverifikasi oleh PP (Waktu-2 → Waktu-3)',
    'verified': 'Terverifikasi oleh PP, menunggu penyaluran dana',
    'penyaluran': 'Dana sedang diproses dan disalurkan (Waktu-4 → Waktu-6)',
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
    'dilaporkan': 'blue',
    'pending_dokumen': 'yellow',
    'verifikasi_cabang': 'cyan',
    'proses_pusat': 'purple',
    'verified': 'indigo',
    'penyaluran': 'orange',
    'selesai': 'green',
    'ditolak': 'red'
  };
  return colors[status] || 'gray';
}

/**
 * Get state badge variant
 */
export function getStateBadgeVariant(status: DanaKematianStatus): 'success' | 'warning' | 'destructive' | 'secondary' {
  const variants: Record<DanaKematianStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
    'selesai': 'success',
    'verified': 'success',
    'ditolak': 'destructive',
    'pending_dokumen': 'warning',
    'penyaluran': 'warning',
    'dilaporkan': 'secondary',
    'verifikasi_cabang': 'secondary',
    'proses_pusat': 'secondary'
  };
  return variants[status] || 'secondary';
}

/**
 * Get current phase based on status
 */
export function getCurrentPhase(status: DanaKematianStatus): string {
  const phaseMap: Record<DanaKematianStatus, string> = {
    'dilaporkan': 'A. Laporan Kematian',
    'verifikasi_cabang': 'B. Pengajuan Dakem',
    'pending_dokumen': 'C. Kompilasi Berkas',
    'proses_pusat': 'D. Verifikasi Pengajuan',
    'verified': 'E. Finalisasi Pengajuan',
    'penyaluran': 'F. Laporan Dakem',
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
    'dilaporkan': 'Waktu-1 (Initial Documents)',
    'verifikasi_cabang': 'Waktu-1 (Initial Documents)',
    'pending_dokumen': 'Waktu-2 (Final Documents)',
    'proses_pusat': 'Waktu-3 (PP Validation)',
    'verified': 'Waktu-4 (Processing Complete)',
    'penyaluran': 'Waktu-7 (Reporting Complete)',
    'selesai': 'Complete',
    'ditolak': 'N/A'
  };
  return nextWaktu[status] || 'Unknown';
}

/**
 * Check if status allows communication tracking
 */
export function allowsCommunicationTracking(status: DanaKematianStatus): boolean {
  return ['dilaporkan', 'verifikasi_cabang'].includes(status);
}

/**
 * Check if status allows document upload
 */
export function allowsDocumentUpload(status: DanaKematianStatus): boolean {
  return ['dilaporkan', 'verifikasi_cabang', 'pending_dokumen'].includes(status);
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
  return ['penyaluran'].includes(status);
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
  return claim.status_proses !== 'selesai' &&
         claim.status_proses !== 'ditolak' &&
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
    'dilaporkan': {
      stage: 'A. Laporan Kematian',
      description: 'Laporan kematian telah diterima',
      waktu: 'Waktu-0',
      percentComplete: 12.5,
      nextStep: 'PC memulai validasi dan komunikasi dengan ahli waris'
    },
    'verifikasi_cabang': {
      stage: 'B. Pengajuan Dakem',
      description: 'PC melakukan validasi aktif dan komunikasi dengan ahli waris',
      waktu: 'Waktu-0 → Waktu-1',
      percentComplete: 25,
      nextStep: 'Menerima dan memverifikasi dokumen dari ahli waris'
    },
    'pending_dokumen': {
      stage: 'C. Kompilasi Berkas',
      description: 'Menunggu pelengkapan dokumen dari ahli waris',
      waktu: 'Waktu-1',
      percentComplete: 37.5,
      nextStep: 'Menerima dokumen lengkap dan mengirim ke PP'
    },
    'proses_pusat': {
      stage: 'D. Verifikasi Pengajuan',
      description: 'PP menerima dan memverifikasi kelengkapan dokumen',
      waktu: 'Waktu-2 → Waktu-3',
      percentComplete: 50,
      nextStep: 'Menunggu validasi dan persetujuan dari PP'
    },
    'verified': {
      stage: 'E. Finalisasi Pengajuan',
      description: 'Dokumen telah divalidasi, menunggu persetujuan dan transfer dana',
      waktu: 'Waktu-3 → Waktu-5',
      percentComplete: 62.5,
      nextStep: 'Menunggu transfer dana dari PP ke PC'
    },
    'penyaluran': {
      stage: 'F. Laporan Dakem',
      description: 'Dana telah ditransfer ke PC, siap disalurkan ke ahli waris',
      waktu: 'Waktu-5 → Waktu-6',
      percentComplete: 75,
      nextStep: 'Menyerahkan dana ke ahli waris dan membuat laporan'
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

  return stageInfo[status] || stageInfo['dilaporkan'];
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
      waktu: 'Waktu-0',
      label: 'Laporan Kematian',
      date: claim.waktu_0 || claim.tanggal_lapor_keluarga,
      description: 'Laporan kematian diterima dari keluarga',
      completed: !!(claim.waktu_0 || claim.tanggal_lapor_keluarga)
    },
    {
      waktu: 'Waktu-1',
      label: 'Dokumen Awal',
      date: claim.waktu_1 || claim.cabang_tanggal_awal_terima_berkas,
      description: 'Penerimaan dokumen pertama dari ahli waris',
      completed: !!claim.waktu_1
    },
    {
      waktu: 'Waktu-2',
      label: 'Pengiriman ke PP',
      date: claim.waktu_2 || claim.cabang_tanggal_kirim_ke_pusat,
      description: 'Berkas lengkap dikirim ke Pusat',
      completed: !!claim.waktu_2
    },
    {
      waktu: 'Waktu-3',
      label: 'Validasi PP',
      date: claim.waktu_3 || claim.pusat_tanggal_validasi,
      description: 'Validasi dan verifikasi oleh Pusat',
      completed: !!claim.waktu_3
    },
    {
      waktu: 'Waktu-4',
      label: 'Finalisasi',
      date: claim.waktu_4 || claim.pusat_tanggal_selesai,
      description: 'Persetujuan dan koordinasi keuangan',
      completed: !!claim.waktu_4
    },
    {
      waktu: 'Waktu-5',
      label: 'Transfer Dana',
      date: claim.waktu_5 || claim.tanggal_transfer_dana,
      description: 'Transfer dana dari PP ke PC',
      completed: !!claim.waktu_5
    },
    {
      waktu: 'Waktu-6',
      label: 'Penyerahan ke Ahli Waris',
      date: claim.waktu_6 || claim.tanggal_penyaluran_actual,
      description: 'Dana diserahkan kepada ahli waris',
      completed: !!claim.waktu_6
    },
    {
      waktu: 'Waktu-7',
      label: 'Laporan Lengkap',
      date: claim.waktu_7 || claim.tanggal_laporan_lengkap,
      description: 'Semua laporan telah diserahkan',
      completed: !!claim.waktu_7
    }
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
