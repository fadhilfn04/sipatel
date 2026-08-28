import { NextRequest, NextResponse } from 'next/server';
import { supabase, UpdateLaporanPeriodeInput } from '@/lib/supabase';

// GET /api/laporan-periode/[id] - Get single period report by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: laporan, error } = await supabase
      .from('laporan_periode')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !laporan) {
      return NextResponse.json(
        { error: 'Laporan periode tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: laporan });
  } catch (error) {
    console.error('Error in GET /api/laporan-periode/[id]:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}

// PUT /api/laporan-periode/[id] - Update period report
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateLaporanPeriodeInput = await request.json();

    // Check if report exists
    const { data: existingLaporan } = await supabase
      .from('laporan_periode')
      .select('id, status_laporan')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existingLaporan) {
      return NextResponse.json(
        { error: 'Laporan periode tidak ditemukan' },
        { status: 404 }
      );
    }

    // Prevent modification if already approved
    if (existingLaporan.status_laporan === 'approved' && body.status_laporan !== 'approved') {
      return NextResponse.json(
        { error: 'Cannot modify approved report' },
        { status: 400 }
      );
    }

    // Update laporan periode
    const { data: updatedLaporan, error } = await supabase
      .from('laporan_periode')
      .update({
        ...body,
        total_pendapatan: body.total_pendapatan !== undefined ? body.total_pendapatan : undefined,
        total_pengeluaran: body.total_pengeluaran !== undefined ? body.total_pengeluaran : undefined,
        laba_bersih: body.laba_bersih !== undefined ? body.laba_bersih : undefined,
        marjin_laba: body.marjin_laba !== undefined ? body.marjin_laba : undefined,
        status_laporan: body.status_laporan !== undefined ? body.status_laporan : undefined,
        catatan: body.catatan !== undefined ? body.catatan : undefined,
        diverifikasi_oleh: body.diverifikasi_oleh !== undefined ? body.diverifikasi_oleh : undefined,
        tanggal_disetujui: body.tanggal_disetujui !== undefined ? body.tanggal_disetujui : undefined,
        file_laporan: body.file_laporan !== undefined ? body.file_laporan : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating laporan periode:', error);
      return NextResponse.json(
        { error: 'Failed to update laporan periode', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: updatedLaporan,
      message: 'Laporan periode berhasil diupdate',
    });

  } catch (error) {
    console.error('Error in PUT /api/laporan-periode/[id]:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}

// DELETE /api/laporan-periode/[id] - Soft delete period report
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if report exists
    const { data: existingLaporan } = await supabase
      .from('laporan_periode')
      .select('id, status_laporan')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existingLaporan) {
      return NextResponse.json(
        { error: 'Laporan periode tidak ditemukan' },
        { status: 404 }
      );
    }

    // Prevent deletion if already approved
    if (existingLaporan.status_laporan === 'approved') {
      return NextResponse.json(
        { error: 'Cannot delete approved report' },
        { status: 400 }
      );
    }

    // Soft delete by setting deleted_at
    const { error } = await supabase
      .from('laporan_periode')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting laporan periode:', error);
      return NextResponse.json(
        { error: 'Failed to delete laporan periode', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Laporan periode berhasil dihapus',
    });

  } catch (error) {
    console.error('Error in DELETE /api/laporan-periode/[id]:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}
