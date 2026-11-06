import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';
import {
  requireAnyPermission,
  notAuthenticatedResponse,
  unauthorizedResponse,
} from '@/lib/rbac-server';
import { KEPENGURUSAN_VIEW_PERMISSIONS } from '@/lib/rbac';
import { KEPENGURUSAN_WITH_ANGGOTA_SELECT } from '@/lib/server/kepengurusan-service';

function getClient() {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  }
  return supabaseAdmin;
}

/**
 * GET /api/anggota/[id]/kepengurusan
 *
 * Lookup riwayat perubahan kepengurusan untuk anggota tertentu (untuk panel
 * riwayat di halaman Perubahan Kepengurusan). Mengembalikan array (boleh kosong).
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAnyPermission([...KEPENGURUSAN_VIEW_PERMISSIONS]);

    const { id } = await context.params;
    const client = getClient();

    const { data, error } = await client
      .from('anggota_kepengurusan')
      .select(KEPENGURUSAN_WITH_ANGGOTA_SELECT)
      .eq('anggota_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching kepengurusan anggota:', error);
      return NextResponse.json(
        { error: 'Gagal memuat riwayat kepengurusan anggota', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses ke riwayat kepengurusan anggota');
    }
    console.error('Error in GET /api/anggota/[id]/kepengurusan:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
