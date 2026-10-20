import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requirePermission, notAuthenticatedResponse, unauthorizedResponse } from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';

/**
 * GET /api/anggota/[id]/mutasi — riwayat mutasi anggota antar-cabang.
 * Riwayat bersifat append-only: mutasi berikutnya menambah baris, tidak
 * mengubah histori cabang sebelumnya.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.HISTORY_ANGGOTA_VIEW);

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    const { data, error } = await supabase
      .from('anggota_mutasi')
      .select('*')
      .eq('anggota_id', id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching anggota mutasi:', error);
      return NextResponse.json({ error: 'Gagal mengambil riwayat mutasi', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') return unauthorizedResponse('Anda tidak memiliki akses ke history anggota');
    console.error('Error in GET /api/anggota/[id]/mutasi:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
