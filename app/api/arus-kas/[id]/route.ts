import { NextRequest, NextResponse } from 'next/server';
import { supabase, UpdateArusKasInput } from '@/lib/supabase';

// GET /api/arus-kas/[id] - Get single cash flow transaction by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: arusKas, error } = await supabase
      .from('arus_kas')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !arusKas) {
      return NextResponse.json(
        { error: 'Arus kas tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: arusKas });
  } catch (error) {
    console.error('Error in GET /api/arus-kas/[id]:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}

// PUT /api/arus-kas/[id] - Update cash flow transaction
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateArusKasInput = await request.json();

    // Check if transaction exists
    const { data: existingArusKas } = await supabase
      .from('arus_kas')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existingArusKas) {
      return NextResponse.json(
        { error: 'Arus kas tidak ditemukan' },
        { status: 404 }
      );
    }

    // Update arus kas
    const { data: updatedArusKas, error } = await supabase
      .from('arus_kas')
      .update({
        ...body,
        tanggal_transaksi: body.tanggal_transaksi !== undefined ? body.tanggal_transaksi : undefined,
        jenis_transaksi: body.jenis_transaksi !== undefined ? body.jenis_transaksi : undefined,
        kategori_transaksi: body.kategori_transaksi !== undefined ? body.kategori_transaksi : undefined,
        jumlah_transaksi: body.jumlah_transaksi !== undefined ? body.jumlah_transaksi : undefined,
        deskripsi: body.deskripsi !== undefined ? body.deskripsi : undefined,
        saldo_awal: body.saldo_awal !== undefined ? body.saldo_awal : undefined,
        saldo_akhir: body.saldo_akhir !== undefined ? body.saldo_akhir : undefined,
        metode_pembayaran: body.metode_pembayaran !== undefined ? body.metode_pembayaran : undefined,
        akun_bank: body.akun_bank !== undefined ? body.akun_bank : undefined,
        bukti_transaksi: body.bukti_transaksi !== undefined ? body.bukti_transaksi : undefined,
        catatan: body.catatan !== undefined ? body.catatan : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating arus kas:', error);
      return NextResponse.json(
        { error: 'Failed to update arus kas', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: updatedArusKas,
      message: 'Arus kas berhasil diupdate',
    });

  } catch (error) {
    console.error('Error in PUT /api/arus-kas/[id]:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}

// DELETE /api/arus-kas/[id] - Soft delete cash flow transaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if transaction exists
    const { data: existingArusKas } = await supabase
      .from('arus_kas')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existingArusKas) {
      return NextResponse.json(
        { error: 'Arus kas tidak ditemukan' },
        { status: 404 }
      );
    }

    // Soft delete by setting deleted_at
    const { error } = await supabase
      .from('arus_kas')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting arus kas:', error);
      return NextResponse.json(
        { error: 'Failed to delete arus kas', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Arus kas berhasil dihapus',
    });

  } catch (error) {
    console.error('Error in DELETE /api/arus-kas/[id]:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}
