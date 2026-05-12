import { NextRequest, NextResponse } from 'next/server';
import { UpdateDanaKematianInput } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-storage';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  return supabaseAdmin;
}

// GET /api/dana-kematian/[id] - Get single death benefit claim by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: danaKematian, error } = await getClient()
      .from('dana_kematian')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !danaKematian) {
      return NextResponse.json(
        { error: 'Dana kematian not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: danaKematian });
  } catch (error) {
    console.error('Error in GET /api/dana-kematian/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/dana-kematian/[id] - Update death benefit claim
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateDanaKematianInput = await request.json();

    // Check if claim exists
    const { data: existingClaim } = await getClient()
      .from('dana_kematian')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existingClaim) {
      return NextResponse.json(
        { error: 'Dana kematian not found' },
        { status: 404 }
      );
    }

    // Update dana kematian
    const { data: updatedDanaKematian, error } = await getClient()
      .from('dana_kematian')
      .update({
        ...body,
        penyebab_meninggal: body.penyebab_meninggal !== undefined ? body.penyebab_meninggal : undefined,
        tanggal_lapor_keluarga: body.tanggal_lapor_keluarga !== undefined ? body.tanggal_lapor_keluarga : undefined,
        cabang_nama_pelapor: body.cabang_nama_pelapor !== undefined ? body.cabang_nama_pelapor : undefined,
        cabang_nik_pelapor: body.cabang_nik_pelapor !== undefined ? body.cabang_nik_pelapor : undefined,
        cabang_tanggal_awal_terima_berkas: body.cabang_tanggal_awal_terima_berkas !== undefined ? body.cabang_tanggal_awal_terima_berkas : undefined,
        cabang_tanggal_kirim_ke_pusat: body.cabang_tanggal_kirim_ke_pusat !== undefined ? body.cabang_tanggal_kirim_ke_pusat : undefined,
        pusat_tanggal_awal_terima: body.pusat_tanggal_awal_terima !== undefined ? body.pusat_tanggal_awal_terima : undefined,
        pusat_tanggal_validasi: body.pusat_tanggal_validasi !== undefined ? body.pusat_tanggal_validasi : undefined,
        pusat_tanggal_selesai: body.pusat_tanggal_selesai !== undefined ? body.pusat_tanggal_selesai : undefined,
        cabang_tanggal_serah_ke_ahli_waris: body.cabang_tanggal_serah_ke_ahli_waris !== undefined ? body.cabang_tanggal_serah_ke_ahli_waris : undefined,
        cabang_tanggal_lapor_ke_pusat: body.cabang_tanggal_lapor_ke_pusat !== undefined ? body.cabang_tanggal_lapor_ke_pusat : undefined,
        file_sk_pensiun: body.file_sk_pensiun !== undefined ? body.file_sk_pensiun : undefined,
        file_surat_kematian: body.file_surat_kematian !== undefined ? body.file_surat_kematian : undefined,
        file_surat_pernyataan_ahli_waris: body.file_surat_pernyataan_ahli_waris !== undefined ? body.file_surat_pernyataan_ahli_waris : undefined,
        file_kartu_keluarga: body.file_kartu_keluarga !== undefined ? body.file_kartu_keluarga : undefined,
        file_e_ktp: body.file_e_ktp !== undefined ? body.file_e_ktp : undefined,
        file_surat_nikah: body.file_surat_nikah !== undefined ? body.file_surat_nikah : undefined,
        keterangan: body.keterangan !== undefined ? body.keterangan : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating dana kematian:', error);
      return NextResponse.json(
        { error: 'Failed to update dana kematian', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: updatedDanaKematian,
      message: 'Dana kematian berhasil diupdate',
    });

  } catch (error) {
    console.error('Error in PUT /api/dana-kematian/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/dana-kematian/[id] - Soft delete death benefit claim
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Check if claim exists
    const { data: existingClaim } = await getClient()
      .from('dana_kematian')
      .select('id, status_proses')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existingClaim) {
      return NextResponse.json(
        { error: 'Dana kematian not found' },
        { status: 404 }
      );
    }

    // Prevent deletion if already completed
    if (existingClaim.status_proses === 'selesai') {
      return NextResponse.json(
        { error: 'Cannot delete claim that has been completed' },
        { status: 400 }
      );
    }

    // Soft delete by setting deleted_at
    const { error } = await getClient()
      .from('dana_kematian')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting dana kematian:', error);
      return NextResponse.json(
        { error: 'Failed to delete dana kematian', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Dana kematian berhasil dihapus',
    });

  } catch (error) {
    console.error('Error in DELETE /api/dana-kematian/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
