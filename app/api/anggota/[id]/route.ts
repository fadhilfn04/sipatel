import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { UpdateAnggotaInput } from '@/lib/supabase';
import { requirePermission, requireAnyPermission, notAuthenticatedResponse, unauthorizedResponse } from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';

// GET /api/anggota/[id] - Get single member by ID
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Check permission - allow access for Keanggotaan, Dana Kematian, or Dana Sosial access
    await requireAnyPermission([
      PERMISSIONS.VIEW_KEANGGOTAAN,
      PERMISSIONS.ACCESS_DANA_KEMATIAN,
      PERMISSIONS.ACCESS_DANA_SOCIAL,
    ]);

    const { id } = await context.params;
    const { data: anggota, error } = await supabase
      .from('anggota')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !anggota) {
      return NextResponse.json(
        { error: 'Anggota tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: anggota });
  } catch (error: any) {
    console.error('Error in GET /api/anggota/[id]:', error);

    // Handle permission errors
    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk melihat data anggota');
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}

// PUT /api/anggota/[id] - Update member
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Check permission - require manage permission
    await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);

    const { id } = await context.params;
    const body: UpdateAnggotaInput = await request.json();

    // Check if member exists
    const { data: existingAnggota } = await supabase
      .from('anggota')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existingAnggota) {
      return NextResponse.json(
        { error: 'Anggota tidak ditemukan' },
        { status: 404 }
      );
    }

    // Check for duplicate NIK (if changed)
    if (body.nik) {
      const { data: duplicateNik } = await supabase
        .from('anggota')
        .select('id')
        .eq('nik', body.nik)
        .neq('id', id)
        .is('deleted_at', null)
        .single();

      if (duplicateNik) {
        return NextResponse.json(
          { error: 'NIK already exists' },
          { status: 409 }
        );
      }
    }

    // Update anggota
    const { data: updatedAnggota, error } = await supabase
      .from('anggota')
      .update({
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
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating anggota:', error);
      return NextResponse.json(
        { error: 'Failed to update anggota', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: updatedAnggota,
      message: 'Anggota berhasil diupdate',
    });

  } catch (error: any) {
    console.error('Error in PUT /api/anggota/[id]:', error);

    // Handle permission errors
    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk mengubah data anggota');
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}

// DELETE /api/anggota/[id] - Soft delete member
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Check permission - require manage permission
    await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);

    const { id } = await context.params;
    const { data: existingAnggota } = await supabase
      .from('anggota')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existingAnggota) {
      return NextResponse.json(
        { error: 'Anggota tidak ditemukan' },
        { status: 404 }
      );
    }

    // Soft delete by setting deleted_at
    const { error } = await supabase
      .from('anggota')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting anggota:', error);
      return NextResponse.json(
        { error: 'Failed to delete anggota', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Anggota berhasil dihapus',
    });

  } catch (error: any) {
    console.error('Error in DELETE /api/anggota/[id]:', error);

    // Handle permission errors
    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk menghapus data anggota');
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}
