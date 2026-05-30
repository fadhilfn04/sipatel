import { NextRequest, NextResponse } from 'next/server';
import { uploadToSupabaseStorageGeneric, deleteFromSupabaseStorage, DanaKematianFolder, AnggotaFolder } from '@/lib/supabase-storage';

// POST /api/upload - Upload file to Supabase storage
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const bucket = formData.get('bucket') as 'dana-kematian' | 'anggota';
    const folder = formData.get('folder') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!bucket) {
      return NextResponse.json(
        { error: 'No bucket specified' },
        { status: 400 }
      );
    }

    if (!folder) {
      return NextResponse.json(
        { error: 'No folder specified' },
        { status: 400 }
      );
    }

    // Validate bucket
    const validBuckets = ['dana-kematian', 'anggota'];
    if (!validBuckets.includes(bucket)) {
      return NextResponse.json(
        { error: 'Invalid bucket specified' },
        { status: 400 }
      );
    }

    // Validate folder based on bucket
    if (bucket === 'dana-kematian') {
      const validFolders: DanaKematianFolder[] = [
        'sk-pensiun',
        'surat-kematian',
        'surat-pernyataan-ahli-waris',
        'kartu-keluarga',
        'e-ktp',
        'surat-nikah',
        'surat-keterangan',
        'dokumen-pendukung',
        'bukti-penyerahan',
        'laporan-periode',
      ];
      if (!validFolders.includes(folder as DanaKematianFolder)) {
        return NextResponse.json(
          { error: 'Invalid folder specified for dana-kematian bucket' },
          { status: 400 }
        );
      }
    } else if (bucket === 'anggota') {
      const validFolders: AnggotaFolder[] = [
        'gambar-kondisi-tempat-tinggal',
        'e-ktp',
        'kartu-keluarga',
        'npwp',
        'dokumen-lainnya'
      ];
      if (!validFolders.includes(folder as AnggotaFolder)) {
        return NextResponse.json(
          { error: 'Invalid folder specified for anggota bucket' },
          { status: 400 }
        );
      }
    }

    // Upload file
    const url = await uploadToSupabaseStorageGeneric(file, bucket, folder);

    return NextResponse.json({
      success: true,
      url,
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to upload file',
        success: false
      },
      { status: 500 }
    );
  }
}

// DELETE /api/upload - Delete file from Supabase storage
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const bucket = searchParams.get('bucket') as 'dana-kematian' | 'anggota' | null;

    if (!url) {
      return NextResponse.json(
        { error: 'No file URL provided' },
        { status: 400 }
      );
    }

    // Delete file with bucket parameter (defaults to dana-kematian if not specified)
    await deleteFromSupabaseStorage(url, bucket || 'dana-kematian');

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete file',
        success: false
      },
      { status: 500 }
    );
  }
}
