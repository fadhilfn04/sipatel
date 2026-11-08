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
import type { SupabaseClient } from '@supabase/supabase-js';

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

/** Baris pengurus aktif (anggota + detail jabatan aktif dari histori). */
export interface PengurusAktifRow {
  id: string;
  nik: string | null;
  nama_anggota: string | null;
  nama_cabang: string | null;
  kode_cabang: string | null;
  posisi_kepengurusan: string;
  status_anggota: string;
  status_keanggotaan: string | null;
  jabatan_aktif: {
    id: string;
    jabatan: string;
    periode: string | null;
    tanggal_mulai: string;
    nomor_sk: string;
  } | null;
  pengajuan_aktif: boolean;
}

/**
 * Daftar pengurus aktif untuk menu Pemberhentian Pengurus.
 *
 * Sumber utama: `anggota.posisi_kepengurusan <> 'Anggota'` (tahan data legacy
 * yang belum punya baris histori — lihat docs/pemberhentian-pengurus-audit.md §3.5),
 * diperkaya dengan baris aktif `anggota_kepengurusan` (periode/SK) bila ada.
 */
export async function listPengurusAktif(params: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: PengurusAktifRow[]; total: number }> {
  if (!supabaseAdmin) return { data: [], total: 0 };

  const page = Math.max(params.page || 1, 1);
  const limit = Math.min(Math.max(params.limit || 20, 1), 100);
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('anggota')
    .select(
      'id, nik, nama_anggota, nama_cabang, kode_cabang, posisi_kepengurusan, status_anggota, status_keanggotaan',
      { count: 'exact' },
    )
    .is('deleted_at', null)
    .neq('posisi_kepengurusan', 'Anggota')
    .neq('posisi_kepengurusan', 'anggota')
    .order('nama_anggota', { ascending: true })
    .range(offset, offset + limit - 1);

  const search = (params.search || '').trim();
  if (search) {
    query = query.or(`nik.ilike.%${search}%,nama_anggota.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    console.error('Gagal memuat daftar pengurus aktif:', error.message);
    throw new Error(error.message);
  }

  const rows = (data || []) as Array<
    Omit<PengurusAktifRow, 'jabatan_aktif' | 'pengajuan_aktif'>
  >;
  const ids = rows.map((r) => r.id);

  const jabatanMap = new Map<string, PengurusAktifRow['jabatan_aktif']>();
  const pengajuanSet = new Set<string>();

  if (ids.length > 0) {
    const [jabatanRes, pengajuanRes] = await Promise.all([
      supabaseAdmin
        .from('anggota_kepengurusan')
        .select('id, anggota_id, jabatan, periode, tanggal_mulai, nomor_sk')
        .in('anggota_id', ids)
        .eq('status', 'disetujui_pp')
        .is('tanggal_selesai', null)
        .neq('jabatan', 'Anggota')
        .is('deleted_at', null),
      supabaseAdmin
        .from('anggota_kepengurusan')
        .select('anggota_id')
        .in('anggota_id', ids)
        .in('status', ['menunggu', 'diverifikasi_pc'])
        .is('deleted_at', null),
    ]);

    if (jabatanRes.error) {
      console.error('Gagal memuat jabatan aktif pengurus:', jabatanRes.error.message);
    } else {
      for (const row of (jabatanRes.data || []) as Array<{
        id: string;
        anggota_id: string;
        jabatan: string;
        periode: string | null;
        tanggal_mulai: string;
        nomor_sk: string;
      }>) {
        jabatanMap.set(row.anggota_id, {
          id: row.id,
          jabatan: row.jabatan,
          periode: row.periode,
          tanggal_mulai: row.tanggal_mulai,
          nomor_sk: row.nomor_sk,
        });
      }
    }

    if (pengajuanRes.error) {
      console.error('Gagal memeriksa pengajuan aktif pengurus:', pengajuanRes.error.message);
    } else {
      for (const row of (pengajuanRes.data || []) as Array<{ anggota_id: string }>) {
        pengajuanSet.add(row.anggota_id);
      }
    }
  }

  return {
    data: rows.map((r) => ({
      ...r,
      jabatan_aktif: jabatanMap.get(r.id) || null,
      pengajuan_aktif: pengajuanSet.has(r.id),
    })),
    total: count || 0,
  };
}

/**
 * Apakah anggota memiliki pengajuan Pengakhiran Keanggotaan yang masih berjalan
 * (menunggu/diverifikasi_pc)? Dipakai guard menyilang "satu lifecycle per anggota".
 */
export async function hasActivePengakhiranPengajuan(anggotaId: string): Promise<boolean> {
  if (!supabaseAdmin || !anggotaId) return false;

  const { data, error } = await supabaseAdmin
    .from('pengakhiran_keanggotaan')
    .select('id')
    .eq('anggota_id', anggotaId)
    .in('status', ['menunggu', 'diverifikasi_pc'])
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    console.error('Gagal memeriksa pengajuan pengakhiran keanggotaan:', error.message);
    return true; // fail-safe: anggap ada agar tidak membuat proses paralel
  }
  return !!data;
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
  inputClient?: SupabaseClient,
): Promise<{ closedIds: string[]; error?: string }> {
  const client = inputClient ?? getClient();

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
export async function reopenJabatan(ids: string[], inputClient?: SupabaseClient): Promise<void> {
  const client = inputClient ?? supabaseAdmin;
  if (!client || ids.length === 0) return;
  const { error } = await client
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
  inputClient?: SupabaseClient,
): Promise<{ updated: boolean; error?: string }> {
  const client = inputClient ?? getClient();

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
}, inputClient?: SupabaseClient): Promise<{ ok: boolean; error?: string; code?: string }> {
  const client = inputClient ?? getClient();
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
      await reopenJabatan(closedIds, client);
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
    await reopenJabatan(closedIds, client);
    return { ok: false, error: approveError.message, code: approveError.code };
  }

  // 3. Sinkronkan posisi anggota.
  const sync = await syncAnggotaPosisi(params.anggotaId, params.jabatan, client);
  if (!sync.updated && sync.error) {
    // Rollback: kembalikan status pengajuan & buka kembali jabatan lama.
    await client
      .from('anggota_kepengurusan')
      .update({ status: 'diverifikasi_pc', updated_at: now })
      .eq('id', params.id);
    await reopenJabatan(closedIds, client);
    return { ok: false, error: sync.error, code: 'STATUS_SYNC_FAILED' };
  }

  return { ok: true };
}

