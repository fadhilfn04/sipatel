import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requirePermission, requireAnyPermission, notAuthenticatedResponse, unauthorizedResponse } from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';
import { UpdateMasterCabangInput } from '@/lib/supabase';

// GET /api/master-cabang/[id] - Get single branch by ID
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAnyPermission([
      PERMISSIONS.VIEW_KEANGGOTAAN,
      PERMISSIONS.MANAGE_KEANGGOTAAN,
      PERMISSIONS.ACCESS_DANA_KEMATIAN,
      PERMISSIONS.ACCESS_DANA_SOCIAL,
    ]);

    const { id } = await context.params;
    const { data: cabang, error } = await supabase
      .from('master_cabang')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !cabang) {
      return NextResponse.json(
        { error: 'Cabang tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: cabang });
  } catch (error: any) {
    console.error('Error in GET /api/master-cabang/[id]:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk melihat data cabang');
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server', details: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/master-cabang/[id] - Update branch master record
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);

    const { id } = await context.params;
    const body: UpdateMasterCabangInput = await request.json();

    const { data: existing } = await supabase
      .from('master_cabang')
      .select('id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Cabang tidak ditemukan' },
        { status: 404 }
      );
    }

    // Check duplicate kode_cabang if changed
    if (body.kode_cabang) {
      const { data: duplicate } = await supabase
        .from('master_cabang')
        .select('id')
        .eq('kode_cabang', body.kode_cabang)
        .neq('id', id)
        .single();

      if (duplicate) {
        return NextResponse.json(
          { error: `Kode cabang '${body.kode_cabang}' already exists` },
          { status: 409 }
        );
      }
    }

    const { data: updatedCabang, error } = await supabase
      .from('master_cabang')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating master_cabang:', error);
      return NextResponse.json(
        { error: 'Failed to update cabang', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: updatedCabang,
      message: 'Cabang berhasil diupdate',
    });

  } catch (error: any) {
    console.error('Error in PUT /api/master-cabang/[id]:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk mengubah data cabang');
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/master-cabang/[id] - Soft delete (set is_active = false)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);

    const { id } = await context.params;

    const { data: existing } = await supabase
      .from('master_cabang')
      .select('id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Cabang tidak ditemukan' },
        { status: 404 }
      );
    }

    // Soft delete: deactivate instead of hard delete to preserve anggota references
    const { error } = await supabase
      .from('master_cabang')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting master_cabang:', error);
      return NextResponse.json(
        { error: 'Failed to delete cabang', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Cabang berhasil dinonaktifkan',
    });

  } catch (error: any) {
    console.error('Error in DELETE /api/master-cabang/[id]:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk menghapus data cabang');
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server', details: error.message },
      { status: 500 }
    );
  }
}