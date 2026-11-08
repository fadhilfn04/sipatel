/**
 * Pengakhiran Keanggotaan — service registrasi pengakhiran & sinkronisasi status.
 *
 * Dipakai oleh:
 *  - app/api/pengakhiran-keanggotaan            (GET list / POST create)
 *  - app/api/pengakhiran-keanggotaan/[id]       (GET / PATCH)
 *  - app/api/anggota/[id]/pengakhiran           (lookup status)
 *
 * Tabel: pengakhiran_keanggotaan (migration 032).
 *
 * Aturan penting:
 *  - Data anggota TIDAK dihapus saat berhenti.
 *  - Saat pengajuan disetujui (disetujui_pp), anggota.status_keanggotaan
 *    disinkronkan ke 'berhenti' (idempotent).
 */

import { supabaseAdmin } from '@/lib/supabase-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PENGAKHIRAN_ACTIVE_STATUSES } from '@/lib/workflow/pengakhiran-keanggotaan-status';

/** Kolom relasi anggota yang disertakan pada query pengakhiran_keanggotaan. */
export const PENGAKHIRAN_ANGGOTA_SELECT =
  'id, nik, nama_anggota, nama_cabang, kode_cabang, kategori_anggota, status_anggota, status_keanggotaan, status_mps';

/** Select string untuk GET list/detail (pengakhiran_keanggotaan + relasi anggota). */
export const PENGAKHIRAN_WITH_ANGGOTA_SELECT = `*, anggota:anggota_id(${PENGAKHIRAN_ANGGOTA_SELECT})`;

/**
 * Sinkronkan status keanggotaan anggota menjadi 'berhenti' bila belum.
 * Idempotent: baris yang sudah 'berhenti' tidak di-update (audit tidak spam).
 */
export async function markAnggotaBerhenti(
  anggotaId: string,
  client?: SupabaseClient,
): Promise<{ updated: boolean; error?: string }> {
  const db = client ?? supabaseAdmin;
  if (!db) {
    return { updated: false, error: 'Supabase admin client not configured' };
  }

  const { error } = await db
    .from('anggota')
    .update({ status_keanggotaan: 'berhenti', updated_at: new Date().toISOString() })
    .eq('id', anggotaId)
    .is('deleted_at', null)
    .neq('status_keanggotaan', 'berhenti');

  if (error) {
    console.error('Gagal sinkronisasi status keanggotaan berhenti:', error.message);
    return { updated: false, error: error.message };
  }

  return { updated: true };
}

/**
 * Apakah anggota sudah memiliki pengajuan pengakhiran aktif (menunggu /
 * diverifikasi_pc)? `excludeId` dipakai saat update agar record sendiri tidak
 * dianggap duplikat.
 */
export async function hasActivePengakhiran(
  anggotaId: string,
  excludeId?: string,
): Promise<boolean> {
  if (!supabaseAdmin || !anggotaId) return false;

  let query = supabaseAdmin
    .from('pengakhiran_keanggotaan')
    .select('id')
    .eq('anggota_id', anggotaId)
    .is('deleted_at', null)
    .in('status', PENGAKHIRAN_ACTIVE_STATUSES as readonly string[]);

  if (excludeId) query = query.neq('id', excludeId);

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Gagal memeriksa pengajuan pengakhiran aktif:', error.message);
    return true; // fail-safe: anggap sudah ada agar tidak membuat duplikat
  }

  return !!data;
}

/** Apakah anggota sudah final berhenti (ada pengakhiran disetujui)? */
export async function hasFinalPengakhiran(anggotaId: string): Promise<boolean> {
  if (!supabaseAdmin || !anggotaId) return false;

  const { data, error } = await supabaseAdmin
    .from('pengakhiran_keanggotaan')
    .select('id')
    .eq('anggota_id', anggotaId)
    .eq('status', 'disetujui_pp')
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    console.error('Gagal memeriksa pengakhiran final:', error.message);
    return true; // fail-safe
  }

  return !!data;
}

/** Apakah anggota memiliki pengajuan Mutasi Cabang yang masih berjalan? */
export async function hasActiveMutasiForAnggota(anggotaId: string): Promise<boolean> {
  if (!supabaseAdmin || !anggotaId) return false;

  const { data, error } = await supabaseAdmin
    .from('pengajuan_mutasi_cabang')
    .select('id')
    .eq('anggota_id', anggotaId)
    .in('status', ['menunggu', 'diverifikasi_pc'])
    .maybeSingle();

  if (error) {
    console.error('Gagal memeriksa mutasi aktif:', error.message);
    return true; // fail-safe
  }

  return !!data;
}

/**
 * Apakah anggota memiliki pengajuan Dana Kematian yang belum selesai/batal?
 * Status blocking: semua kecuali batal, selesai, ditolak.
 */
export async function hasBlockingDakemForAnggota(anggotaId: string): Promise<boolean> {
  if (!supabaseAdmin || !anggotaId) return false;

  const { data, error } = await supabaseAdmin
    .from('dana_kematian')
    .select('id')
    .eq('anggota_id', anggotaId)
    .is('deleted_at', null)
    .not('status_proses', 'in', '(batal,selesai,ditolak)')
    .limit(1);

  if (error) {
    console.error('Gagal memeriksa transaksi Dana Kematian:', error.message);
    return true; // fail-safe
  }

  return (data || []).length > 0;
}
