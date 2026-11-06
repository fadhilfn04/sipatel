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
