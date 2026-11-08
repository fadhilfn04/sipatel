import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-storage';
import { requirePermission, unauthorizedResponse } from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';

/**
 * GET /api/anggota/[id]/history
 *
 * Riwayat perubahan anggota — kini bersumber dari `audit_log` (migration 036,
 * audit trail terpusat). Bentuk respons dipertahankan kompatibel dengan
 * HistoryTimeline (`changed_data`/`previous_data`/`changed_by_user`), plus
 * field tambahan `module`/`reason`/`source`.
 *
 * Fallback ke `anggota_history` (legacy) hanya bila tabel `audit_log` belum
 * tersedia (migration 036 belum dijalankan).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePermission(PERMISSIONS.HISTORY_ANGGOTA_VIEW);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const client = supabaseAdmin ?? supabase;

    // 1) Baca dari audit_log (terpusat).
    const { data: history, error } = await client
      .from('audit_log')
      .select('*')
      .eq('anggota_id', id)
      .order('occurred_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { count } = await client
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('anggota_id', id);

    // Fallback: migration 036 belum dijalankan → pakai tabel lama.
    if (error && (error.code === '42P01' || /does not exist/i.test(error.message || ''))) {
      const { data: legacyHistory, error: legacyError } = await client
        .from('anggota_history')
        .select('*')
        .eq('anggota_id', id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (legacyError) {
        return NextResponse.json(
          { error: 'Failed to fetch history', details: legacyError.message },
          { status: 500 }
        );
      }

      const { count: legacyCount } = await client
        .from('anggota_history')
        .select('*', { count: 'exact', head: true })
        .eq('anggota_id', id);

      return NextResponse.json({
        data: (legacyHistory || []).map((h: any) => ({
          ...h,
          changed_by_user: null,
        })),
        pagination: { total: legacyCount || 0, limit, offset },
      });
    }

    if (error) {
      console.error('Error fetching anggota history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch history', details: error.message },
        { status: 500 }
      );
    }

    // 2) Petakan ke bentuk kompatibel (aktor adalah snapshot di audit_log).
    const enrichedHistory = (history || []).map((h: any) => ({
      id: h.id,
      anggota_id: h.anggota_id,
      action: h.action,
      changed_by: h.actor_user_id ?? null,
      changed_data: h.new_values,
      previous_data: h.old_values,
      changed_fields: h.changed_fields ?? [],
      created_at: h.occurred_at,
      changed_by_user: h.actor_name
        ? { id: h.actor_user_id, email: null, full_name: h.actor_name }
        : null,
      module: h.module,
      reason: h.reason,
      source: h.source,
    }));

    return NextResponse.json({
      data: enrichedHistory,
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/anggota/[id]/history:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server', details: error.message },
      { status: 500 }
    );
  }
}
