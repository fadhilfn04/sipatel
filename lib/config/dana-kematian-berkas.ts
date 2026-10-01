/**
 * Dana Kematian — Berkas Document Configuration
 *
 * SINGLE SOURCE OF TRUTH untuk daftar dokumen pengajuan (Dokumen-1 s.d.
 * Dokumen-8) dan gerbang "Berkas Lengkap".
 *
 * File ini sengaja TIDAK meng-import modul React/lucide supaya aman dipakai
 * bersama oleh:
 *   - Frontend: components/dana-kematian/DanaKematianFormModal.tsx (wizard
 *     dokumen + daftar item yang belum lengkap)
 *   - Frontend: components/dana-kematian/DocumentValidationSystem.tsx (grid
 *     verifikasi dokumen PP)
 *   - Backend : app/api/dana-kematian (gate saat submit "Berkas Lengkap")
 *   - Shared  : lib/workflow/dana-kematian-state-machine.ts (kondisi
 *     transisi draft → proses_pusat)
 *
 * Cara mengubah daftar dokumen wajib (masa depan):
 *   - Menambah dokumen wajib baru   → tambahkan entri baru dengan
 *     `requiredForLengkap: true` (kolom file_* baru perlu migration kolom
 *     TEXT di tabel dana_kematian + folder bucket + validasi folder di
 *     app/api/upload).
 *   - Menjadikan dokumen opsional    → set `requiredForLengkap: false`.
 *   - Menghapus dari gerbang         → set `requiredForLengkap: false`
 *     (entri tetap ada untuk menampilkan dokumen yang sudah terupload).
 * UI dan backend otomatis mengikuti — jangan hardcode daftar dokumen di
 * komponen/route.
 */

/** Identitas step dokumen pada wizard form pengajuan */
export type BerkasStepKey =
  | 'sk_pensiun'
  | 'akte_kematian'
  | 'surat_ahli_waris'
  | 'kk'
  | 'e_ktp'
  | 'surat_nikah'
  | 'surat_permohonan'
  | 'dokumen_pendukung';

/**
 * Requirement tambahan berbasis document_metadata.
 * Semua kondisi dievaluasi terhadap metadata dokumen tersebut saja.
 */
export interface BerkasMetadataRequirement {
  /** key pada document_metadata */
  key: string;
  /** label pada daftar "dokumen belum lengkap" */
  label: string;
  /** hanya dicek jika file belum diupload */
  onlyWhenFileMissing?: boolean;
  /** nilai yang wajib sama persis (mis. konfirmasi garis keturunan) */
  equals?: unknown;
  /** key lain yang wajib terisi bila key ini bernilai `whenValue` */
  requiresWhen?: { whenValue: unknown; key: string; label: string };
}

export interface BerkasDocumentConfig {
  id: BerkasStepKey;
  label: string;
  shortLabel: string;
  description: string;
  /** Kolom dana_kematian yang menyimpan URL file */
  fileKey: string;
  /** Folder di bucket storage `dana-kematian` */
  folder: string;
  /** Kolom flag verifikasi PP */
  verifiedKey: string;
  /** Dokumen ini wajib sebelum "Berkas Lengkap" dapat diproses */
  requiredForLengkap: true | boolean;
  /**
   * Key document_metadata untuk field "Keterangan" dokumen ini
   * (mengikuti pola Dokumen-1 SK / Surat Nikah).
   */
  keteranganMetaKey?: string;
  /** Placeholder text field Keterangan pada form */
  keteranganPlaceholder?: string;
  /** true = keterangan dapat menggantikan file yang hilang (SK Pensiun, Surat Nikah) */
  keteranganCanReplaceFile?: boolean;
  /** Key metadata pengganti file (dipakai bersama keteranganCanReplaceFile) */
  fileSubstitution?: {
    flagKey: string;
    flagValue: unknown;
    keteranganKey: string;
  };
  /** Requirement metadata yang harus terpenuhi */
  metadataRequirements?: BerkasMetadataRequirement[];
  /** Label dinamis untuk keluarga inti (Surat Keterangan vs Kuasa Ahli Waris) */
  labelByHeirStatus?: { keluargaInti: string; lainnya: string };
  /** Catatan kondisional pada grid verifikasi PP */
  conditionNote?: string;
}


/**
 * Daftar dokumen pengajuan — urutan = urutan wizard form.
 * Dokumen-1 s.d. Dokumen-6 wajib; Dokumen-7 (Surat Permohonan) wajib;
 * Dokumen-8 (Dokumen Pendukung) opsional. Sesuaikan flag
 * `requiredForLengkap` untuk mengubah konfigurasi ke depannya.
 */
export const BERKAS_DOCUMENTS: BerkasDocumentConfig[] = [
  {
    id: 'sk_pensiun',
    label: 'SK Pensiun',
    shortLabel: 'SK Pensiun',
    description: 'Upload Surat Keputusan Pensiun anggota yang bersangkutan. Jika dokumen hilang, berikan pernyataan resmi.',
    fileKey: 'file_sk_pensiun',
    folder: 'sk-pensiun',
    verifiedKey: 'dokumen_sk_pensiun_verified',
    requiredForLengkap: true,
    keteranganMetaKey: 'sk_pensiun_hilang_keterangan',
    keteranganPlaceholder: 'Contoh: SK Pensiun almarhum hilang karena banjir. Surat keterangan kehilangan dari kelurahan terlampir.',
    keteranganCanReplaceFile: true,
    fileSubstitution: {
      flagKey: 'sk_pensiun_missing',
      flagValue: true,
      keteranganKey: 'sk_pensiun_hilang_keterangan',
    },
  },
  {
    id: 'akte_kematian',
    label: 'Akte Kematian',
    shortLabel: 'Akte Kematian',
    description: 'Upload akte/surat kematian resmi dan pilih sumber penerbit dokumen',
    fileKey: 'file_surat_kematian',
    folder: 'surat-kematian',
    verifiedKey: 'dokumen_surat_kematian_verified',
    requiredForLengkap: true,
    metadataRequirements: [
      { key: 'akte_kematian_sumber', label: 'Sumber Dokumen Akte Kematian' },
      {
        key: 'akte_kematian_sumber',
        label: 'Keterangan sumber Akte Kematian (Lainnya)',
        requiresWhen: { whenValue: 'lainnya', key: 'akte_kematian_sumber_lainnya', label: 'Keterangan sumber Akte Kematian (Lainnya)' },
      },
    ],
  },
  {
    id: 'surat_ahli_waris',
    label: 'Surat Keterangan / Surat Kuasa Ahli Waris',
    shortLabel: 'Surat Ahli Waris',
    description: 'Surat Keterangan untuk keluarga inti (istri/suami/anak) atau Surat Kuasa untuk hubungan lainnya. Harus dilegalisir.',
    fileKey: 'file_surat_pernyataan_ahli_waris',
    folder: 'surat-pernyataan-ahli-waris',
    verifiedKey: 'dokumen_surat_pernyataan_verified',
    requiredForLengkap: true,
    labelByHeirStatus: {
      keluargaInti: 'Surat Keterangan Ahli Waris',
      lainnya: 'Surat Kuasa Ahli Waris',
    },
  },
  {
    id: 'kk',
    label: 'Kartu Keluarga Ahli Waris',
    shortLabel: 'KK Ahli Waris',
    description: 'Upload kartu keluarga ahli waris yang masih berlaku dan konfirmasi garis keturunan',
    fileKey: 'file_kartu_keluarga',
    folder: 'kartu-keluarga',
    verifiedKey: 'dokumen_kartu_keluarga_verified',
    requiredForLengkap: true,
    metadataRequirements: [
      { key: 'kk_ahli_waris_konfirmasi', label: 'Konfirmasi garis keturunan pada KK', equals: true },
    ],
  },
  {
    id: 'e_ktp',
    label: 'E-KTP Ahli Waris',
    shortLabel: 'E-KTP Ahli Waris',
    description: 'Upload fotokopi E-KTP ahli waris yang masih berlaku (jika E-KTP lebih dari satu, gabungkan dalam satu file PDF/kolase)',
    fileKey: 'file_e_ktp',
    folder: 'e-ktp',
    verifiedKey: 'dokumen_ktp_ahli_waris_verified',
    requiredForLengkap: true,
  },
  {
    id: 'surat_nikah',
    label: 'Surat Nikah',
    shortLabel: 'Surat Nikah',
    description: 'Upload surat nikah (diperlukan jika ahli waris istri/suami). Jika tidak ada, isi keterangan.',
    fileKey: 'file_surat_nikah',
    folder: 'surat-nikah',
    verifiedKey: 'dokumen_surat_nikah_verified',
    requiredForLengkap: true,
    keteranganMetaKey: 'surat_nikah_keterangan',
    keteranganPlaceholder: 'Contoh: Buku nikah hilang terbakar saat kebakaran rumah. Surat keterangan belum menikah lagi dari kelurahan terlampir.',
    keteranganCanReplaceFile: true,
    fileSubstitution: {
      flagKey: 'surat_nikah_keterangan',
      flagValue: undefined,
      keteranganKey: 'surat_nikah_keterangan',
    },
    conditionNote: 'Wajib jika ahli waris suami/istri — jika tidak ada, wajib mengisi keterangan',
  },
  {
    id: 'surat_permohonan',
    label: 'Surat Permohonan',
    shortLabel: 'Surat Permohonan',
    description: 'Upload surat permohonan/pengantar resmi dari cabang — wajib untuk proses selanjutnya',
    fileKey: 'file_surat_keterangan',
    folder: 'surat-keterangan',
    verifiedKey: 'dokumen_surat_keterangan_verified',
    requiredForLengkap: true,
    keteranganMetaKey: 'surat_permohonan_keterangan',
    keteranganPlaceholder: 'Contoh: Surat permohonan dana kematian bernomor 123/PC/XI/2026 tanggal 10 November 2026.',
  },
  {
    id: 'dokumen_pendukung',
    label: 'Dokumen Pendukung',
    shortLabel: 'Dok. Pendukung',
    description: 'Upload dokumen pendukung lainnya jika ada',
    fileKey: 'file_dokumen_pendukung',
    folder: 'dokumen-pendukung',
    verifiedKey: 'dokumen_pendukung_verified',
    requiredForLengkap: false,
    keteranganMetaKey: 'dokumen_pendukung_keterangan',
    keteranganPlaceholder: 'Contoh: Dokumen tambahan berupa surat keterangan domisili ahli waris.',
  },
];

/** Hubungan ahli waris yang tergolong keluarga inti (label surat ahli waris) */
const KELUARGA_INTI_RELATIONS = ['istri', 'suami', 'anak'];

/** Apakah hubungan ahli waris tergolong keluarga inti? */
export function isKeluargaIntiRelation(
  relation: string | null | undefined,
): boolean {
  return KELUARGA_INTI_RELATIONS.includes(relation || '');
}

/**
 * Baca document_metadata baik sebagai object (Supabase jsonb) maupun string
 * JSON. Tidak bergantung pada lib/supabase agar aman dipakai di server.
 */
export function parseDocumentMetadata(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? (raw as Record<string, any>) : {};
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

/** Opsi evaluasi berkas */
export interface BerkasEvaluationOptions {
  /** status_ahli_waris — menentukan label Surat Keterangan vs Kuasa Ahli Waris */
  statusAhliWaris?: string | null;
}

/** Hasil evaluasi satu dokumen */
export interface BerkasDocumentEvaluation {
  config: BerkasDocumentConfig;
  /** true bila seluruh requirement dokumen terpenuhi */
  ok: boolean;
  /** label item yang belum terpenuhi (kosong bila ok) */
  missingItems: string[];
}

/** Label dokumen menurut status ahli waris (keluarga inti vs lainnya) */
export function getBerkasDocumentLabel(
  doc: BerkasDocumentConfig,
  options?: BerkasEvaluationOptions,
): string {
  if (doc.labelByHeirStatus) {
    const isKeluargaInti = KELUARGA_INTI_RELATIONS.includes(options?.statusAhliWaris || '');
    return isKeluargaInti ? doc.labelByHeirStatus.keluargaInti : doc.labelByHeirStatus.lainnya;
  }
  return doc.label;
}

/**
 * Evaluasi satu dokumen terhadap data pengajuan (file URL + metadata).
 * File dianggap ada bila kolom file terisi. Keterangan dapat menggantikan
 * file hanya untuk dokumen dengan `keteranganCanReplaceFile`.
 */
export function evaluateBerkasDocument(
  doc: BerkasDocumentConfig,
  claim: Record<string, any>,
  options?: BerkasEvaluationOptions,
): BerkasDocumentEvaluation {
  const meta = parseDocumentMetadata(claim?.document_metadata);
  const hasFile = hasValue(claim?.[doc.fileKey]);
  const missingItems: string[] = [];

  // Substitusi file dengan keterangan/pernyataan (SK Pensiun, Surat Nikah)
  let substituted = false;
  if (!hasFile && doc.fileSubstitution) {
    const sub = doc.fileSubstitution;
    if (sub.flagKey === sub.keteranganKey) {
      // Surat Nikah: keterangan apa pun menggantikan file
      substituted = hasValue(meta[sub.keteranganKey]);
    } else {
      substituted =
        meta[sub.flagKey] === sub.flagValue && hasValue(meta[sub.keteranganKey]);
    }
  }

  if (!hasFile && !substituted) {
    missingItems.push(
      doc.keteranganCanReplaceFile
        ? `${getBerkasDocumentLabel(doc, options)} (file atau keterangan)`
        : getBerkasDocumentLabel(doc, options),
    );
  }

  // Requirement metadata (mis. sumber akte, konfirmasi KK)
  for (const req of doc.metadataRequirements || []) {
    if (req.onlyWhenFileMissing && hasFile) continue;
    const value = meta[req.key];
    if (req.requiresWhen && value === req.requiresWhen.whenValue) {
      if (!hasValue(meta[req.requiresWhen.key])) {
        missingItems.push(req.requiresWhen.label);
      }
      continue;
    }
    if (req.equals !== undefined) {
      if (value !== req.equals) missingItems.push(req.label);
      continue;
    }
    if (!hasValue(value)) missingItems.push(req.label);
  }

  return { config: doc, ok: missingItems.length === 0, missingItems };
}

/** Seluruh dokumen berkas (urutan wizard) */
export function getBerkasDocuments(): BerkasDocumentConfig[] {
  return BERKAS_DOCUMENTS;
}

/** Dokumen yang wajib sebelum "Berkas Lengkap" */
export function getMandatoryBerkasDocuments(): BerkasDocumentConfig[] {
  return BERKAS_DOCUMENTS.filter(doc => doc.requiredForLengkap);
}

/**
 * Daftar item berkas yang belum terpenuhi (label, siap ditampilkan ke user).
 * Hanya dokumen dengan requiredForLengkap yang dievaluasi.
 */
export function getMissingBerkasItems(
  claim: Record<string, any>,
  options?: BerkasEvaluationOptions,
): string[] {
  const missing: string[] = [];
  for (const doc of getMandatoryBerkasDocuments()) {
    const evaluation = evaluateBerkasDocument(doc, claim, options);
    missing.push(...evaluation.missingItems);
  }
  return missing;
}

/**
 * Apakah seluruh dokumen wajib sudah lengkap? Gerbang tombol
 * "Berkas Lengkap" (frontend) dan transisi ke proses_pusat (backend).
 */
export function isBerkasLengkap(
  claim: Record<string, any>,
  options?: BerkasEvaluationOptions,
): boolean {
  return getMissingBerkasItems(claim, options).length === 0;
}
