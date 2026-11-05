/**
 * Pengakhiran Keanggotaan — Validasi Form Pengajuan
 *
 * Prinsip: anggota wajib dipilih, alasan wajib, keterangan wajib bila
 * alasan 'lainnya', tanggal efektif tidak boleh di masa depan, nomor dokumen
 * min. 3 karakter, dan tanggal dokumen tidak boleh lebih akhir dari tanggal
 * efektif berhenti.
 *
 * Dipakai bersama oleh frontend (UX) dan backend (source of truth).
 */

import type { AlasanPengakhiranEnum } from '@/lib/supabase';

export type PengakhiranFormField =
  | 'anggota_id'
  | 'alasan'
  | 'keterangan_alasan'
  | 'tanggal_efektif_berhenti'
  | 'nomor_dokumen'
  | 'tanggal_dokumen';

export interface PengakhiranInput {
  anggota_id?: string | null;
  alasan?: string | null;
  keterangan_alasan?: string | null;
  tanggal_efektif_berhenti?: string | null;
  nomor_dokumen?: string | null;
  tanggal_dokumen?: string | null;
}

export interface PengakhiranValidationError {
  field: PengakhiranFormField;
  message: string;
}

export const PENGAKHIRAN_FIELD_LABELS: Record<PengakhiranFormField, string> = {
  anggota_id: 'Anggota (NIK)',
  alasan: 'Alasan Berhenti',
  keterangan_alasan: 'Keterangan Alasan',
  tanggal_efektif_berhenti: 'Tanggal Efektif Berhenti',
  nomor_dokumen: 'Nomor Dokumen',
  tanggal_dokumen: 'Tanggal Dokumen',
};

export const ALASAN_PENGAKHIRAN_OPTIONS: { value: AlasanPengakhiranEnum; label: string }[] = [
  { value: 'mengundurkan_diri', label: 'Mengundurkan Diri' },
  { value: 'diberhentikan', label: 'Diberhentikan' },
  { value: 'lainnya', label: 'Lainnya' },
];

/** Nomor dokumen: 3–100 karakter; huruf, angka, spasi, dan ./_-() */
export const NOMOR_DOKUMEN_PENGAKHIRAN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ./_()-]*$/;
export const NOMOR_DOKUMEN_PENGAKHIRAN_MAX_LENGTH = 100;
export const NOMOR_DOKUMEN_PENGAKHIRAN_MIN_LENGTH = 3;

/** Parse 'YYYY-MM-DD' dan pastikan tanggal benar-benar valid di kalender. */
export function parsePengakhiranDateOnly(value: string | null | undefined): Date | null {
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

/** Apakah tanggal (YYYY-MM-DD) melewati hari ini? */
export function isPengakhiranFutureDate(value: string | null | undefined): boolean {
  const date = parsePengakhiranDateOnly(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() > today.getTime();
}

export function validatePengakhiranInput(input: PengakhiranInput): PengakhiranValidationError[] {
  const errors: PengakhiranValidationError[] = [];

  const alasan = (input.alasan || '').trim();
  const keteranganAlasan = (input.keterangan_alasan || '').trim();
  const tanggalEfektif = parsePengakhiranDateOnly(input.tanggal_efektif_berhenti);
  const tanggalDokumen = parsePengakhiranDateOnly(input.tanggal_dokumen);
  const nomorDokumen = (input.nomor_dokumen || '').trim();

  // Anggota (NIK) — wajib dipilih
  if (!input.anggota_id || !String(input.anggota_id).trim()) {
    errors.push({
      field: 'anggota_id',
      message: `${PENGAKHIRAN_FIELD_LABELS.anggota_id} wajib dipilih.`,
    });
  }

  // Alasan — wajib & harus nilai yang dikenal
  if (!alasan) {
    errors.push({
      field: 'alasan',
      message: `${PENGAKHIRAN_FIELD_LABELS.alasan} wajib dipilih.`,
    });
  } else if (!ALASAN_PENGAKHIRAN_OPTIONS.some((o) => o.value === alasan)) {
    errors.push({
      field: 'alasan',
      message: `${PENGAKHIRAN_FIELD_LABELS.alasan} tidak valid.`,
    });
  }

  // Keterangan alasan — wajib bila alasan 'lainnya'
  if (alasan === 'lainnya' && !keteranganAlasan) {
    errors.push({
      field: 'keterangan_alasan',
      message: `${PENGAKHIRAN_FIELD_LABELS.keterangan_alasan} wajib diisi bila alasan "Lainnya".`,
    });
  }

  // Tanggal Efektif Berhenti — wajib, format valid, tidak masa depan
  if (!input.tanggal_efektif_berhenti || !input.tanggal_efektif_berhenti.trim()) {
    errors.push({
      field: 'tanggal_efektif_berhenti',
      message: `${PENGAKHIRAN_FIELD_LABELS.tanggal_efektif_berhenti} wajib diisi.`,
    });
  } else if (!tanggalEfektif) {
    errors.push({
      field: 'tanggal_efektif_berhenti',
      message: `${PENGAKHIRAN_FIELD_LABELS.tanggal_efektif_berhenti} harus berupa tanggal yang valid (YYYY-MM-DD).`,
    });
  } else if (isPengakhiranFutureDate(input.tanggal_efektif_berhenti)) {
    errors.push({
      field: 'tanggal_efektif_berhenti',
      message: `${PENGAKHIRAN_FIELD_LABELS.tanggal_efektif_berhenti} tidak boleh di masa depan.`,
    });
  }

  // Nomor Dokumen — wajib, panjang, dan karakter diizinkan
  if (!nomorDokumen) {
    errors.push({
      field: 'nomor_dokumen',
      message: `${PENGAKHIRAN_FIELD_LABELS.nomor_dokumen} wajib diisi.`,
    });
  } else if (
    nomorDokumen.length < NOMOR_DOKUMEN_PENGAKHIRAN_MIN_LENGTH ||
    nomorDokumen.length > NOMOR_DOKUMEN_PENGAKHIRAN_MAX_LENGTH
  ) {
    errors.push({
      field: 'nomor_dokumen',
      message: `${PENGAKHIRAN_FIELD_LABELS.nomor_dokumen} harus ${NOMOR_DOKUMEN_PENGAKHIRAN_MIN_LENGTH}-${NOMOR_DOKUMEN_PENGAKHIRAN_MAX_LENGTH} karakter.`,
    });
  } else if (!NOMOR_DOKUMEN_PENGAKHIRAN_PATTERN.test(nomorDokumen)) {
    errors.push({
      field: 'nomor_dokumen',
      message: `${PENGAKHIRAN_FIELD_LABELS.nomor_dokumen} hanya boleh berisi huruf, angka, spasi, dan karakter . / _ - ( ).`,
    });
  }

  // Tanggal Dokumen — wajib & format valid
  if (!input.tanggal_dokumen || !input.tanggal_dokumen.trim()) {
    errors.push({
      field: 'tanggal_dokumen',
      message: `${PENGAKHIRAN_FIELD_LABELS.tanggal_dokumen} wajib diisi.`,
    });
  } else if (!tanggalDokumen) {
    errors.push({
      field: 'tanggal_dokumen',
      message: `${PENGAKHIRAN_FIELD_LABELS.tanggal_dokumen} harus berupa tanggal yang valid (YYYY-MM-DD).`,
    });
  }

  // Urutan tanggal: dokumen diterbitkan sebelum/pada tanggal efektif berhenti.
  if (tanggalEfektif && tanggalDokumen && tanggalDokumen.getTime() > tanggalEfektif.getTime()) {
    errors.push({
      field: 'tanggal_dokumen',
      message: `${PENGAKHIRAN_FIELD_LABELS.tanggal_dokumen} tidak boleh lebih akhir dari ${PENGAKHIRAN_FIELD_LABELS.tanggal_efektif_berhenti}.`,
    });
  }

  return errors;
}

/** Gabungkan seluruh error validasi menjadi satu pesan (untuk pesan API). */
export function formatPengakhiranValidationErrors(errors: PengakhiranValidationError[]): string {
  return errors.map((e) => e.message).join(' ');
}

/** Error untuk satu field (untuk menampilkan pesan inline di form). */
export function getPengakhiranFieldError(
  errors: PengakhiranValidationError[],
  field: PengakhiranFormField,
): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}
