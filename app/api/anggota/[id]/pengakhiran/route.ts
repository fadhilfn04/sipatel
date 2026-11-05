import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';
import {
  requireAnyPermission,
  notAuthenticatedResponse,
  unauthorizedResponse,
} from '@/lib/rbac-server';
import { PENGAKHIRAN_VIEW_PERMISSIONS } from '@/lib/rbac';
import { PENGAKHIRAN_WITH_ANGGOTA_SELECT } from '@/lib/server/pengakhiran-keanggotaan-service';

function getClient() {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  }
  return supabaseAdmin;
}

/**
 * GET /api/anggota/[id]/pengakhiran
 *
 * Lookup status pengakhiran keanggotaan untuk anggota tertentu. Dipakai untuk
 * guard/prefill di modul lain (mis. memblokir pengajuan baru untuk anggota
 * yang sedang dalam proses berhenti / sudah berhenti).
 *
 * Mengembalikan data pengakhiran terakhir (aktif atau final), atau null.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAnyPermission([...PENGAKHIRAN_VIEW_PERMISSIONS]);

    const { id } = await context.params;
    const client = getClient();

    const { data, error } = await client
      .from('pengakhiran_keanggotaan')
      .select(PENGAKHIRAN_WITH_ANGGOTA_SELECT)
      .eq('anggota_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching pengakhiran anggota:', error);
      return NextResponse.json(
        { error: 'Gagal memuat data pengakhiran anggota', details: error.message },
        { status: 500 },
      );
    }

    // 200 + data null = anggota belum punya catatan pengakhiran (bukan error).
    return NextResponse.json({ data: data ?? null });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses ke data pengakhiran anggota');
    }
    console.error('Error in GET /api/anggota/[id]/pengakhiran:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
