/**
 * Perubahan Kepengurusan — service registrasi perubahan jabatan & sinkronisasi.
 *
 * Dipakai oleh:
 *  - app/api/anggota-kepengurusan            (GET list / POST create)
 *  - app/api/anggota-kepengurusan/[id]       (GET / PATCH)
 *  - app/api/anggota/[id]/kepengurusan       (lookup riwayat per anggota)
 *
 * Tabel: anggota_kepengurusan (migration 033).
 *
 * Aturan penting:
 *  - Data anggota TIDAK dihapus.
 *  - Saat disetujui (disetujui_pp), jabatan aktif lama ditutup lalu
 *    anggota.posisi_kepengurusan disinkronkan (idempotent).
 *  - status_anggota / status_keanggotaan / kategori_anggota TIDAK diubah.
 */

import { supabaseAdmin } from '@/lib/supabase-storage';

/** Kolom relasi anggota yang disertakan pada query anggota_kepengurusan. */
export const KEPENGURUSAN_ANGGOTA_SELECT =
  'id, nik, nama_anggota, nama_cabang, kode_cabang, status_anggota, status_keanggotaan, posisi_kepengurusan';

/** Select string untuk GET list/detail (anggota_kepengurusan + relasi anggota). */
export const KEPENGURUSAN_WITH_ANGGOTA_SELECT = `*, anggota:anggota_id(${KEPENGURUSAN_ANGGOTA_SELECT})`;

function getClient() {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  }
  return supabaseAdmin;
}

/**
 * Ambil jabatan aktif final (status disetujui_pp, belum selesai, bukan 'Anggota').
 * Model tunggal: paling banyak satu baris.
 */
export async function getActiveJabatan(anggotaId: string): Promise<{
  id: string;
  jabatan: string;
  tanggal_mulai: string;
} | null> {
  if (!supabaseAdmin || !anggotaId) return null;

  const { data, error } = await supabaseAdmin
    .from('anggota_kepengurusan')
    .select('id, jabatan, tanggal_mulai')
    .eq('anggota_id', anggotaId)
    .eq('status', 'disetujui_pp')
    .is('tanggal_selesai', null)
    .neq('jabatan', 'Anggota')
    .is('deleted_at', null)
    .order('tanggal_mulai', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Gagal memeriksa jabatan aktif:', error.message);
    return null; // fail-safe: tidak memblokir
  }
  return (data as { id: string; jabatan: string; tanggal_mulai: string } | null) ?? null;
}

/**
 * Apakah anggota sudah memiliki pengajuan yang masih berjalan
 * (menunggu / diverifikasi_pc)? `excludeId` untuk record sendiri saat update.
 */
export async function hasActiveKepengurusanPengajuan(
  anggotaId: string,
  excludeId?: string,
): Promise<boolean> {
  if (!supabaseAdmin || !anggotaId) return false;

  let query = supabaseAdmin
    .from('anggota_kepengurusan')
    .select('id')
    .eq('anggota_id', anggotaId)
    .in('status', ['menunggu', 'diverifikasi_pc'])
    .is('deleted_at', null);

  if (excludeId) query = query.neq('id', excludeId);

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Gagal memeriksa pengajuan kepengurusan aktif:', error.message);
    return true; // fail-safe: anggap ada agar tidak membuat duplikat
  }
  return !!data;
}

/** Apakah nomor SK sudah dipakai pengajuan aktif/final lain? */
export async function isNomorSkUsed(
  nomorSk: string,
  excludeId?: string,
): Promise<boolean> {
  if (!supabaseAdmin || !nomorSk) return false;

  let query = supabaseAdmin
    .from('anggota_kepengurusan')
    .select('id')
    .ilike('nomor_sk', nomorSk.trim())
    .in('status', ['menunggu', 'diverifikasi_pc', 'disetujui_pp'])
    .is('deleted_at', null);

  if (excludeId) query = query.neq('id', excludeId);

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error('Gagal memeriksa nomor SK:', error.message);
    return true; // fail-safe
  }
  return !!data;
}

/**
 * Tutup jabatan aktif lama anggota (set tanggal_selesai).
 * Mengembalikan id baris yang ditutup agar bisa di-rollback.
 */
export async function closeActiveJabatan(
  anggotaId: string,
  tanggalSelesai: string,
  excludeId?: string,
): Promise<{ closedIds: string[]; error?: string }> {
  const client = getClient();

  let query = client
    .from('anggota_kepengurusan')
    .select('id')
    .eq('anggota_id', anggotaId)
    .eq('status', 'disetujui_pp')
    .is('tanggal_selesai', null)
    .neq('jabatan', 'Anggota')
    .is('deleted_at', null);

  if (excludeId) query = query.neq('id', excludeId);

  const { data: active, error: readError } = await query;
  if (readError) {
    console.error('Gagal membaca jabatan aktif untuk ditutup:', readError.message);
    return { closedIds: [], error: readError.message };
  }

  const rows = (active || []) as { id: string }[];
  if (rows.length === 0) return { closedIds: [] };

  const ids = rows.map((r) => r.id);
  const { error: updateError } = await client
    .from('anggota_kepengurusan')
    .update({ tanggal_selesai: tanggalSelesai, updated_at: new Date().toISOString() })
    .in('id', ids);

  if (updateError) {
    console.error('Gagal menutup jabatan aktif:', updateError.message);
    return { closedIds: [], error: updateError.message };
  }

  return { closedIds: ids };
}

/** Rollback: buka kembali jabatan yang tadinya ditutup (tanggal_selesai = NULL). */
export async function reopenJabatan(ids: string[]): Promise<void> {
  if (!supabaseAdmin || ids.length === 0) return;
  const { error } = await supabaseAdmin
    .from('anggota_kepengurusan')
    .update({ tanggal_selesai: null, updated_at: new Date().toISOString() })
    .in('id', ids);
  if (error) {
    console.error('Gagal rollback penutupan jabatan:', error.message);
  }
}

/**
 * Sinkronkan anggota.posisi_kepengurusan (idempotent).
 * Tidak menyentuh status_anggota/status_keanggotaan/kategori.
 */
export async function syncAnggotaPosisi(
  anggotaId: string,
  jabatan: string,
): Promise<{ updated: boolean; error?: string }> {
  const client = getClient();

  const { error } = await client
    .from('anggota')
    .update({ posisi_kepengurusan: jabatan, updated_at: new Date().toISOString() })
    .eq('id', anggotaId)
    .is('deleted_at', null);

  if (error) {
    console.error('Gagal sinkronisasi posisi kepengurusan anggota:', error.message);
    return { updated: false, error: error.message };
  }
  return { updated: true };
}

/**
 * Hitung tanggal selesai jabatan lama yang aman terhadap constraint
 * `tanggal_selesai > tanggal_mulai`. Hasil: GREATEST(tanggalBaru, mulaiLama+1hari).
 */
export function safeTanggalSelesai(
  tanggalMulaiLama: string,
  tanggalMulaiBaru: string,
): string {
  const nextDayOfOld = new Date(`${tanggalMulaiLama}T00:00:00Z`);
  nextDayOfOld.setUTCDate(nextDayOfOld.getUTCDate() + 1);
  const nextDayIso = nextDayOfOld.toISOString().slice(0, 10);
  return nextDayIso > tanggalMulaiBaru ? nextDayIso : tanggalMulaiBaru;
}

/**
 * Terapkan persetujuan (disetujui_pp) sebuah pengajuan kepengurusan:
 *  1. Tutup jabatan aktif lama (tanggal_selesai per-baris, aman ke constraint).
 *  2. Set baris pengajuan menjadi disetujui_pp (+ aktor keputusan).
 *  3. Sinkronkan anggota.posisi_kepengurusan (idempotent).
 *
 * Urutan penting: tutup dulu jabatan lama SEBELUM menandai baris baru disetujui,
 * agar partial unique index (satu jabatan aktif per anggota) tidak bentrok.
 * Bila langkah 2/3 gagal → rollback (buka kembali jabatan lama & kembalikan status).
 */
export async function applyKepengurusanApproval(params: {
  id: string;
  anggotaId: string;
  jabatan: string;
  tanggalMulai: string;
  decidedBy: string;
  catatanKeputusan?: string | null;
}): Promise<{ ok: boolean; error?: string; code?: string }> {
  const client = getClient();
  const now = new Date().toISOString();

  // 1. Baca & tutup jabatan aktif lama.
  const { data: active, error: readError } = await client
    .from('anggota_kepengurusan')
    .select('id, tanggal_mulai')
    .eq('anggota_id', params.anggotaId)
    .eq('status', 'disetujui_pp')
    .is('tanggal_selesai', null)
    .neq('jabatan', 'Anggota')
    .is('deleted_at', null)
    .neq('id', params.id);

  if (readError) {
    return { ok: false, error: readError.message };
  }

  const closedIds: string[] = [];
  for (const row of (active || []) as { id: string; tanggal_mulai: string }[]) {
    const selesai = safeTanggalSelesai(row.tanggal_mulai, params.tanggalMulai);
    const { error } = await client
      .from('anggota_kepengurusan')
      .update({ tanggal_selesai: selesai, updated_at: now })
      .eq('id', row.id);
    if (error) {
      await reopenJabatan(closedIds);
      return { ok: false, error: error.message };
    }
    closedIds.push(row.id);
  }

  // 2. Tandai pengajuan disetujui.
  const { error: approveError } = await client
    .from('anggota_kepengurusan')
    .update({
      status: 'disetujui_pp',
      diputuskan_oleh: params.decidedBy,
      diputuskan_pada: now,
      alasan_keputusan: params.catatanKeputusan ?? null,
      updated_at: now,
    })
    .eq('id', params.id);

  if (approveError) {
    await reopenJabatan(closedIds);
    return { ok: false, error: approveError.message, code: approveError.code };
  }

  // 3. Sinkronkan posisi anggota.
  const sync = await syncAnggotaPosisi(params.anggotaId, params.jabatan);
  if (!sync.updated && sync.error) {
    // Rollback: kembalikan status pengajuan & buka kembali jabatan lama.
    await client
      .from('anggota_kepengurusan')
      .update({ status: 'diverifikasi_pc', updated_at: now })
      .eq('id', params.id);
    await reopenJabatan(closedIds);
    return { ok: false, error: sync.error, code: 'STATUS_SYNC_FAILED' };
  }

  return { ok: true };
}

