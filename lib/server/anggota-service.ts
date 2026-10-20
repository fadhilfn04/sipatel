/**
 * Keanggotaan — service terkait approval & mutasi anggota.
 *
 * Dipakai oleh:
 *  - app/api/anggota/[id] (PUT/DELETE: admin langsung, cabang → usulan)
 *  - app/api/anggota/approvals (daftar + keputusan usulan)
 *
 * Tabel: anggota_perubahan (approval) & anggota_mutasi (riwayat, append-only)
 * — migration 027.
 */

import { supabaseAdmin } from '@/lib/supabase-storage';
import type { UpdateAnggotaInput } from '@/lib/supabase';

export const ADMIN_ROLE_SLUGS = ['admin', 'administrator', 'owner'];

/** Apakah aktor adalah admin (penyetuju) — superuser aplikasi. */
export function isAdminActor(user: { role?: { slug?: string | null } | null } | null): boolean {
  const slug = user?.role?.slug || '';
  return ADMIN_ROLE_SLUGS.includes(slug);
}

/**
 * Normalisasi payload update anggota (identik dengan perilaku PUT lama agar
 * data usulan approval menghasilkan hasil apply yang sama).
 */
export function buildAnggotaUpdatePayload(body: UpdateAnggotaInput): Record<string, unknown> {
  return {
    ...body,
    alamat: body.alamat || null,
    rt: body.rt || null,
    rw: body.rw || null,
    kelurahan: body.kelurahan || null,
    kecamatan: body.kecamatan || null,
    provinsi: body.provinsi || null,
    kota: body.kota || null,
    kode_pos: body.kode_pos || null,
    nomor_handphone: body.nomor_handphone || null,
    nomor_telepon: body.nomor_telepon || null,
    email: body.email || null,
    sosial_media: body.sosial_media || null,
    e_ktp: body.e_ktp || null,
    kartu_keluarga: body.kartu_keluarga || null,
    npwp: body.npwp || null,
    tempat_lahir: body.tempat_lahir || null,
    tanggal_lahir: body.tanggal_lahir || null,
    jenis_kelamin: body.jenis_kelamin || null,
    agama: body.agama || null,
    golongan_darah: body.golongan_darah || null,
    besaran_iuran: body.besaran_iuran || null,
    form_kesediaan_iuran: body.form_kesediaan_iuran || null,
    nama_bank: body.nama_bank || null,
    norek_bank: body.norek_bank || null,
    kategori_bantuan: body.kategori_bantuan || null,
    tanggal_terima_bantuan: body.tanggal_terima_bantuan || null,
    gambar_kondisi_tempat_tinggal: body.gambar_kondisi_tempat_tinggal || null,
    alasan_mutasi: body.alasan_mutasi || null,
    tanggal_mutasi: body.tanggal_mutasi || null,
    cabang_pengajuan_mutasi: body.cabang_pengajuan_mutasi || null,
    pusat_pengesahan_mutasi: body.pusat_pengesahan_mutasi || null,
    status_bpjs: body.status_bpjs || null,
    bpjs_kelas: body.bpjs_kelas || null,
    bpjs_insentif: body.bpjs_insentif || null,
    kategori_datul: body.kategori_datul || null,
    media_datul: body.media_datul || null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Catat riwayat mutasi (append-only) bila cabang anggota berubah.
 * Riwayat TIDAK pernah diubah/dihapus — anggota_mutasi hanya menerima INSERT.
 */
export async function recordMutasiIfCabangChanged(params: {
  before: Record<string, any>;
  after: Record<string, any>;
  diajukanOleh?: string | null;
  disetujuiOleh?: string | null;
  alasan?: string | null;
}): Promise<void> {
  const cabangChanged =
    params.before.nama_cabang !== params.after.nama_cabang ||
    params.before.kode_cabang !== params.after.kode_cabang;

  if (!cabangChanged || !supabaseAdmin) return;

  const tanggalEfektif =
    params.after.tanggal_mutasi ||
    (params.after.updated_at ? String(params.after.updated_at).slice(0, 10) : null);

  const { error } = await supabaseAdmin.from('anggota_mutasi').insert({
    anggota_id: params.after.id,
    nik: params.after.nik ?? params.before.nik ?? null,
    cabang_asal: params.before.nama_cabang ?? null,
    cabang_tujuan: params.after.nama_cabang ?? null,
    kode_cabang_asal: params.before.kode_cabang ?? null,
    kode_cabang_tujuan: params.after.kode_cabang ?? null,
    tanggal_efektif: tanggalEfektif,
    diajukan_oleh: params.diajukanOleh ?? null,
    disetujui_oleh: params.disetujuiOleh ?? null,
    alasan: params.alasan ?? params.after.alasan_mutasi ?? null,
  });

  if (error) {
    // Riwayat gagal dicatat — dilaporkan agar terlihat (data mutasi tetap terjadi).
    console.error('Gagal mencatat riwayat mutasi anggota:', error.message);
  }
}

/**
 * Apakah anggota masih memiliki pengajuan Dana Kematian aktif?
 * Mencegah penghapusan yang merusak relasi / transaksi historis.
 */
export async function hasActiveDakemTransactions(anggotaId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { data, error } = await supabaseAdmin
    .from('dana_kematian')
    .select('id')
    .eq('anggota_id', anggotaId)
    .is('deleted_at', null)
    .not('status_proses', 'in', '(batal)')
    .limit(1);
  if (error) {
    console.error('Gagal memeriksa transaksi Dana Kematian anggota:', error.message);
    return true; // fail-safe: anggap ada bila cek gagal
  }
  return (data || []).length > 0;
}
