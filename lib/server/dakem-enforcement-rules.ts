/**
 * Dana Kematian — Aturan enforcement murni (tanpa dependency server/session).
 *
 * Dipisah dari lib/server/dakem-enforcement.ts agar dapat diuji unit.
 * Semua aturan mengikuti workflow existing (lib/workflow/dana-kematian-*).
 */

export interface DakemActorContext {
  userId: string | null;
  roleSlug: string;
  isSuperuser: boolean;
  canManagePC: boolean;
  canVerifyPP: boolean;
  /** true bila user hanya memiliki kapabilitas Cabang (USER CABANG) */
  isCabangOnly: boolean;
}

/**
 * Status ketika data pengajuan masih dapat diedit oleh Cabang
 * (selaras dengan claimEditable di DanaKematianFormModal).
 */
export const CABANG_EDITABLE_STATUSES = [
  'draft',
  'dilaporkan',
  'verifikasi_cabang',
  'pending_dokumen',
  'revisi_pusat',
];

/**
 * Bidang yang tetap boleh ditulis USER CABANG setelah pengajuan disubmit ke
 * Pusat — dipakai oleh aksi tahap lanjut PC pada DanaKematianDetailModal:
 * konfirmasi penyerahan (penyaluran → terima_ahli_waris), upload laporan
 * cabang (terima_ahli_waris → laporan), dan menyelesaikan pengajuan
 * (laporan → selesai), termasuk transisi status-nya.
 */
export const PC_LATE_STAGE_FIELDS = new Set([
  'updated_at',
  'status_proses',
  'cabang_tanggal_serah_ke_ahli_waris',
  'file_bukti_penyerahan',
  'waktu_6',
  'document_metadata', // upload laporan cabang (hanya pada status terima_ahli_waris)
  'cabang_tanggal_lapor_ke_pusat',
  'pusat_tanggal_selesai',
  'waktu_7',
]);

/**
 * Bidang ranah Pusat yang tidak boleh diubah USER CABANG meskipun pengajuan
 * masih di tahap editable (flag verifikasi dokumen, tanggal pusat, timeline
 * verifikasi PP).
 */
export const PUSAT_OWNED_FIELDS = [
  'dokumen_surat_kematian_verified',
  'dokumen_sk_pensiun_verified',
  'dokumen_surat_pernyataan_verified',
  'dokumen_kartu_keluarga_verified',
  'dokumen_ktp_ahli_waris_verified',
  'dokumen_surat_nikah_verified',
  'dokumen_surat_keterangan_verified',
  'dokumen_pendukung_verified',
  'dokumen_buku_rekening_verified',
  'dokumen_surat_kuasa_verified',
  'is_validated_pp',
  'is_approved',
  'is_funds_transferred',
  'is_delivered',
  'is_reported',
  'pusat_tanggal_awal_terima',
  'pusat_tanggal_validasi',
  'pusat_tanggal_selesai',
  'waktu_3',
  'waktu_4',
  'waktu_5',
];

/**
 * Target transisi yang hanya boleh dilakukan Pusat/admin
 * (sesuai allowed_roles pada lib/workflow/dana-kematian-state-machine.ts).
 */
export const PUSAT_ONLY_STATUS_TARGETS = new Set(['verified', 'ditolak', 'penyaluran']);

export interface CabangPatchValidation {
  allowed: boolean;
  message?: string;
}

/**
 * Validasi patch milik USER CABANG terhadap status pengajuan saat ini.
 * Selalu allowed untuk Pusat/admin.
 */
export function validateCabangPatchPermissions(
  patch: Record<string, unknown>,
  existingClaim: Record<string, any>,
  actor: DakemActorContext,
): CabangPatchValidation {
  if (!actor.isCabangOnly) return { allowed: true };

  const status = String(existingClaim.status_proses || '');
  const requestedStatus = patch['status_proses'] as string | undefined;

  // Transisi khusus Pusat tidak boleh dilakukan cabang.
  if (requestedStatus && requestedStatus !== status) {
    if (PUSAT_ONLY_STATUS_TARGETS.has(requestedStatus)) {
      return {
        allowed: false,
        message: `Transisi ke status '${requestedStatus}' hanya dapat dilakukan oleh Pusat.`,
      };
    }
    if (requestedStatus === 'pending_dokumen' && status === 'proses_pusat') {
      return {
        allowed: false,
        message: 'Pengembalian berkas untuk koreksi (Koreksi) hanya dapat dilakukan oleh Pusat.',
      };
    }
  }

  if (CABANG_EDITABLE_STATUSES.includes(status)) {
    // Tahap editable — blokir bidang ranah Pusat yang nilainya berubah.
    const touched = PUSAT_OWNED_FIELDS.filter(
      field => patch[field] !== undefined && patch[field] !== existingClaim[field],
    );
    if (touched.length > 0) {
      return {
        allowed: false,
        message: `Bidang berikut hanya dapat diubah oleh Pusat: ${touched.join(', ')}.`,
      };
    }
    return { allowed: true };
  }

  // Setelah submit ke Pusat → read-only untuk Cabang, kecuali aksi tahap lanjut.
  const isLaporanStage = status === 'terima_ahli_waris';
  const forbidden = Object.keys(patch).filter(key => {
    if (key === 'updated_at') return false;
    if (PC_LATE_STAGE_FIELDS.has(key)) {
      // document_metadata hanya untuk upload laporan cabang pada tahap laporan.
      return key === 'document_metadata' && !isLaporanStage;
    }
    return patch[key] !== existingClaim[key]; // nilai sama → no-op, dibiarkan
  });

  if (forbidden.length > 0) {
    return {
      allowed: false,
      message:
        'Pengajuan sudah di-submit ke Pusat dan bersifat read-only untuk Cabang — ' +
        'data, dokumen, dan field pengajuan tidak dapat diubah lagi. ' +
        `Bidang yang ditolak: ${forbidden.join(', ')}.`,
    };
  }

  return { allowed: true };
}
