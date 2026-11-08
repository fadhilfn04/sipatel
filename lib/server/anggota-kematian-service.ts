/**
 * Entry Data Meninggal Dunia — service registrasi fakta kematian anggota.
 *
 * Dipakai oleh:
 *  - app/api/anggota-kematian            (GET list / POST create)
 *  - app/api/anggota-kematian/[id]       (GET / PUT / DELETE)
 *  - app/api/anggota/[id]/kematian       (lookup untuk prefill Dana Kematian)
 *
 * Tabel: anggota_kematian (migration 031) — satu fakta kematian per anggota.
 *
 * Aturan penting:
 *  - Entry kematian TIDAK PERNAH membuat baris dana_kematian.
 *  - Setelah entry tersimpan, anggota.status_anggota disinkronkan ke
 *    'meninggal' (idempotent — anggota yang sudah meninggal tidak disentuh).
 */

import { supabaseAdmin } from '@/lib/supabase-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Kolom relasi anggota yang disertakan pada query anggota_kematian. */
export const ANGGOTA_KEMATIAN_ANGGOTA_SELECT =
  'id, nik, nama_anggota, nama_cabang, kode_cabang, kategori_anggota, status_anggota, status_mps';

/** Select string untuk GET list/detail (anggota_kematian + relasi anggota). */
export const ANGGOTA_KEMATIAN_WITH_ANGGOTA_SELECT = `*, anggota:anggota_id(${ANGGOTA_KEMATIAN_ANGGOTA_SELECT})`;

/**
 * Sinkronkan status anggota menjadi 'meninggal' bila belum.
 * Idempotent: baris yang sudah berstatus 'meninggal' tidak di-update
 * (updated_at anggota tidak ikut berubah, audit history tidak spam).
 */
export async function markAnggotaMeninggal(
  anggotaId: string,
  client?: SupabaseClient,
): Promise<{ updated: boolean; error?: string }> {
  const db = client ?? supabaseAdmin;
  if (!db) {
    return { updated: false, error: 'Supabase admin client not configured' };
  }

  const { error } = await db
    .from('anggota')
    .update({ status_anggota: 'meninggal', updated_at: new Date().toISOString() })
    .eq('id', anggotaId)
    .is('deleted_at', null)
    .neq('status_anggota', 'meninggal');

  if (error) {
    console.error('Gagal sinkronisasi status anggota meninggal:', error.message);
    return { updated: false, error: error.message };
  }

  return { updated: true };
}

/**
 * Apakah anggota sudah memiliki data kematian aktif (belum dihapus)?
 * `excludeId` dipakai saat update agar record sendiri tidak dianggap duplikat.
 */
export async function hasActiveAnggotaKematian(
  anggotaId: string,
  excludeId?: string,
): Promise<boolean> {
  if (!supabaseAdmin || !anggotaId) return false;

  let query = supabaseAdmin
    .from('anggota_kematian')
    .select('id')
    .eq('anggota_id', anggotaId)
    .is('deleted_at', null);

  if (excludeId) query = query.neq('id', excludeId);

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Gagal memeriksa data kematian anggota:', error.message);
    return true; // fail-safe: anggap sudah ada agar tidak membuat duplikat
  }

  return !!data;
}
