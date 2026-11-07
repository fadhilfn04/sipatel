/**
 * Penggantian Rekening (Keanggotaan) — modul bersama client & server.
 *
 * Isi: allowlist field rekening yang boleh diubah, tipe payload, schema
 * validasi (zod), aturan nama pemilik rekening, util diff rekening lama→baru,
 * dan builder update rekening aktif pada tabel anggota.
 *
 * Dipakai oleh:
 *  - app/(protected)/keanggotaan/penggantian-rekening/page.tsx (validasi client + diff)
 *  - components/anggota/PenggantianRekeningForm.tsx (form rekening baru)
 *  - app/api/anggota/[id]/penggantian-rekening (validasi server + approval)
 *  - app/api/anggota/approvals/[id] (apply usulan jenis 'rekening')
 *
 * Model data:
 *  - Rekening AKTIF tetap tersimpan pada tabel `anggota` (single source of truth:
 *    nama_bank, norek_bank, nama_pemilik_rekening).
 *  - Histori setiap penggantian tersimpan append-only pada `anggota_rekening`
 *    (migration 035) — rekening lama tidak pernah hilang.
 *  - Approval memakai `anggota_perubahan` jenis 'rekening' (jangan buat tabel
 *    approval baru).
 *
 * Desain: docs/penggantian-rekening-audit.md
 */

import { z } from 'zod';
import { computeFieldDiff } from './anggota-perubahan';

// ─────────────────────────────────────────────────────────────
// 1. ALLOWLIST — field rekening yang dikelola menu ini
// ─────────────────────────────────────────────────────────────

export const REKENING_EDITABLE_FIELDS = [
  'nama_bank',
  'norek_bank',
  'nama_pemilik_rekening',
] as const;

// ─────────────────────────────────────────────────────────────
// 2. TIPE
// ─────────────────────────────────────────────────────────────

/** Nilai form rekening baru (langkah 2 pada halaman). */
export interface PenggantianRekeningFormValues {
  nama_bank: string;
  kode_bank: string | null;
  norek_bank: string;
  nama_pemilik_rekening: string;
  tanggal_efektif: string;
  dokumen_pendukung: string;
}

/** Payload lengkap yang dikirim ke endpoint (form + alasan wajib). */
export interface PenggantianRekeningRequest
  extends PenggantianRekeningFormValues {
  alasan: string;
}

/** Baris histori pada tabel `anggota_rekening` (migration 035). */
export interface AnggotaRekeningHistory {
  id: string;
  anggota_id: string;
  nama_bank_lama: string | null;
  norek_bank_lama: string | null;
  nama_pemilik_rekening_lama: string | null;
  kode_bank: string | null;
  nama_bank: string;
  norek_bank: string;
  nama_pemilik_rekening: string;
  status: 'aktif' | 'non_aktif';
  tanggal_efektif: string;
  dokumen_pendukung: string | null;
  alasan: string | null;
  diajukan_oleh: string | null;
  disetujui_oleh: string | null;
  diputuskan_pada: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// 3. ATURAN NAMA PEMILIK REKENING
// ─────────────────────────────────────────────────────────────

/**
 * Aturan bisnis (default aman — docs/penggantian-rekening-audit.md §4.4):
 * nama pemilik rekening WAJIB sama dengan nama anggota untuk mencegah
 * penyalahgunaan (rekening pihak lain). Bila bisnis kelak mengizinkan rekening
 * pihak lain (ahli waris/kuasa), set flag ini ke false lalu aktifkan syarat
 * dokumen tambahan (surat kuasa) pada validasi & form.
 */
export const WAJIB_PEMILIK_SAMA_DENGAN_ANGGOTA = true;

/** Normalisasi perbandingan nama: rapatkan spasi + case-insensitive. */
export function normalizeNamaPemilik(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

/** Apakah nama pemilik rekening sesuai nama anggota (aturan §4.4)? */
export function isNamaPemilikSesuai(
  namaPemilik: string,
  namaAnggota: string,
): boolean {
  return (
    normalizeNamaPemilik(namaPemilik) === normalizeNamaPemilik(namaAnggota)
  );
}

// ─────────────────────────────────────────────────────────────
// 4. VALIDASI (zod)
// ─────────────────────────────────────────────────────────────

const rekeningBaseShape = {
  nama_bank: z
    .string()
    .trim()
    .min(1, 'Nama bank wajib dipilih')
    .max(100, 'Nama bank maksimal 100 karakter'),
  kode_bank: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.string().trim().max(10).nullable(),
  ),
  norek_bank: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.string().regex(/^\d{8,16}$/, 'Nomor rekening harus 8-16 digit angka'),
  ),
  nama_pemilik_rekening: z
    .string()
    .trim()
    .min(3, 'Nama pemilik rekening minimal 3 karakter')
    .max(255, 'Nama pemilik rekening maksimal 255 karakter'),
  tanggal_efektif: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  ),
  dokumen_pendukung: z
    .string()
    .trim()
    .min(1, 'Dokumen pendukung wajib diunggah')
    .max(500, 'URL dokumen maksimal 500 karakter'),
};

/** Validasi bentuk dasar (tanpa alasan) — dipakai langkah 2 halaman. */
const rekeningBaseObject = z.object(rekeningBaseShape).strict();

function refineRekeningRules<
  T extends { tanggal_efektif: string; dokumen_pendukung: string },
>(value: T, ctx: z.RefinementCtx) {
  const today = new Date().toISOString().slice(0, 10);
  if (value.tanggal_efektif < today) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tanggal_efektif'],
      message: 'Tanggal efektif tidak boleh di masa lalu',
    });
  }
  if (!/^https?:\/\/.+/.test(value.dokumen_pendukung)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dokumen_pendukung'],
      message:
        'Dokumen pendukung tidak valid — unggah lewat tombol unggah dokumen',
    });
  }
}

export const penggantianRekeningFormSchema = rekeningBaseObject.superRefine(
  (value, ctx) => refineRekeningRules(value, ctx),
);

export const penggantianRekeningRequestSchema = rekeningBaseObject
  .extend({
    alasan: z
      .string()
      .trim()
      .min(10, 'Alasan penggantian wajib diisi (minimal 10 karakter)')
      .max(1000, 'Alasan penggantian maksimal 1000 karakter'),
  })
  .strict()
  .superRefine((value, ctx) => refineRekeningRules(value, ctx));

// ─────────────────────────────────────────────────────────────
// 5. PARSE & VALIDASI (pesan ramah — pola anggota-perubahan.ts)
// ─────────────────────────────────────────────────────────────

export interface PenggantianRekeningParseResult<T> {
  ok: boolean;
  data?: T;
  errors: string[];
}

function collectErrorMessages(error: z.ZodError): string[] {
  const errors: string[] = [];
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') {
      const keys = (issue as unknown as { keys?: string[] }).keys ?? [];
      for (const key of keys) {
        errors.push(
          `Field '${key}' tidak dapat diubah melalui menu Penggantian Rekening.`,
        );
      }
    } else {
      const path = issue.path.join('.');
      errors.push(path ? `${path}: ${issue.message}` : issue.message);
    }
  }
  return errors;
}

export function safeParsePenggantianRekeningForm(
  input: unknown,
): PenggantianRekeningParseResult<PenggantianRekeningFormValues> {
  const result = penggantianRekeningFormSchema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data, errors: [] };
  }
  return { ok: false, errors: collectErrorMessages(result.error) };
}

export function safeParsePenggantianRekening(
  input: unknown,
): PenggantianRekeningParseResult<PenggantianRekeningRequest> {
  const result = penggantianRekeningRequestSchema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data, errors: [] };
  }
  return { ok: false, errors: collectErrorMessages(result.error) };
}

// ─────────────────────────────────────────────────────────────
// 6. DIFF (rekening lama vs baru — reuse computeFieldDiff)
// ─────────────────────────────────────────────────────────────

export function computeRekeningDiff(
  existing:
    | {
        nama_bank?: string | null;
        norek_bank?: string | null;
        nama_pemilik_rekening?: string | null;
      }
    | null
    | undefined,
  input: PenggantianRekeningFormValues,
) {
  return computeFieldDiff(
    existing as unknown as Record<string, unknown>,
    input as unknown as Record<string, unknown>,
    [...REKENING_EDITABLE_FIELDS],
  );
}

// ─────────────────────────────────────────────────────────────
// 7. PAYLOAD UPDATE REKENING AKTIF (tabel anggota)
// ─────────────────────────────────────────────────────────────

/**
 * Kolom rekening aktif pada tabel `anggota` yang ditulis saat penggantian
 * diterapkan. Hanya 3 kolom rekening — jangan menulis field lain dari sini.
 */
export function buildRekeningUpdatePayload(
  input: PenggantianRekeningFormValues,
): Record<string, unknown> {
  return {
    nama_bank: input.nama_bank,
    norek_bank: input.norek_bank,
    nama_pemilik_rekening: input.nama_pemilik_rekening,
    updated_at: new Date().toISOString(),
  };
}

