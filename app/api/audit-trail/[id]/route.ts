import { NextRequest, NextResponse } from 'next/server';
import {
  notAuthenticatedResponse,
  requirePermission,
  unauthorizedResponse,
} from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';
import { supabaseAdmin } from '@/lib/supabase-storage';

/**
 * GET /api/audit-trail/[id] — Detail satu baris audit (old/new values lengkap).
 * Butuh permission AUDIT_TRAIL_VIEW. Nilai sensitif sudah dimasking di level
 * trigger (norek_bank dsb.) sehingga aman untuk ditampilkan.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(PERMISSIONS.AUDIT_TRAIL_VIEW);

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase admin client tidak dikonfigurasi' },
        { status: 503 },
      );
    }

    const { id } = await context.params;
    const { data, error } = await supabaseAdmin
      .from('audit_log')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      if (error.code === '42P01' || /does not exist/i.test(error.message || '')) {
        return NextResponse.json(
          { error: 'Audit trail belum diaktifkan (migration 036 belum dijalankan)' },
          { status: 501 },
        );
      }
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: 'Data audit tidak ditemukan' }, { status: 404 });
    }

    // Enrich info anggota bila ada.
    let anggota = null;
    if (data.anggota_id) {
      const { data: anggotaRow } = await supabaseAdmin
        .from('anggota')
        .select('id, nik, nama_anggota, nama_cabang')
        .eq('id', data.anggota_id)
        .maybeSingle();
      anggota = anggotaRow ?? null;
    }

    return NextResponse.json({ data: { ...data, anggota } });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk melihat audit trail');
    }
    console.error('Error in GET /api/audit-trail/[id]:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server', details: error.message },
      { status: 500 },
    );
  }
}
