import { NextRequest, NextResponse } from 'next/server';
import { supabase, UpdatePembayaranSumbanganInput } from '@/lib/supabase';
import { requirePermission, notAuthenticatedResponse, unauthorizedResponse } from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';

// GET /api/pembayaran-sumbangan/[id] - Get single payment by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requirePermission(PERMISSIONS.VIEW_IURAN);

  try {
    const { id } = await params;
    const { data: pembayaran, error } = await supabase
      .from('pembayaran_sumbangan')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      console.error('Error fetching pembayaran sumbangan:', error);
      return NextResponse.json(
        { error: 'Pembayaran sumbangan tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: pembayaran });
  } catch (error: any) {
    console.error('Error in GET /api/pembayaran-sumbangan/[id]:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk melihat data iuran');
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server', details: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/pembayaran-sumbangan/[id] - Update payment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requirePermission(PERMISSIONS.MANAGE_IURAN);

  try {
    const { id } = await params;
    const body: UpdatePembayaranSumbanganInput = await request.json();

    // Check if payment exists
    const { data: existing } = await supabase
      .from('pembayaran_sumbangan')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Pembayaran sumbangan tidak ditemukan' },
        { status: 404 }
      );
    }

    // Clean empty strings for optional fields (convert to null)
    const cleanedData: Record<string, any> = {
      ...body,
      // Convert empty strings to null for date fields
      tanggal_verifikasi: body.tanggal_verifikasi === '' ? null : body.tanggal_verifikasi,
      diverifikasi_oleh: body.diverifikasi_oleh === '' ? null : body.diverifikasi_oleh,
      catatan_verifikasi: body.catatan_verifikasi === '' ? null : body.catatan_verifikasi,
      keterangan_pembayaran: body.keterangan_pembayaran === '' ? null : body.keterangan_pembayaran,
      metode_pembayaran: body.metode_pembayaran === '' ? null : body.metode_pembayaran,
      bukti_pembayaran: body.bukti_pembayaran === '' ? null : body.bukti_pembayaran,
      nomor_referensi: body.nomor_referensi === '' ? null : body.nomor_referensi,
      updated_at: new Date().toISOString(),
    };

    // Update pembayaran sumbangan
    const { data: updatedPembayaran, error } = await supabase
      .from('pembayaran_sumbangan')
      .update(cleanedData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating pembayaran sumbangan:', error);
      return NextResponse.json(
        { error: 'Failed to update pembayaran sumbangan', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: updatedPembayaran,
      message: 'Pembayaran sumbangan berhasil diperbarui',
    });
  } catch (error: any) {
    console.error('Error in PUT /api/pembayaran-sumbangan/[id]:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk mengubah data iuran');
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/pembayaran-sumbangan/[id] - Soft delete payment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requirePermission(PERMISSIONS.MANAGE_IURAN);

  try {
    const { id } = await params;
    // Check if payment exists
    const { data: existing } = await supabase
      .from('pembayaran_sumbangan')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Pembayaran sumbangan tidak ditemukan' },
        { status: 404 }
      );
    }

    // Soft delete
    const { error } = await supabase
      .from('pembayaran_sumbangan')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting pembayaran sumbangan:', error);
      return NextResponse.json(
        { error: 'Failed to delete pembayaran sumbangan', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Pembayaran sumbangan berhasil dihapus',
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/pembayaran-sumbangan/[id]:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk menghapus data iuran');
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server', details: error.message },
      { status: 500 }
    );
  }
}
