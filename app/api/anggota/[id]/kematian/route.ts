import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';
import {
  requireAnyPermission,
  notAuthenticatedResponse,
  unauthorizedResponse,
} from '@/lib/rbac-server';
import { ENTRY_KEMATIAN_VIEW_PERMISSIONS } from '@/lib/rbac';
import { ANGGOTA_KEMATIAN_WITH_ANGGOTA_SELECT } from '@/lib/server/anggota-kematian-service';

function getClient() {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  }
  return supabaseAdmin;
}

/**
 * GET /api/anggota/[id]/kematian
 *
 * Lookup data kematian untuk anggota tertentu. Dipakai oleh form pengajuan
 * Dana Kematian untuk prefill tanggal meninggal & dokumen yang sudah pernah
 * diinput (reuse data, tanpa membuat duplikasi).
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAnyPermission([...ENTRY_KEMATIAN_VIEW_PERMISSIONS]);

    const { id } = await context.params;
    const client = getClient();

    const { data, error } = await client
      .from('anggota_kematian')
      .select(ANGGOTA_KEMATIAN_WITH_ANGGOTA_SELECT)
      .eq('anggota_id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('Error fetching anggota_kematian:', error);
      return NextResponse.json(
        { error: 'Gagal memuat data kematian anggota', details: error.message },
        { status: 500 },
      );
    }

    // 200 + data null = anggota belum punya catatan kematian (bukan error).
    return NextResponse.json({ data: data ?? null });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses ke data kematian anggota');
    }
    console.error('Error in GET /api/anggota/[id]/kematian:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
