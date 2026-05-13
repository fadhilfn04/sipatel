import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured.');
  return supabaseAdmin;
}

export interface ImportRow {
  nik: string;
  tanggal_meninggal: string;
  nama_ahli_waris: string;
  status_ahli_waris: string;
  besaran_dana_kematian: string;
  penyebab_meninggal?: string;
  tanggal_lapor_keluarga?: string;
  tanggal_terima_berkas?: string;
  keterangan?: string;
}

export interface ImportRowResult {
  row: number;
  nik: string;
  nama_anggota: string;
  success: boolean;
  error?: string;
}

const VALID_STATUS_AHLI_WARIS = ['istri', 'suami', 'anak', 'keluarga'];
const toDate = (v: string | undefined) => (v && v.trim()) ? v.trim() : null;

export async function POST(request: NextRequest) {
  try {
    const { rows }: { rows: ImportRow[] } = await request.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    if (rows.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 rows per import' }, { status: 400 });
    }

    // Collect all unique NIKs and look them up in bulk
    const niks = Array.from(new Set(rows.map(r => r.nik?.trim()).filter(Boolean)));
    const { data: anggotaList } = await getClient()
      .from('anggota')
      .select('id, nik, nama_anggota, status_anggota, status_mps, nama_cabang')
      .in('nik', niks)
      .is('deleted_at', null);

    const anggotaByNik = new Map(
      (anggotaList || []).map(a => [a.nik, a])
    );

    // Check which anggota_ids already have active claims
    const anggotaIds = (anggotaList || []).map(a => a.id);
    const { data: existingClaims } = await getClient()
      .from('dana_kematian')
      .select('anggota_id')
      .in('anggota_id', anggotaIds)
      .neq('status_proses', 'ditolak')
      .is('deleted_at', null);

    const claimedIds = new Set((existingClaims || []).map(c => c.anggota_id));

    const results: ImportRowResult[] = [];
    const toInsert: Record<string, unknown>[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;
      const nik = r.nik?.trim();

      // Validate required fields
      if (!nik) {
        results.push({ row: rowNum, nik: '', nama_anggota: '', success: false, error: 'NIK wajib diisi' });
        continue;
      }

      const anggota = anggotaByNik.get(nik);
      if (!anggota) {
        results.push({ row: rowNum, nik, nama_anggota: '', success: false, error: `NIK ${nik} tidak ditemukan di data anggota` });
        continue;
      }

      if (claimedIds.has(anggota.id)) {
        results.push({ row: rowNum, nik, nama_anggota: anggota.nama_anggota, success: false, error: `${anggota.nama_anggota} sudah memiliki pengajuan dana kematian aktif` });
        continue;
      }

      if (!r.tanggal_meninggal?.trim()) {
        results.push({ row: rowNum, nik, nama_anggota: anggota.nama_anggota, success: false, error: 'Tanggal meninggal wajib diisi' });
        continue;
      }

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(r.tanggal_meninggal.trim())) {
        results.push({ row: rowNum, nik, nama_anggota: anggota.nama_anggota, success: false, error: 'Format tanggal harus YYYY-MM-DD' });
        continue;
      }

      if (!r.nama_ahli_waris?.trim()) {
        results.push({ row: rowNum, nik, nama_anggota: anggota.nama_anggota, success: false, error: 'Nama ahli waris wajib diisi' });
        continue;
      }

      const statusAW = r.status_ahli_waris?.trim().toLowerCase();
      if (!VALID_STATUS_AHLI_WARIS.includes(statusAW)) {
        results.push({ row: rowNum, nik, nama_anggota: anggota.nama_anggota, success: false, error: `Status ahli waris tidak valid (gunakan: ${VALID_STATUS_AHLI_WARIS.join(', ')})` });
        continue;
      }

      const besaran = parseFloat(r.besaran_dana_kematian?.toString().replace(/[^\d.]/g, '') || '0');
      if (!besaran || besaran <= 0) {
        results.push({ row: rowNum, nik, nama_anggota: anggota.nama_anggota, success: false, error: 'Besaran dana kematian wajib diisi dan harus berupa angka positif' });
        continue;
      }

      toInsert.push({
        anggota_id: anggota.id,
        nama_anggota: anggota.nama_anggota,
        status_anggota: anggota.status_anggota,
        status_mps: anggota.status_mps,
        cabang_asal_melapor: anggota.nama_cabang,
        tanggal_meninggal: r.tanggal_meninggal.trim(),
        nama_ahli_waris: r.nama_ahli_waris.trim(),
        status_ahli_waris: statusAW,
        besaran_dana_kematian: besaran,
        penyebab_meninggal: toDate(r.penyebab_meninggal) || null,
        tanggal_lapor_keluarga: toDate(r.tanggal_lapor_keluarga),
        cabang_tanggal_awal_terima_berkas: toDate(r.tanggal_terima_berkas),
        keterangan: r.keterangan?.trim() || null,
        status_proses: 'dilaporkan',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // _rowNum is a temporary marker — removed before insert
        _rowNum: rowNum,
        _nik: nik,
        _nama: anggota.nama_anggota,
      });
    }

    // Insert valid rows
    const insertPayload = toInsert.map(({ _rowNum, _nik, _nama, ...rest }) => rest);

    let insertedCount = 0;
    if (insertPayload.length > 0) {
      const { error: insertError } = await getClient()
        .from('dana_kematian')
        .insert(insertPayload);

      if (insertError) {
        return NextResponse.json(
          { error: `Gagal menyimpan data: ${insertError.message}` },
          { status: 500 }
        );
      }
      insertedCount = insertPayload.length;
    }

    // Build success results for inserted rows
    toInsert.forEach(r => {
      results.push({
        row: r._rowNum as number,
        nik: r._nik as string,
        nama_anggota: r._nama as string,
        success: true,
      });
    });

    results.sort((a, b) => a.row - b.row);

    return NextResponse.json({
      total: rows.length,
      inserted: insertedCount,
      failed: rows.length - insertedCount,
      results,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import gagal' },
      { status: 500 }
    );
  }
}
