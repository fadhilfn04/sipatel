import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  notifyDanaSosialDisetujui,
  notifyDanaSosialDitolak,
  notifyDanaSosialDisalurkan,
} from '@/lib/server/create-notification';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data, error } = await supabase
      .from('dana_sosial')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: 'Dana sosial tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching dana sosial:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dana sosial' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if dana sosial exists
    const { data: existing } = await supabase
      .from('dana_sosial')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Dana sosial tidak ditemukan' },
        { status: 404 }
      );
    }

    // Validate anggota_id if provided
    if (body.anggota_id) {
      const { data: anggota } = await supabase
        .from('anggota')
        .select('id')
        .eq('id', body.anggota_id)
        .is('deleted_at', null)
        .single();

      if (!anggota) {
        return NextResponse.json(
          { error: 'Anggota tidak ditemukan' },
          { status: 404 }
        );
      }
    }

    // Validate jumlah_diajukan if provided
    if (body.jumlah_diajukan !== undefined && body.jumlah_diajukan < 0) {
      return NextResponse.json(
        { error: 'Jumlah diajukan must be greater than or equal to 0' },
        { status: 400 }
      );
    }

    // Validate jumlah_disetujui if provided
    if (body.jumlah_disetujui !== undefined && body.jumlah_disetujui < 0) {
      return NextResponse.json(
        { error: 'Jumlah disetujui must be greater than or equal to 0' },
        { status: 400 }
      );
    }

    // Update data
    const { data, error } = await supabase
      .from('dana_sosial')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Fire notification on status_pengajuan change (non-blocking)
    const newStatus = body.status_pengajuan;
    if (newStatus && newStatus !== existing.status_pengajuan) {
      const nama = existing.nama_pemohon;
      const jumlah = data.jumlah_disetujui ?? 0;
      if (newStatus === 'Disetujui') notifyDanaSosialDisetujui(id, nama, jumlah);
      else if (newStatus === 'Ditolak') notifyDanaSosialDitolak(id, nama);
      else if (newStatus === 'Disalurkan' || newStatus === 'Selesai') notifyDanaSosialDisalurkan(id, nama, jumlah);
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating dana sosial:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update dana sosial' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if dana sosial exists
    const { data: existing } = await supabase
      .from('dana_sosial')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Dana sosial tidak ditemukan' },
        { status: 404 }
      );
    }

    // Prevent deletion of completed or disbursed assistance
    if (existing.status_pengajuan === 'Disalurkan' || existing.status_pengajuan === 'Selesai') {
      return NextResponse.json(
        { error: 'Cannot delete disbursed or completed assistance' },
        { status: 400 }
      );
    }

    // Soft delete
    const { error } = await supabase
      .from('dana_sosial')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ message: 'Dana sosial berhasil dihapus' });
  } catch (error: any) {
    console.error('Error deleting dana sosial:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete dana sosial' },
      { status: 500 }
    );
  }
}
