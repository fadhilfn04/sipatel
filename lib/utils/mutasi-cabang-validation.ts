/**
 * Mutasi Cabang — Validasi Form Pengajuan
 *
 * Prinsip: seluruh field wajib diisi; dokumen mutasi cukup nomor + tanggal
 * (tanpa upload file); tanggal dokumen tidak boleh lebih akhir dari tanggal
 * mulai mutasi (dokumen diterbitkan sebelum/pada tanggal efektif).
 *
 * Dipakai bersama oleh frontend (form pengajuan — UX) dan backend
 * (app/api/mutasi-cabang — source of truth).
 */

export type MutasiCabangFormField =
  | 'anggota_id'
  | 'cabang_tujuan'
  | 'tanggal_mulai_mutasi'
  | 'nomor_dokumen_mutasi'
  | 'tanggal_dokumen_mutasi';

export interface MutasiCabangInput {
  anggota_id?: string | null;
  cabang_tujuan?: string | null;
  /** Cabang asal anggota (untuk validasi cabang tujuan harus berbeda). */
  cabang_asal?: string | null;
  tanggal_mulai_mutasi?: string | null;
  nomor_dokumen_mutasi?: string | null;
  tanggal_dokumen_mutasi?: string | null;
}

export interface MutasiCabangValidationError {
  field: MutasiCabangFormField;
  message: string;
}

export const MUTASI_CABANG_FIELD_LABELS: Record<MutasiCabangFormField, string> = {
  anggota_id: 'Anggota (NIK)',
  cabang_tujuan: 'Cabang Tujuan',
  tanggal_mulai_mutasi: 'Tanggal Mulai Mutasi',
  nomor_dokumen_mutasi: 'Nomor Dokumen Mutasi',
  tanggal_dokumen_mutasi: 'Tanggal Dokumen Mutasi',
};

/** Nomor dokumen: 3–100 karakter; huruf, angka, spasi, dan ./_-() */
export const NOMOR_DOKUMEN_MUTASI_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ./_()-]*$/;
export const NOMOR_DOKUMEN_MUTASI_MAX_LENGTH = 100;
export const NOMOR_DOKUMEN_MUTASI_MIN_LENGTH = 3;

/**
 * Parse 'YYYY-MM-DD' (suffix waktu diabaikan) dan pastikan tanggal benar-benar
 * valid di kalender (mis. 2026-02-30 ditolak).
 */
export function parseMutasiDateOnly(value: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec((value || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Validasi lengkap form pengajuan mutasi cabang.
 * Return daftar error { field, message } — field dipakai untuk menampilkan
 * pesan pada input yang bermasalah di frontend.
 */
export function validatePengajuanMutasiInput(
  input: MutasiCabangInput,
): MutasiCabangValidationError[] {
  const errors: MutasiCabangValidationError[] = [];

  const tanggalMulai = parseMutasiDateOnly(input.tanggal_mulai_mutasi);
  const tanggalDokumen = parseMutasiDateOnly(input.tanggal_dokumen_mutasi);
  const nomorDokumen = (input.nomor_dokumen_mutasi || '').trim();
  const cabangTujuan = (input.cabang_tujuan || '').trim();
  const cabangAsal = (input.cabang_asal || '').trim();

  // Anggota (NIK) — wajib dipilih
  if (!input.anggota_id || !String(input.anggota_id).trim()) {
    errors.push({
      field: 'anggota_id',
      message: `${MUTASI_CABANG_FIELD_LABELS.anggota_id} wajib dipilih.`,
    });
  }

  // Cabang Tujuan — wajib dipilih
  if (!cabangTujuan) {
    errors.push({
      field: 'cabang_tujuan',
      message: `${MUTASI_CABANG_FIELD_LABELS.cabang_tujuan} wajib dipilih.`,
    });
  } else if (
    cabangAsal &&
    cabangTujuan.toLowerCase() === cabangAsal.toLowerCase()
  ) {
    errors.push({
      field: 'cabang_tujuan',
      message: `${MUTASI_CABANG_FIELD_LABELS.cabang_tujuan} tidak boleh sama dengan cabang asal anggota.`,
    });
  }

  // Tanggal Mulai Mutasi — wajib & format valid
  if (!input.tanggal_mulai_mutasi || !input.tanggal_mulai_mutasi.trim()) {
    errors.push({
      field: 'tanggal_mulai_mutasi',
      message: `${MUTASI_CABANG_FIELD_LABELS.tanggal_mulai_mutasi} wajib diisi.`,
    });
  } else if (!tanggalMulai) {
    errors.push({
      field: 'tanggal_mulai_mutasi',
      message: `${MUTASI_CABANG_FIELD_LABELS.tanggal_mulai_mutasi} harus berupa tanggal yang valid (YYYY-MM-DD).`,
    });
  }

  // Nomor Dokumen Mutasi — wajib, panjang, dan karakter diizinkan
  if (!nomorDokumen) {
    errors.push({
      field: 'nomor_dokumen_mutasi',
      message: `${MUTASI_CABANG_FIELD_LABELS.nomor_dokumen_mutasi} wajib diisi.`,
    });
  } else if (
    nomorDokumen.length < NOMOR_DOKUMEN_MUTASI_MIN_LENGTH ||
    nomorDokumen.length > NOMOR_DOKUMEN_MUTASI_MAX_LENGTH
  ) {
    errors.push({
      field: 'nomor_dokumen_mutasi',
      message: `${MUTASI_CABANG_FIELD_LABELS.nomor_dokumen_mutasi} harus ${NOMOR_DOKUMEN_MUTASI_MIN_LENGTH}-${NOMOR_DOKUMEN_MUTASI_MAX_LENGTH} karakter.`,
    });
  } else if (!NOMOR_DOKUMEN_MUTASI_PATTERN.test(nomorDokumen)) {
    errors.push({
      field: 'nomor_dokumen_mutasi',
      message: `${MUTASI_CABANG_FIELD_LABELS.nomor_dokumen_mutasi} hanya boleh berisi huruf, angka, spasi, dan karakter . / _ - ( ).`,
    });
  }

  // Tanggal Dokumen Mutasi — wajib & format valid
  if (!input.tanggal_dokumen_mutasi || !input.tanggal_dokumen_mutasi.trim()) {
    errors.push({
      field: 'tanggal_dokumen_mutasi',
      message: `${MUTASI_CABANG_FIELD_LABELS.tanggal_dokumen_mutasi} wajib diisi.`,
    });
  } else if (!tanggalDokumen) {
    errors.push({
      field: 'tanggal_dokumen_mutasi',
      message: `${MUTASI_CABANG_FIELD_LABELS.tanggal_dokumen_mutasi} harus berupa tanggal yang valid (YYYY-MM-DD).`,
    });
  }

  // Urutan tanggal: dokumen diterbitkan sebelum/pada tanggal efektif mutasi.
  if (tanggalMulai && tanggalDokumen && tanggalDokumen.getTime() > tanggalMulai.getTime()) {
    errors.push({
      field: 'tanggal_dokumen_mutasi',
      message: `${MUTASI_CABANG_FIELD_LABELS.tanggal_dokumen_mutasi} tidak boleh lebih akhir dari ${MUTASI_CABANG_FIELD_LABELS.tanggal_mulai_mutasi}.`,
    });
  }

  return errors;
}

/** Gabungkan seluruh error validasi menjadi satu pesan (untuk pesan API). */
export function formatMutasiValidationErrors(errors: MutasiCabangValidationError[]): string {
  return errors.map((e) => e.message).join(' ');
}

/** Error untuk satu field (untuk menampilkan pesan inline di form). */
export function getMutasiFieldError(
  errors: MutasiCabangValidationError[],
  field: MutasiCabangFormField,
): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}
