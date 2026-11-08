/**
 * Keanggotaan — apply penggantian rekening anggota.
 *
 * Dipakai oleh:
 *  - app/api/anggota/[id]/penggantian-rekening (admin → langsung)
 *  - app/api/anggota/approvals/[id] (usulan jenis 'rekening' disetujui)
 *
 * Tabel: anggota (rekening aktif) & anggota_rekening (histori append-only,
 * migration 035). Rekening lama tidak pernah dihapus — selalu tersalin ke
 * histori saat penggantian diterapkan.
 */

import type { PenggantianRekeningFormValues } from '@/lib/anggota-rekening';
import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface RekeningSnapshot {
  nama_bank?: string | null;
  norek_bank?: string | null;
  nama_pemilik_rekening?: string | null;
}

export interface ApplyPenggantianRekeningArgs {
  anggotaId: string;
  /** Data anggota SEBELUM penggantian (snapshot rekening lama). */
  before: RekeningSnapshot;
  /** Rekening baru + metadata penggantian (dokumen, tanggal efektif, alasan). */
  usulan: PenggantianRekeningFormValues & { alasan?: string | null };
  diajukanOleh?: string | null;
  disetujuiOleh?: string | null;
  diputuskanPada?: string | null;
}

export interface ApplyPenggantianRekeningResult {
  data: unknown | null;
  error?: string;
}

/**
 * Terapkan penggantian rekening:
 * 1) rekening baru menjadi rekening aktif pada tabel `anggota`,
 * 2) baris rekening aktif lama pada `anggota_rekening` ditandai `non_aktif`
 *    (menjaga unique index "satu rekening aktif per anggota"),
 * 3) histori lengkap (rekening lama → baru) disisipkan ke `anggota_rekening`.
 *
 * Mengembalikan data anggota terbaru, atau pesan error bila gagal pada
 * langkah 1 (langkah 2–3 bersifat best-effort: rekening utama sudah berubah,
 * kegagalan histori hanya dicatat di log — pola `recordMutasiIfCabangChanged`).
 */
export async function applyPenggantianRekening(
  args: ApplyPenggantianRekeningArgs,
  client?: SupabaseClient,
): Promise<ApplyPenggantianRekeningResult> {
  const { anggotaId, before, usulan } = args;
  const db = client ?? supabase;
  const nowIso = new Date().toISOString();

  // 0) Jalur utama: RPC atomik (migration 036) — rekening aktif + histori
  //    append-only tersimpan dalam SATU transaksi (menutup gap non-transaksional).
  try {
    const { data: rpcRows, error: rpcError } = await db.rpc('apply_penggantian_rekening', {
      p_anggota_id: anggotaId,
      p_nama_bank: usulan.nama_bank,
      p_norek_bank: usulan.norek_bank,
      p_nama_pemilik_rekening: usulan.nama_pemilik_rekening,
      p_kode_bank: usulan.kode_bank ?? null,
      p_tanggal_efektif: usulan.tanggal_efektif,
      p_dokumen_pendukung: usulan.dokumen_pendukung ?? null,
      p_alasan: usulan.alasan ?? null,
      p_diajukan_oleh: args.diajukanOleh ?? null,
      p_disetujui_oleh: args.disetujuiOleh ?? null,
      p_diputuskan_pada: args.diputuskanPada ?? nowIso,
    });

    if (!rpcError) {
      const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      return { data: row ?? null };
    }
    // RPC belum tersedia (migration 036 belum dijalankan) → fallback legacy.
    console.warn('[REKENING] RPC apply_penggantian_rekening gagal, pakai fallback:', rpcError.message);
  } catch (error: any) {
    console.warn('[REKENING] RPC apply_penggantian_rekening error, pakai fallback:', error?.message);
  }

  // 1) Rekening baru menjadi rekening aktif pada data utama anggota.
  const { data: updated, error: updateError } = await db
    .from('anggota')
    .update({
      nama_bank: usulan.nama_bank,
      norek_bank: usulan.norek_bank,
      nama_pemilik_rekening: usulan.nama_pemilik_rekening,
      updated_at: nowIso,
    })
    .eq('id', anggotaId)
    .is('deleted_at', null)
    .select()
    .single();

  if (updateError || !updated) {
    return {
      data: null,
      error: updateError?.message || 'Gagal memperbarui rekening anggota',
    };
  }

  // 2) Tandai rekening aktif lama pada histori sebagai non-aktif.
  const { error: deactivateError } = await db
    .from('anggota_rekening')
    .update({ status: 'non_aktif' })
    .eq('anggota_id', anggotaId)
    .eq('status', 'aktif');

  if (deactivateError) {
    // Tidak fatal — kemungkinan belum ada histori sama sekali.
    console.error(
      'Gagal menonaktifkan rekening aktif lama pada histori:',
      deactivateError.message,
    );
  }

  // 3) Simpan histori penggantian (lama → baru) — append-only.
  const { error: historyError } = await db
    .from('anggota_rekening')
    .insert({
      anggota_id: anggotaId,
      nama_bank_lama: before.nama_bank ?? null,
      norek_bank_lama: before.norek_bank ?? null,
      nama_pemilik_rekening_lama: before.nama_pemilik_rekening ?? null,
      kode_bank: usulan.kode_bank ?? null,
      nama_bank: usulan.nama_bank,
      norek_bank: usulan.norek_bank,
      nama_pemilik_rekening: usulan.nama_pemilik_rekening,
      status: 'aktif',
      tanggal_efektif: usulan.tanggal_efektif,
      dokumen_pendukung: usulan.dokumen_pendukung ?? null,
      alasan: usulan.alasan ?? null,
      diajukan_oleh: args.diajukanOleh ?? null,
      disetujui_oleh: args.disetujuiOleh ?? null,
      diputuskan_pada: args.diputuskanPada ?? nowIso,
    });

  if (historyError) {
    // Best-effort: rekening utama sudah berubah — histori gagal dicatat.
    console.error(
      'Gagal mencatat histori penggantian rekening:',
      historyError.message,
    );
  }

  return { data: updated };
}
