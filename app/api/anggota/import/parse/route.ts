import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import * as XLSX from 'xlsx';
import { guardPermissions } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/rbac';

export async function POST(request: NextRequest) {
  try {
    const guard = await guardPermissions(
      [PERMISSIONS.MANAGE_KEANGGOTAAN],
      'Anda tidak memiliki akses untuk mengimpor data anggota',
    );
    if (guard.error) return guard.error;
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (!validTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload Excel or CSV file.' },
        { status: 400 }
      );
    }

    // Save file temporarily
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create temp directory if it doesn't exist
    const tmpDir = join(process.cwd(), 'tmp');
    const tmpFilePath = join(tmpDir, `upload-${Date.now()}-${file.name}`);

    try {
      const { writeFile } = require('fs/promises');
      await writeFile(tmpFilePath, buffer);
    } catch (err) {
      // If tmp directory doesn't exist, create it
      const { mkdir } = require('fs/promises');
      await mkdir(tmpDir, { recursive: true });
      const { writeFile } = require('fs/promises');
      await writeFile(tmpFilePath, buffer);
    }

    // Parse Excel file
    const workbook = XLSX.readFile(tmpFilePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      defval: '',
      blankrows: false
    });

    // Clean up temp file
    try {
      const { unlink } = require('fs/promises');
      await unlink(tmpFilePath);
    } catch (err) {
      console.warn('Failed to delete temp file:', err);
    }

    if (jsonData.length === 0) {
      return NextResponse.json(
        { error: 'File is empty or no data found' },
        { status: 400 }
      );
    }

    // Map and validate data
    const mappedData = jsonData.map((row: any) => ({
      nik_ktp: String(row.nik_ktp || row['NIK KTP'] || row['NIK_KTP'] || '').trim(),
      nama: String(row.nama || row['Nama'] || row['NAMA'] || '').trim(),
      tempat_lahir: String(row.tempat_lahir || row['Tempat Lahir'] || row['TEMPAT_LAHIR'] || '').trim(),
      // Optional fields
      nikap: String(row.nikap || row['NIKAP'] || '').trim(),
      tanggal_lahir: row.tanggal_lahir || row['Tanggal Lahir'] || new Date().toISOString().split('T')[0],
      status_anggota: row.status_anggota || row['Status Anggota'] || 'Aktif',
      jenis_anggota: row.jenis_anggota || row['Jenis Anggota'] || 'Pensiunan',
      status_iuran: row.status_iuran || row['Status Iuran'] || 'Lunas',
      status_kesehatan: row.status_kesehatan || row['Status Kesehatan'] || 'Sehat',
      jenis_kelamin: row.jenis_kelamin || row['Jenis Kelamin'] || 'Laki-laki',
      agama: row.agama || row['Agama'] || 'Islam',
      status_perkawinan: row.status_perkawinan || row['Status Perkawinan'] || 'Menikah',
      sk_pensiun: String(row.sk_pensiun || row['SK Pensiun'] || '').trim(),
      nomor_kontak: String(row.nomor_kontak || row['Nomor Kontak'] || '').trim(),
      alamat: String(row.alamat || row['Alamat'] || '').trim(),
      rt: String(row.rt || row['RT'] || '').trim(),
      rw: String(row.rw || row['RW'] || '').trim(),
      kelurahan: String(row.kelurahan || row['Kelurahan'] || '').trim(),
      kecamatan: String(row.kecamatan || row['Kecamatan'] || '').trim(),
      kota: String(row.kota || row['Kota'] || '').trim(),
      kode_pos: String(row.kode_pos || row['Kode Pos'] || '').trim(),
      cabang_domisili: String(row.cabang_domisili || row['Cabang Domisili'] || 'Cabang Jakarta').trim(),
      golongan_darah: String(row.golongan_darah || row['Golongan Darah'] || '').trim(),
      no_kk: String(row.no_kk || row['No KK'] || '').trim(),
      surat_nikah: String(row.surat_nikah || row['Surat Nikah'] || '').trim(),
      email: String(row.email || row['Email'] || '').trim(),
    }));

    // Validate required fields
    const validData = mappedData.filter((item: any) => {
      return item.nik_ktp && item.nama && item.tempat_lahir;
    });

    const invalidCount = mappedData.length - validData.length;

    if (invalidCount > 0) {
      console.warn(`${invalidCount} rows skipped due to missing required fields`);
    }

    return NextResponse.json({
      data: validData,
      total: mappedData.length,
      valid: validData.length,
      invalid: invalidCount,
      message: invalidCount > 0
        ? `${invalidCount} rows skipped due to missing required fields`
        : 'All rows validated successfully'
    });

  } catch (error) {
    console.error('Error parsing Excel file:', error);
    return NextResponse.json(
      {
        error: 'Failed to parse file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}