/**
 * Perubahan Data Pribadi (Keanggotaan) — modul bersama client & server.
 *
 * Isi: allowlist field yang boleh diubah, daftar field terproteksi (milik modul
 * lain), label field untuk tampilan diff, schema validasi (zod), util diff
 * data lama vs baru, dan payload builder partial-safe untuk UPDATE anggota.
 *
 * Dipakai oleh:
 *  - app/(protected)/keanggotaan/perubahan-data-pribadi/page.tsx (validasi client + diff)
 *  - components/anggota/PerubahanDataPribadiForm.tsx (prefill/label)
 *  - components/anggota/FieldDiffTable.tsx (tabel perbandingan)
 *  - components/anggota/AnggotaApprovalsModal.tsx (diff usulan)
 *  - app/api/anggota/[id]/perubahan-data (validasi server + allowlist)
 *  - app/api/anggota/approvals/[id] (apply usulan partial-safe)
 *
 * Pemilik proses bisnis terkait (JANGAN diubah dari sini):
 *  - Perpindahan cabang → menu Mutasi Cabang (pengajuan_mutasi_cabang)
 *  - Kematian → menu Data Meninggal Dunia (anggota_kematian)
 *  - Berhenti → menu Pengakhiran Keanggotaan (pengakhiran_keanggotaan)
 *  - Rekening bank → menu Penggantian Rekening (anggota_rekening) — lib/anggota-rekening.ts
 *  - NIK → Pewarisan NIK (nik_master/nik_kepemilikan) — lihat docs/perubahan-data-pribadi-audit.md
 */

import { z } from 'zod';
import type { UpdateAnggotaInput } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────
// 1. ALLOWLIST — field data pribadi yang BOLEH diubah
// ─────────────────────────────────────────────────────────────

export const PERSONAL_DATA_EDITABLE_FIELDS = [
  // Identitas pribadi
  'tempat_lahir',
  'tanggal_lahir',
  'jenis_kelamin',
  'agama',
  'golongan_darah',
  'status_perkawinan',
  'pasutri',
  // Alamat
  'alamat',
  'rt',
  'rw',
  'provinsi',
  'kota',
  'kecamatan',
  'kelurahan',
  'kode_pos',
  // Kontak
  'nomor_handphone',
  'nomor_telepon',
  'email',
  'sosial_media',
  // Nomor dokumen & data pensiun
  'e_ktp',
  'kartu_keluarga',
  'npwp',
  'sk_pensiun',
  'nomor_sk_pensiun',
  // BPJS (rekening bank dipindah ke menu Penggantian Rekening — lihat PROTECTED_FIELDS)
  'status_bpjs',
  'bpjs_kelas',
  'bpjs_insentif',
  // Datul & bantuan sosial
  'kategori_datul',
  'media_datul',
  'kategori_bantuan',
  'tanggal_terima_bantuan',
  'gambar_kondisi_tempat_tinggal',
] as const;

export type PersonalDataField = (typeof PERSONAL_DATA_EDITABLE_FIELDS)[number];

// ─────────────────────────────────────────────────────────────
// 2. FIELD TERPROTEKSI — tidak boleh diubah lewat Perubahan Data Pribadi
// ─────────────────────────────────────────────────────────────

/**
 * `nik`, `nama_anggota`, `kategori_anggota`, `status_anggota`, `status_mps`,
 * `status_iuran` = aturan bisnis inti (business_rule_documentation, migration 023).
 * `status_keanggotaan` = milik Pengakhiran Keanggotaan (migration 032).
 * `kode_cabang`, `nama_cabang`, `cabang_*`, `*_mutasi` = milik Mutasi Cabang.
 * Sisanya = kolom sistem / data organisasi.
 */
export const PROTECTED_FIELDS = [
  'id',
  'user_id',
  'created_at',
  'updated_at',
  'deleted_at',
  'nik',
  'nama_anggota',
  'kategori_anggota',
  'status_anggota',
  'status_mps',
  'status_iuran',
  'status_keanggotaan',
  'kode_cabang',
  'nama_cabang',
  'cabang_kelas',
  'cabang_area_regional',
  'cabang_area_witel',
  'posisi_kepengurusan',
  'status_kepesertaan',
  'besaran_iuran',
  'form_kesediaan_iuran',
  'alasan_mutasi',
  'tanggal_mutasi',
  'cabang_pengajuan_mutasi',
  'pusat_pengesahan_mutasi',
  'foto_anggota',
  'urutan_keluarga',
  // Rekening — milik menu Penggantian Rekening (jalur khusus dengan dokumen
  // pendukung, tanggal efektif, dan histori anggota_rekening). Lihat lib/anggota-rekening.ts.
  'nama_bank',
  'norek_bank',
  'nama_pemilik_rekening',
] as const;

// ─────────────────────────────────────────────────────────────
// 3. LABEL FIELD (untuk tampilan diff & approval)
// ─────────────────────────────────────────────────────────────

export const FIELD_LABELS: Record<string, string> = {
  nik: 'NIK',
  nama_anggota: 'Nama Lengkap',
  kategori_anggota: 'Kategori Anggota',
  status_anggota: 'Status Anggota',
  status_mps: 'Status MPS',
  status_iuran: 'Status Iuran',
  status_keanggotaan: 'Status Keanggotaan',
  status_kepesertaan: 'Status Kepesertaan',
  nama_cabang: 'Nama Cabang',
  kode_cabang: 'Kode Cabang',
  posisi_kepengurusan: 'Posisi Kepengurusan',
  cabang_kelas: 'Kelas Cabang',
  cabang_area_regional: 'Area Regional',
  cabang_area_witel: 'Area Witel',
  pasutri: 'Pasutri',
  status_perkawinan: 'Status Perkawinan',
  sk_pensiun: 'SK Pensiun',
  nomor_sk_pensiun: 'Nomor SK Pensiun',
  alamat: 'Alamat',
  rt: 'RT',
  rw: 'RW',
  kelurahan: 'Kelurahan/Desa',
  kecamatan: 'Kecamatan',
  kota: 'Kota/Kabupaten',
  provinsi: 'Provinsi',
  kode_pos: 'Kode Pos',
  nomor_handphone: 'Nomor Handphone',
  nomor_telepon: 'Nomor Telepon',
  email: 'Email',
  sosial_media: 'Sosial Media',
  e_ktp: 'Nomor E-KTP',
  kartu_keluarga: 'Nomor Kartu Keluarga',
  npwp: 'NPWP',
  tempat_lahir: 'Tempat Lahir',
  tanggal_lahir: 'Tanggal Lahir',
  jenis_kelamin: 'Jenis Kelamin',
  agama: 'Agama',
  golongan_darah: 'Golongan Darah',
  besaran_iuran: 'Besaran Iuran',
  form_kesediaan_iuran: 'Form Kesediaan Iuran',
  nama_bank: 'Nama Bank',
  norek_bank: 'Nomor Rekening',
  nama_pemilik_rekening: 'Nama Pemilik Rekening',
  kategori_bantuan: 'Kategori Bantuan',
  tanggal_terima_bantuan: 'Tanggal Terima Bantuan',
  gambar_kondisi_tempat_tinggal: 'Gambar Kondisi Tempat Tinggal',
  alasan_mutasi: 'Alasan Mutasi',
  tanggal_mutasi: 'Tanggal Mutasi',
  cabang_pengajuan_mutasi: 'Cabang Pengajuan Mutasi',
  pusat_pengesahan_mutasi: 'Pusat Pengesahan Mutasi',
  status_bpjs: 'Status BPJS',
  bpjs_kelas: 'Kelas BPJS',
  bpjs_insentif: 'Insentif BPJS',
  kategori_datul: 'Kategori Datul',
  media_datul: 'Media Datul',
};

/** Fallback label: `nomor_handphone` → "Nomor Handphone". */
export function humanizeField(field: string): string {
  return field
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getFieldLabel(field: string): string {
  return FIELD_LABELS[field] || humanizeField(field);
}

// ─────────────────────────────────────────────────────────────
// 4. VALIDASI (zod)
// ─────────────────────────────────────────────────────────────

const nullableText = (max: number) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.string().trim().max(max).nullable(),
  );

const nullableDate = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .nullable(),
);

const nullableEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.enum(values).nullable(),
  );

const personalDataShape = {
  tempat_lahir: nullableText(100),
  tanggal_lahir: nullableDate,
  jenis_kelamin: nullableEnum(['laki_laki', 'perempuan'] as const),
  agama: nullableEnum([
    'islam',
    'kristen',
    'katolik',
    'hindu',
    'buddha',
    'konghucu',
  ] as const),
  golongan_darah: nullableEnum(['A', 'B', 'AB', 'O'] as const),
  status_perkawinan: nullableEnum([
    'belum_kawin',
    'kawin',
    'cerai_hidup',
    'cerai_mati',
  ] as const),
  pasutri: nullableText(100),
  alamat: nullableText(500),
  rt: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z
      .string()
      .regex(/^\d{1,3}$/, 'RT harus maksimal 3 digit angka')
      .nullable(),
  ),
  rw: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z
      .string()
      .regex(/^\d{1,3}$/, 'RW harus maksimal 3 digit angka')
      .nullable(),
  ),
  provinsi: nullableText(100),
  kota: nullableText(100),
  kecamatan: nullableText(100),
  kelurahan: nullableText(100),
  kode_pos: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z
      .string()
      .regex(/^\d{5}$/, 'Kode pos harus 5 digit angka')
      .nullable(),
  ),
  nomor_handphone: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z
      .string()
      .regex(/^(\+62|62|0)8\d{8,12}$/, 'Nomor handphone tidak valid')
      .nullable(),
  ),
  nomor_telepon: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z
      .string()
      .regex(/^0\d{7,12}$/, 'Nomor telepon tidak valid (awali 0)')
      .nullable(),
  ),
  email: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.string().email('Format email tidak valid').nullable(),
  ),
  sosial_media: nullableText(100),
  e_ktp: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z
      .string()
      .regex(/^\d{16}$/, 'Nomor E-KTP harus 16 digit angka')
      .nullable(),
  ),
  kartu_keluarga: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z
      .string()
      .regex(/^\d{16}$/, 'Nomor Kartu Keluarga harus 16 digit angka')
      .nullable(),
  ),
  npwp: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z
      .string()
      .regex(/^\d{15}$/, 'NPWP harus 15 digit angka')
      .nullable(),
  ),
  sk_pensiun: nullableEnum(['ada', 'tidak_ada'] as const),
  nomor_sk_pensiun: nullableText(120),
  status_bpjs: z.boolean().nullable().optional(),
  bpjs_kelas: nullableText(10),
  bpjs_insentif: z.boolean().nullable().optional(),
  kategori_datul: nullableText(50),
  media_datul: nullableText(50),
  kategori_bantuan: nullableText(50),
  tanggal_terima_bantuan: nullableDate,
  gambar_kondisi_tempat_tinggal: nullableText(500),
};

const personalDataObjectSchema = z
  .object(personalDataShape)
  .strict()
  .superRefine((value, ctx) => {
    const today = new Date().toISOString().slice(0, 10);
    if (value.tanggal_lahir && value.tanggal_lahir > today) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tanggal_lahir'],
        message: 'Tanggal lahir tidak boleh di masa depan',
      });
    }
    if (value.tanggal_terima_bantuan && value.tanggal_terima_bantuan > today) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tanggal_terima_bantuan'],
        message: 'Tanggal terima bantuan tidak boleh di masa depan',
      });
    }
  });

export const perubahanDataPribadiRequestSchema = z.object({
  perubahan: personalDataObjectSchema,
  alasan: z
    .string()
    .trim()
    .min(10, 'Alasan perubahan wajib diisi (minimal 10 karakter)')
    .max(1000, 'Alasan perubahan maksimal 1000 karakter'),
});

// ─────────────────────────────────────────────────────────────
// 5. PARSE & VALIDASI (pesan ramah)
// ─────────────────────────────────────────────────────────────

export interface PerubahanParseResult {
  ok: boolean;
  changes?: UpdateAnggotaInput;
  alasan?: string;
  errors: string[];
}

/** Hanya ambil field yang benar-benar dikirim klien (bukan seluruh shape). */
function extractProvidedChanges(
  raw: Record<string, unknown>,
  parsed: Record<string, unknown>,
): UpdateAnggotaInput {
  const changes: Record<string, unknown> = {};
  const allowed = PERSONAL_DATA_EDITABLE_FIELDS as readonly string[];
  for (const key of Object.keys(raw)) {
    if (allowed.includes(key)) {
      changes[key] = parsed[key];
    }
  }
  return changes as UpdateAnggotaInput;
}

export function safeParsePerubahanDataPribadi(
  input: unknown,
): PerubahanParseResult {
  const result = perubahanDataPribadiRequestSchema.safeParse(input);

  if (result.success) {
    const raw =
      (input as { perubahan?: Record<string, unknown> })?.perubahan ?? {};
    const changes = extractProvidedChanges(
      raw,
      result.data.perubahan as Record<string, unknown>,
    );
    return { ok: true, changes, alasan: result.data.alasan, errors: [] };
  }

  const errors: string[] = [];
  for (const issue of result.error.issues) {
    if (issue.code === 'unrecognized_keys') {
      const keys = (issue as { keys?: string[] }).keys ?? [];
      for (const key of keys) {
        errors.push(
          `Field '${key}' tidak dapat diubah melalui menu Perubahan Data Pribadi.`,
        );
      }
    } else {
      const path = issue.path.join('.');
      errors.push(path ? `${path}: ${issue.message}` : issue.message);
    }
  }
  return { ok: false, errors };
}

// ─────────────────────────────────────────────────────────────
// 6. DIFF (data lama vs baru)
// ─────────────────────────────────────────────────────────────

export interface FieldChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

/** Normalisasi untuk perbandingan: null/undefined/'' dianggap sama. */
function normalizeComparable(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value).trim();
}

export function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
  return String(value);
}

export function computeFieldDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  fields?: string[],
): FieldChange[] {
  const keys =
    fields ?? Object.keys(after ?? {}).filter((k) => !k.startsWith('__'));
  const changes: FieldChange[] = [];

  for (const key of keys) {
    const b = before?.[key];
    const a = after?.[key];
    if (normalizeComparable(b) === normalizeComparable(a)) continue;
    changes.push({
      field: key,
      label: getFieldLabel(key),
      before: b,
      after: a,
    });
  }

  return changes;
}

// ─────────────────────────────────────────────────────────────
// 7. PAYLOAD UPDATE (partial-safe)
// ─────────────────────────────────────────────────────────────

/**
 * Kolom yang bila bernilai string kosong harus dianggap null (opsional).
 * Daftar ini menyalin normalisasi yang ada di `buildAnggotaUpdatePayload`.
 */
const NULLABLE_ON_EMPTY = new Set([
  'alamat',
  'rt',
  'rw',
  'kelurahan',
  'kecamatan',
  'provinsi',
  'kota',
  'kode_pos',
  'nomor_handphone',
  'nomor_telepon',
  'email',
  'sosial_media',
  'e_ktp',
  'kartu_keluarga',
  'npwp',
  'tempat_lahir',
  'tanggal_lahir',
  'jenis_kelamin',
  'agama',
  'golongan_darah',
  'pasutri',
  'status_perkawinan',
  'sk_pensiun',
  'nomor_sk_pensiun',
  'status_kepesertaan',
  'cabang_kelas',
  'cabang_area_regional',
  'cabang_area_witel',
  'nama_bank',
  'norek_bank',
  'kategori_bantuan',
  'tanggal_terima_bantuan',
  'gambar_kondisi_tempat_tinggal',
  'alasan_mutasi',
  'tanggal_mutasi',
  'cabang_pengajuan_mutasi',
  'pusat_pengesahan_mutasi',
  'bpjs_kelas',
  'kategori_datul',
  'media_datul',
]);

/**
 * Builder update yang HANYA menyertakan key yang dikirim (tidak men-null-kan
 * kolom yang tidak disertakan). Dipakai untuk usulan perubahan data pribadi
 * (payload partial) dan apply approval edit (aman untuk payload parsial).
 *
 * Berbeda dari `buildAnggotaUpdatePayload` yang menulis seluruh field — sehingga
 * kurang aman untuk payload parsial karena akan men-null-kan field yang tidak ikut.
 */
export function buildAnggotaPartialUpdatePayload(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    if (key === 'alasan_perubahan' || key === '__partial') continue;
    if (value === '' && NULLABLE_ON_EMPTY.has(key)) {
      payload[key] = null;
    } else {
      payload[key] = value;
    }
  }
  payload.updated_at = new Date().toISOString();
  return payload;
}
