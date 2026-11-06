/**
 * Perubahan Kepengurusan — Validasi Form Pengajuan
 *
 * Prinsip: anggota wajib dipilih, jenis & jabatan wajib, tanggal mulai tidak
 * boleh di masa depan (konsisten dengan pengakhiran keanggotaan), nomor SK
 * wajib (min. 3 karakter) & tanggal SK tidak boleh melewati tanggal mulai,
 * serta alasan/catatan pengajuan wajib (min. 10 karakter).
 *
 * Dipakai bersama oleh frontend (UX) dan backend (source of truth).
 * Tabel tujuan: anggota_kepengurusan (migration 033).
 */

import type { KepengurusanJenis } from '@/lib/supabase';
import {
  isPosisiKepengurusanValid,
  POSISI_NETRAL,
  JABATAN_STRUKTURAL_OPTIONS,
} from '@/lib/anggota-kepengurusan';

export type KepengurusanFormField =
  | 'anggota_id'
  | 'jenis'
  | 'jabatan'
  | 'periode'
  | 'tanggal_mulai'
  | 'tanggal_selesai'
  | 'nomor_sk'
  | 'tanggal_sk'
  | 'catatan_pengaju'
  | 'keterangan';

export interface KepengurusanInput {
  anggota_id?: string | null;
  jenis?: string | null;
  jabatan?: string | null;
  periode?: string | null;
  tanggal_mulai?: string | null;
  tanggal_selesai?: string | null;
  nomor_sk?: string | null;
  tanggal_sk?: string | null;
  catatan_pengaju?: string | null;
  keterangan?: string | null;
}

export interface KepengurusanValidationError {
  field: KepengurusanFormField;
  message: string;
}

export const KEPENGURUSAN_FIELD_LABELS: Record<KepengurusanFormField, string> = {
  anggota_id: 'Anggota (NIK)',
  jenis: 'Jenis Perubahan',
  jabatan: 'Jabatan',
  periode: 'Periode',
  tanggal_mulai: 'Tanggal Mulai Jabatan',
  tanggal_selesai: 'Tanggal Selesai Jabatan',
  nomor_sk: 'Nomor SK',
  tanggal_sk: 'Tanggal SK',
  catatan_pengaju: 'Alasan / Catatan Pengajuan',
  keterangan: 'Keterangan Tambahan',
};

export const JENIS_KEPENGURUSAN_OPTIONS: { value: KepengurusanJenis; label: string }[] = [
  { value: 'angkat', label: 'Angkat / Tetapkan Jabatan' },
  { value: 'pindah', label: 'Pindah Jabatan' },
  { value: 'berhentikan', label: 'Berhentikan Jabatan' },
];

/** Nomor SK: 3–100 karakter; huruf, angka, spasi, dan ./_-() */
export const NOMOR_SK_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ./_()-]*$/;
export const NOMOR_SK_MAX_LENGTH = 100;
export const NOMOR_SK_MIN_LENGTH = 3;

/** Alasan/catatan pengajuan min. 10 karakter. */
export const CATATAN_PENGAJU_MIN_LENGTH = 10;
export const CATATAN_PENGAJU_MAX_LENGTH = 1000;

/** Opsi jabatan struktur (tanpa 'Anggota') untuk form. */
export const JABATAN_FORM_OPTIONS = JABATAN_STRUKTURAL_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

/** Parse 'YYYY-MM-DD' dan pastikan tanggal benar-benar valid di kalender. */
export function parseKepengurusanDateOnly(value: string | null | undefined): Date | null {
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
export function isKepengurusanFutureDate(value: string | null | undefined): boolean {
  const date = parseKepengurusanDateOnly(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() > today.getTime();
}

export function validateKepengurusanInput(input: KepengurusanInput): KepengurusanValidationError[] {
  const errors: KepengurusanValidationError[] = [];

  const jenis = (input.jenis || '').trim();
  const jabatanRaw = (input.jabatan || '').trim();
  const tanggalMulai = parseKepengurusanDateOnly(input.tanggal_mulai);
  const tanggalSelesai = parseKepengurusanDateOnly(input.tanggal_selesai);
  const tanggalSk = parseKepengurusanDateOnly(input.tanggal_sk);
  const nomorSk = (input.nomor_sk || '').trim();
  const periode = (input.periode || '').trim();
  const catatan = (input.catatan_pengaju || '').trim();
  const keterangan = (input.keterangan || '').trim();

  // Anggota — wajib
  if (!input.anggota_id || !String(input.anggota_id).trim()) {
    errors.push({ field: 'anggota_id', message: `${KEPENGURUSAN_FIELD_LABELS.anggota_id} wajib dipilih.` });
  }

  // Jenis perubahan — wajib & valid
  if (!jenis) {
    errors.push({ field: 'jenis', message: `${KEPENGURUSAN_FIELD_LABELS.jenis} wajib dipilih.` });
  } else if (!JENIS_KEPENGURUSAN_OPTIONS.some((o) => o.value === jenis)) {
    errors.push({ field: 'jenis', message: `${KEPENGURUSAN_FIELD_LABELS.jenis} tidak valid.` });
  }

  // Jabatan — untuk 'berhentikan' dipaksa 'Anggota' (server menetapkan);
  // selain itu wajib jabatan struktural kanonik.
  if (jenis !== 'berhentikan') {
    if (!jabatanRaw) {
      errors.push({ field: 'jabatan', message: `${KEPENGURUSAN_FIELD_LABELS.jabatan} wajib dipilih.` });
    } else if (!isPosisiKepengurusanValid(jabatanRaw)) {
      errors.push({
        field: 'jabatan',
        message: `${KEPENGURUSAN_FIELD_LABELS.jabatan} tidak valid. Pilihan: ${JABATAN_STRUKTURAL_OPTIONS.map((o) => o.label).join(', ')}.`,
      });
    } else if (jabatanRaw === POSISI_NETRAL) {
      errors.push({
        field: 'jabatan',
        message: `Pilih jabatan struktural (bukan "${POSISI_NETRAL}") untuk pengangkatan/perpindahan.`,
      });
    }
  }

  // Periode — opsional, max 50 karakter
  if (periode.length > 50) {
    errors.push({ field: 'periode', message: `${KEPENGURUSAN_FIELD_LABELS.periode} maksimal 50 karakter.` });
  }

  // Tanggal mulai — wajib, format valid, tidak masa depan
  if (!input.tanggal_mulai || !String(input.tanggal_mulai).trim()) {
    errors.push({ field: 'tanggal_mulai', message: `${KEPENGURUSAN_FIELD_LABELS.tanggal_mulai} wajib diisi.` });
  } else if (!tanggalMulai) {
    errors.push({ field: 'tanggal_mulai', message: `${KEPENGURUSAN_FIELD_LABELS.tanggal_mulai} harus berupa tanggal yang valid (YYYY-MM-DD).` });
  } else if (isKepengurusanFutureDate(input.tanggal_mulai)) {
    errors.push({ field: 'tanggal_mulai', message: `${KEPENGURUSAN_FIELD_LABELS.tanggal_mulai} tidak boleh di masa depan.` });
  }

  // Tanggal selesai — opsional; jika diisi harus valid & setelah tanggal mulai
  if (input.tanggal_selesai && String(input.tanggal_selesai).trim()) {
    if (!tanggalSelesai) {
      errors.push({ field: 'tanggal_selesai', message: `${KEPENGURUSAN_FIELD_LABELS.tanggal_selesai} harus berupa tanggal yang valid (YYYY-MM-DD).` });
    } else if (tanggalMulai && tanggalSelesai.getTime() <= tanggalMulai.getTime()) {
      errors.push({ field: 'tanggal_selesai', message: `${KEPENGURUSAN_FIELD_LABELS.tanggal_selesai} harus setelah ${KEPENGURUSAN_FIELD_LABELS.tanggal_mulai}.` });
    }
  }

  // Nomor SK — wajib, panjang, karakter diizinkan
  if (!nomorSk) {
    errors.push({ field: 'nomor_sk', message: `${KEPENGURUSAN_FIELD_LABELS.nomor_sk} wajib diisi.` });
  } else if (nomorSk.length < NOMOR_SK_MIN_LENGTH || nomorSk.length > NOMOR_SK_MAX_LENGTH) {
    errors.push({ field: 'nomor_sk', message: `${KEPENGURUSAN_FIELD_LABELS.nomor_sk} harus ${NOMOR_SK_MIN_LENGTH}-${NOMOR_SK_MAX_LENGTH} karakter.` });
  } else if (!NOMOR_SK_PATTERN.test(nomorSk)) {
    errors.push({ field: 'nomor_sk', message: `${KEPENGURUSAN_FIELD_LABELS.nomor_sk} hanya boleh berisi huruf, angka, spasi, dan karakter . / _ - ( ).` });
  }

  // Tanggal SK — wajib & format valid
  if (!input.tanggal_sk || !String(input.tanggal_sk).trim()) {
    errors.push({ field: 'tanggal_sk', message: `${KEPENGURUSAN_FIELD_LABELS.tanggal_sk} wajib diisi.` });
  } else if (!tanggalSk) {
    errors.push({ field: 'tanggal_sk', message: `${KEPENGURUSAN_FIELD_LABELS.tanggal_sk} harus berupa tanggal yang valid (YYYY-MM-DD).` });
  }

  // Urutan tanggal: SK diterbitkan sebelum/pada tanggal mulai jabatan.
  if (tanggalMulai && tanggalSk && tanggalSk.getTime() > tanggalMulai.getTime()) {
    errors.push({ field: 'tanggal_sk', message: `${KEPENGURUSAN_FIELD_LABELS.tanggal_sk} tidak boleh lebih akhir dari ${KEPENGURUSAN_FIELD_LABELS.tanggal_mulai}.` });
  }

  // Catatan pengajuan — wajib, min 10 karakter
  if (!catatan) {
    errors.push({ field: 'catatan_pengaju', message: `${KEPENGURUSAN_FIELD_LABELS.catatan_pengaju} wajib diisi.` });
  } else if (catatan.length < CATATAN_PENGAJU_MIN_LENGTH) {
    errors.push({ field: 'catatan_pengaju', message: `${KEPENGURUSAN_FIELD_LABELS.catatan_pengaju} minimal ${CATATAN_PENGAJU_MIN_LENGTH} karakter.` });
  } else if (catatan.length > CATATAN_PENGAJU_MAX_LENGTH) {
    errors.push({ field: 'catatan_pengaju', message: `${KEPENGURUSAN_FIELD_LABELS.catatan_pengaju} maksimal ${CATATAN_PENGAJU_MAX_LENGTH} karakter.` });
  }

  // Keterangan — opsional, max 500
  if (keterangan.length > 500) {
    errors.push({ field: 'keterangan', message: `${KEPENGURUSAN_FIELD_LABELS.keterangan} maksimal 500 karakter.` });
  }

  return errors;
}

/** Gabungkan seluruh error validasi menjadi satu pesan (untuk pesan API). */
export function formatKepengurusanValidationErrors(errors: KepengurusanValidationError[]): string {
  return errors.map((e) => e.message).join(' ');
}

/** Error untuk satu field (untuk menampilkan pesan inline di form). */
export function getKepengurusanFieldError(
  errors: KepengurusanValidationError[],
  field: KepengurusanFormField,
): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}

