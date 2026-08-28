import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requirePermission, notAuthenticatedResponse, unauthorizedResponse } from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';

/**
 * POST /api/anggota/batch-import - Insert a batch of validated records.
 *
 * Design decisions:
 * - Expects at most ~500 records per call (the CLIENT chunks the full dataset
 *   into batches). This keeps each request small and avoids Node.js body size limits.
 * - Duplicate NIK detection is NOT done here — each chunk is inserted directly.
 *   If a duplicate NIK violates the DB unique constraint, Supabase will reject that
 *   chunk and the client will report it.
 * - For a full import flow, the client first validates all rows locally (already done
 *   in ImportExcelModal), then sends chunks of up to 500 records to this endpoint,
 *   and aggregates results.
 */

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);

    const body = await request.json();
    const { records } = body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: 'Provide an array of records to import' },
        { status: 400 }
      );
    }

    if (records.length > 500) {
      return NextResponse.json(
        { error: 'Maksimal 500 record per request. Client harus mengirim dalam batch.' },
        { status: 400 }
      );
    }

    // Validate required fields
    const requiredFields = ['nik', 'nama_anggota', 'nama_cabang'];
    const validRecords: any[] = [];
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const missingFields = requiredFields.filter((f) => !record[f]);

      if (missingFields.length > 0) {
        errors.push({
          row: i + 1,
          error: `Field '${missingFields.join("', '")}' is required`,
        });
        continue;
      }

      validRecords.push(applyDefaults(record));
    }

    if (validRecords.length === 0) {
      return NextResponse.json({
        message: 'Tidak ada data valid',
        successCount: 0,
        errorCount: errors.length,
        errors,
      });
    }

    // UPSERT: Insert new records, or update existing ones if the NIK already exists.
    // This replaces existing data with the imported data (more complete rows win).
    const { data: upsertedData, error: upsertErr } = await supabase
      .from('anggota')
      .upsert(validRecords, { onConflict: 'nik', ignoreDuplicates: false })
      .select('id, nama_anggota');

    if (upsertErr) {
      console.error('Error upserting batch:', upsertErr);
      return NextResponse.json(
        {
          message: `Gagal import: ${upsertErr.message}`,
          successCount: 0,
          errorCount: validRecords.length,
          errors: validRecords.map((r, i) => ({
            row: i + 1,
            error: upsertErr.message || 'Gagal import data',
          })),
        },
        { status: 200 } // Return 200 so the client can aggregate partial failures
      );
    }

    const successCount = upsertedData?.length || 0;

    return NextResponse.json({
      message: `${successCount} data berhasil diproses`,
      successCount,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Error in POST /api/anggota/batch-import:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk mengimpor data anggota');
    }

    if (error.message?.includes('Payload too large') || error.message?.includes('413')) {
      return NextResponse.json(
        { error: 'Data terlalu besar. Client harus mengirim dalam batch lebih kecil (maks 500).' },
        { status: 413 }
      );
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server', details: error.message },
      { status: 500 }
    );
  }
}

// Apply defaults for optional fields
function applyDefaults(record: any) {
  return {
    ...record,
    deleted_at: null, // Reset soft-delete so previously deleted records can be re-imported
    kategori_anggota: record.kategori_anggota || 'biasa',
    status_anggota: record.status_anggota || 'pegawai',
    status_mps: record.status_mps || 'non_mps',
    status_iuran: record.status_iuran || 'iuran',
    posisi_kepengurusan: record.posisi_kepengurusan || 'Anggota',
    status_kepesertaan: record.status_kepesertaan || null,
    cabang_kelas: record.cabang_kelas || null,
    cabang_area_regional: record.cabang_area_regional || null,
    cabang_area_witel: record.cabang_area_witel || null,
    pasutri: record.pasutri || null,
    status_perkawinan: record.status_perkawinan || null,
    sk_pensiun: record.sk_pensiun || null,
    nomor_sk_pensiun: record.nomor_sk_pensiun || null,
    alamat: record.alamat || null,
    rt: record.rt || null,
    rw: record.rw || null,
    kelurahan: record.kelurahan || null,
    kecamatan: record.kecamatan || null,
    provinsi: record.provinsi || null,
    kota: record.kota || null,
    kode_pos: record.kode_pos || null,
    nomor_handphone: record.nomor_handphone || null,
    nomor_telepon: record.nomor_telepon || null,
    email: record.email || null,
    sosial_media: record.sosial_media || null,
    e_ktp: record.e_ktp || null,
    kartu_keluarga: record.kartu_keluarga || null,
    npwp: record.npwp || null,
    tempat_lahir: record.tempat_lahir || null,
    tanggal_lahir: record.tanggal_lahir || null,
    jenis_kelamin: record.jenis_kelamin || null,
    agama: record.agama || null,
    golongan_darah: record.golongan_darah || null,
    besaran_iuran: record.besaran_iuran || null,
    form_kesediaan_iuran: record.form_kesediaan_iuran || null,
    nama_bank: record.nama_bank || null,
    norek_bank: record.norek_bank || null,
    kategori_bantuan: record.kategori_bantuan || null,
    tanggal_terima_bantuan: record.tanggal_terima_bantuan || null,
    gambar_kondisi_tempat_tinggal: record.gambar_kondisi_tempat_tinggal || null,
    alasan_mutasi: record.alasan_mutasi || null,
    tanggal_mutasi: record.tanggal_mutasi || null,
    cabang_pengajuan_mutasi: record.cabang_pengajuan_mutasi || null,
    pusat_pengesahan_mutasi: record.pusat_pengesahan_mutasi || null,
    status_bpjs: record.status_bpjs || null,
    bpjs_kelas: record.bpjs_kelas || null,
    bpjs_insentif: record.bpjs_insentif || null,
    kategori_datul: record.kategori_datul || null,
    media_datul: record.media_datul || null,
  };
}