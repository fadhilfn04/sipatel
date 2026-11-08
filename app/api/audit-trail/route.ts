import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentUser,
  notAuthenticatedResponse,
  requirePermission,
  unauthorizedResponse,
} from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';
import { supabaseAdmin } from '@/lib/supabase-storage';

/**
 * GET /api/audit-trail — Riwayat Aktivitas (audit trail terpusat).
 *
 * Filter: anggota_id, module, table_name, action, actor_user_id, search
 * (entity_id / actor_name), from, to (YYYY-MM-DD), page, limit.
 * Export CSV: ?export=csv (butuh permission AUDIT_TRAIL_EXPORT).
 *
 * Butuh permission AUDIT_TRAIL_VIEW. Migration 036 harus sudah dijalankan;
 * bila tabel audit_log belum ada, merespons data kosong + auditEnabled=false
 * agar UI tetap dapat menampilkan pemandu aktivasi.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return notAuthenticatedResponse();
    }

    // Ekspor CSV memakai permission terpisah (view tetap wajib).
    const wantsExport = request.nextUrl.searchParams.get('export') === 'csv';
    if (wantsExport) {
      const admin = await requirePermission(PERMISSIONS.AUDIT_TRAIL_EXPORT).catch(() => null);
      if (!admin) {
        return unauthorizedResponse('Anda tidak memiliki akses untuk mengekspor audit trail');
      }
    } else {
      await requirePermission(PERMISSIONS.AUDIT_TRAIL_VIEW);
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase admin client tidak dikonfigurasi' },
        { status: 503 },
      );
    }

    const { searchParams } = new URL(request.url);
    const anggotaId = searchParams.get('anggota_id') || '';
    const module = searchParams.get('module') || '';
    const tableName = searchParams.get('table_name') || '';
    const action = searchParams.get('action') || '';
    const actorUserId = searchParams.get('actor_user_id') || '';
    const search = searchParams.get('search') || '';
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = wantsExport
      ? 5000
      : Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('occurred_at', { ascending: false });

    if (anggotaId) query = query.eq('anggota_id', anggotaId);
    if (module) query = query.eq('module', module);
    if (tableName) query = query.eq('table_name', tableName);
    if (action) query = query.eq('action', action);
    if (actorUserId) query = query.eq('actor_user_id', actorUserId);
    if (search) {
      query = query.or(`entity_id.ilike.%${search}%,actor_name.ilike.%${search}%`);
    }
    if (from) query = query.gte('occurred_at', `${from}T00:00:00.000Z`);
    if (to) query = query.lte('occurred_at', `${to}T23:59:59.999Z`);

    // ── Ekspor CSV ────────────────────────────────────────────────
    if (wantsExport) {
      const { data: rows, error } = await query.limit(limit);
      if (error) throw error;

      const header = [
        'waktu', 'pengguna', 'role', 'modul', 'aksi', 'tabel', 'entity_id',
        'field_berubah', 'sumber', 'ip',
      ];
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = [header.join(',')];
      for (const r of rows || []) {
        lines.push([
          esc(r.occurred_at),
          esc(r.actor_name || r.actor_user_id || 'system'),
          esc(r.actor_role_slug),
          esc(r.module),
          esc(r.action),
          esc(r.table_name),
          esc(r.entity_id),
          esc((r.changed_fields || []).join(' | ')),
          esc(r.source),
          esc(r.ip_address),
        ].join(','));
      }

      return new NextResponse(lines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit-trail-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      // Migration 036 belum dijalankan — UI menampilkan pemandu aktivasi.
      if (error.code === '42P01' || /does not exist/i.test(error.message || '')) {
        return NextResponse.json({
          data: [],
          pagination: { total: 0, page, limit },
          auditEnabled: false,
          message:
            'Tabel audit_log belum tersedia. Jalankan migration 036_create_audit_trail.sql untuk mengaktifkan audit trail.',
        });
      }
      throw error;
    }

    // Enrich info anggota (NIK/nama) untuk penelusuran cepat.
    const anggotaIds = Array.from(
      new Set((data || []).map((r: any) => r.anggota_id).filter(Boolean)),
    ) as string[];

    let anggotaMap = new Map<string, any>();
    if (anggotaIds.length > 0) {
      const { data: anggotaRows } = await supabaseAdmin
        .from('anggota')
        .select('id, nik, nama_anggota, nama_cabang')
        .in('id', anggotaIds);
      anggotaMap = new Map((anggotaRows || []).map((a: any) => [a.id, a]));
    }

    const enriched = (data || []).map((r: any) => ({
      ...r,
      anggota: r.anggota_id ? anggotaMap.get(r.anggota_id) ?? null : null,
    }));

    return NextResponse.json({
      data: enriched,
      pagination: {
        total: count || 0,
        page,
        limit,
      },
      auditEnabled: true,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk melihat audit trail');
    }
    console.error('Error in GET /api/audit-trail:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server', details: error.message },
      { status: 500 },
    );
  }
}

