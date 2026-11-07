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
): Promise<ApplyPenggantianRekeningResult> {
  const { anggotaId, before, usulan } = args;
  const nowIso = new Date().toISOString();

  // 1) Rekening baru menjadi rekening aktif pada data utama anggota.
  const { data: updated, error: updateError } = await supabase
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
  const { error: deactivateError } = await supabase
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
  const { error: historyError } = await supabase
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
