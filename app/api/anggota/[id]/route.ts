import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { UpdateAnggotaInput } from '@/lib/supabase';
import { requirePermission, requireAnyPermission, notAuthenticatedResponse, unauthorizedResponse } from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';
import {
  buildAnggotaUpdatePayload,
  isAdminActor,
  recordMutasiIfCabangChanged,
  hasActiveDakemTransactions,
} from '@/lib/server/anggota-service';

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
    const user = await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);

    const { id } = await context.params;
    const body: UpdateAnggotaInput = await request.json();

    // Check if member exists
    const { data: existingAnggota } = await supabase
      .from('anggota')
      .select('*')
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

    // ── Approval perubahan data anggota ──────────────────────────────
    // Edit oleh non-admin → buat usulan approval; data utama TIDAK berubah.
    // Admin (penyetuju) dapat langsung mengubah data utama.
    if (!isAdminActor(user)) {
      const { error: proposalError } = await supabase
        .from('anggota_perubahan')
        .insert({
          anggota_id: id,
          jenis: 'edit',
          status: 'menunggu',
          data_sebelum: existingAnggota,
          data_usulan: body,
          alasan: (body as any).alasan_perubahan || null,
          diajukan_oleh: user.id,
        });

      if (proposalError) {
        console.error('Error creating anggota edit approval:', proposalError);
        return NextResponse.json(
          { error: 'Gagal membuat usulan perubahan anggota', details: proposalError.message },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { message: 'Usulan perubahan data anggota menunggu persetujuan admin.', status: 'menunggu' },
        { status: 202 }
      );
    }

    // Admin: terapkan perubahan langsung.
    const payload = buildAnggotaUpdatePayload(body);
    const { data: updatedAnggota, error } = await supabase
      .from('anggota')
      .update(payload)
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

    // Catat riwayat mutasi bila cabang berubah (append-only).
    await recordMutasiIfCabangChanged({
      before: existingAnggota,
      after: updatedAnggota,
      diajukanOleh: user.id,
      disetujuiOleh: user.id,
      alasan: (body as any).alasan_perubahan || null,
    });

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
    const user = await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);

    const { id } = await context.params;
    const { data: existingAnggota } = await supabase
      .from('anggota')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existingAnggota) {
      return NextResponse.json(
        { error: 'Anggota tidak ditemukan' },
        { status: 404 }
      );
    }

    // ── Approval penghapusan: non-admin mengajukan usulan hapus ──────
    // Admin (penyetuju) dapat langsung melakukan soft delete.
    if (!isAdminActor(user)) {
      const { error: proposalError } = await supabase
        .from('anggota_perubahan')
        .insert({
          anggota_id: id,
          jenis: 'hapus',
          status: 'menunggu',
          data_sebelum: existingAnggota,
          data_usulan: {},
          alasan: (request.nextUrl.searchParams.get('alasan')) || null,
          diajukan_oleh: user.id,
        });

      if (proposalError) {
        console.error('Error creating anggota delete approval:', proposalError);
        return NextResponse.json(
          { error: 'Gagal membuat usulan penghapusan anggota', details: proposalError.message },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { message: 'Usulan penghapusan anggota menunggu persetujuan admin.', status: 'menunggu' },
        { status: 202 }
      );
    }

    // Guard: cegah penghapusan yang merusak relasi / transaksi historis —
    // anggota dengan pengajuan Dana Kematian aktif tidak boleh dihapus.
    const hasActiveTransactions = await hasActiveDakemTransactions(id);
    if (hasActiveTransactions) {
      return NextResponse.json(
        {
          error:
            'Anggota masih memiliki pengajuan Dana Kematian aktif dan tidak dapat dihapus. ' +
            'Selesaikan atau batalkan pengajuan terkait terlebih dahulu.',
        },
        { status: 409 }
      );
    }

    // Soft delete by setting deleted_at (pola aplikasi: data historis dipertahankan)
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
