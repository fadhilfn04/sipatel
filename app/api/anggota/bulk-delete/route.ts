import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requirePermission, notAuthenticatedResponse, unauthorizedResponse } from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';

// POST /api/anggota/bulk-delete - Bulk soft delete members (optimized single-query)
export async function POST(request: NextRequest) {
  try {
    // Check permission - require manage permission
    await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);

    const body = await request.json();
    const { ids, deleteAll, filters } = body;

    // Validate - either ids array or deleteAll flag must be provided
    if (!deleteAll && (!ids || !Array.isArray(ids) || ids.length === 0)) {
      return NextResponse.json(
        { error: 'Either provide an array of ids or set deleteAll to true' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Build a single UPDATE query with all filters applied directly.
    // Supabase .update() supports the same filter chain as .select(),
    // including .or(), .eq(), .in(), etc. — no need for a separate SELECT first.
    let query = supabase
      .from('anggota')
      .update({ deleted_at: now })
      .is('deleted_at', null);

    if (deleteAll && filters) {
      // Apply all filters directly to the UPDATE query in one shot
      if (filters.search) {
        query = query.or(
          `nama_anggota.ilike.%${filters.search}%,nik.ilike.%${filters.search}%,nama_cabang.ilike.%${filters.search}%`
        );
      }
      if (filters.kategori_anggota && filters.kategori_anggota !== 'all') {
        query = query.eq('kategori_anggota', filters.kategori_anggota);
      }
      if (filters.status_anggota && filters.status_anggota !== 'all') {
        query = query.eq('status_anggota', filters.status_anggota);
      }
      if (filters.status_mps && filters.status_mps !== 'all') {
        query = query.eq('status_mps', filters.status_mps);
      }
      if (filters.status_iuran && filters.status_iuran !== 'all') {
        query = query.eq('status_iuran', filters.status_iuran);
      }
      if (filters.nama_cabang && filters.nama_cabang !== 'all') {
        query = query.eq('nama_cabang', filters.nama_cabang);
      }
    } else if (ids && ids.length > 0) {
      query = query.in('id', ids);
    }

    // Execute update and get the count of affected rows
    const { data: deletedData, error } = await query.select('id');

    if (error) {
      console.error('Error bulk deleting anggota:', error);
      return NextResponse.json(
        { error: 'Failed to delete anggota', details: error.message },
        { status: 500 }
      );
    }

    const deletedCount = deletedData?.length || 0;

    return NextResponse.json({
      message: `${deletedCount} data anggota berhasil dihapus`,
      deletedCount,
    });
  } catch (error: any) {
    console.error('Error in POST /api/anggota/bulk-delete:', error);

    // Handle permission errors
    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk menghapus data anggota');
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server', details: error.message },
      { status: 500 }
    );
  }
}