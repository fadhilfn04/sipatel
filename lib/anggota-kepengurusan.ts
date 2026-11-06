/**
 * Perubahan Kepengurusan (Keanggotaan) — daftar jabatan kanonik.
 *
 * Satu sumber kebenaran untuk nilai `posisi_kepengurusan` / `jabatan`
 * (menghapus drift antara form yang hanya mengenal `anggota`/`pengurus`
 * dan tabel yang menampilkan `Ketua`/`Wakil Ketua`/dst — lihat
 * docs/perubahan-kepengurusan-audit.md §3.2 & §7.3).
 *
 * Dipakai oleh:
 *  - app/(protected)/keanggotaan/perubahan-kepengurusan/page.tsx (form + riwayat)
 *  - lib/utils/kepengurusan-validation.ts (validasi nilai jabatan)
 *  - app/api/anggota-kepengurusan/* (validasi server)
 *
 * Catatan: 'Anggota' adalah nilai netral (bukan jabatan struktural) —
 * dipakai sebagai posisi tujuan saat pemberhentian jabatan.
 */

export type PosisiBadgeVariant = 'success' | 'warning' | 'destructive' | 'secondary';

export interface PosisiKepengurusanOption {
  /** Nilai yang disimpan ke DB (anggota_kepengurusan.jabatan / anggota.posisi_kepengurusan). */
  value: string;
  /** Label tampilan. */
  label: string;
  /** Variant badge (selaras map lama di pengelolaan-data/page.tsx). */
  variant: PosisiBadgeVariant;
}

/**
 * Daftar jabatan kanonik. Urutan = urutan hierarki umum.
 * Final: dokumen audit §13-Q1 (rekomendasi awal — dapat direvisi klien).
 */
export const POSISI_KEPENGURUSAN_OPTIONS: PosisiKepengurusanOption[] = [
  { value: 'Ketua', label: 'Ketua', variant: 'success' },
  { value: 'Wakil Ketua', label: 'Wakil Ketua', variant: 'warning' },
  { value: 'Sekretaris', label: 'Sekretaris', variant: 'warning' },
  { value: 'Bendahara', label: 'Bendahara', variant: 'warning' },
  { value: 'Pengurus', label: 'Pengurus', variant: 'secondary' },
  { value: 'Anggota', label: 'Anggota', variant: 'secondary' },
];

/** Seluruh nilai kanonik (untuk validasi). */
export const POSISI_KEPENGURUSAN_VALUES: readonly string[] =
  POSISI_KEPENGURUSAN_OPTIONS.map((o) => o.value);

/** Nilai netral — dipakai saat pemberhentian jabatan. */
export const POSISI_NETRAL = 'Anggota';

/**
 * Alasan pemberhentian pengurus — nilai kanonik (migration 034).
 *
 * Disimpan di `anggota_kepengurusan.alasan_pemberhentian` dan hanya relevan
 * untuk baris dengan `jenis='berhentikan'`. Dipakai form Pemberhentian Pengurus,
 * form Perubahan Kepengurusan (mode berhentikan), validasi API, dan tampilan riwayat.
 */
export type AlasanPemberhentianValue =
  | 'habis_masa_jabatan'
  | 'mengundurkan_diri'
  | 'diberhentikan'
  | 'lainnya';

export interface AlasanPemberhentianOption {
  value: AlasanPemberhentianValue;
  label: string;
}

export const ALASAN_PEMBERHENTIAN_OPTIONS: AlasanPemberhentianOption[] = [
  { value: 'habis_masa_jabatan', label: 'Habis Masa Jabatan / Periode' },
  { value: 'mengundurkan_diri', label: 'Mengundurkan Diri dari Jabatan' },
  { value: 'diberhentikan', label: 'Diberhentikan oleh Organisasi' },
  { value: 'lainnya', label: 'Lainnya' },
];

/** Seluruh nilai kanonik alasan (untuk validasi). */
export const ALASAN_PEMBERHENTIAN_VALUES: readonly string[] =
  ALASAN_PEMBERHENTIAN_OPTIONS.map((o) => o.value);

/** Alasan yang mewajibkan keterangan penjelasan. */
export const ALASAN_PEMBERHENTIAN_LAINNYA = 'lainnya';

/** Alasan yang mewajibkan dokumen SK pemberhentian. */
export const ALASAN_PEMBERHENTIAN_DOKUMEN = 'diberhentikan';

/** Apakah nilai termasuk daftar alasan kanonik? */
export function isAlasanPemberhentianValid(
  alasan: string | null | undefined,
): boolean {
  if (!alasan) return false;
  return ALASAN_PEMBERHENTIAN_VALUES.includes(alasan);
}

/** Label tampilan untuk sebuah alasan (fallback: nilai mentah / '-'). */
export function getAlasanPemberhentianLabel(alasan: string | null | undefined): string {
  if (!alasan) return '-';
  const found = ALASAN_PEMBERHENTIAN_OPTIONS.find((o) => o.value === alasan);
  return found ? found.label : alasan;
}

/** Opsi jabatan struktural untuk form angkat/pindah (tanpa 'Anggota'). */
export const JABATAN_STRUKTURAL_OPTIONS: PosisiKepengurusanOption[] =
  POSISI_KEPENGURUSAN_OPTIONS.filter((o) => o.value !== POSISI_NETRAL);

/** Apakah nilai termasuk daftar kanonik? */
export function isPosisiKepengurusanValid(posisi: string | null | undefined): boolean {
  if (!posisi) return false;
  return POSISI_KEPENGURUSAN_VALUES.includes(posisi);
}

/** Props badge untuk sebuah posisi (label + variant). */
export function getPosisiKepengurusanProps(
  posisi: string | null | undefined,
): { label: string; variant: PosisiBadgeVariant } {
  if (!posisi) return { label: '-', variant: 'secondary' };
  const found = POSISI_KEPENGURUSAN_OPTIONS.find((o) => o.value === posisi);
  return found
    ? { label: found.label, variant: found.variant }
    : { label: posisi, variant: 'secondary' };
}
