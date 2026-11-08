import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';
import { getActorClient } from '@/lib/supabase-actor';
import {
  requirePermission,
  notAuthenticatedResponse,
  unauthorizedResponse,
} from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';
import {
  getMutasiCabangStatusConfig,
  isValidMutasiCabangTransition,
} from '@/lib/workflow/mutasi-cabang-status';

async function getClient(request?: NextRequest) {
  // Client dengan header aktor — audit_log mencatat pelaku (migration 036).
  return getActorClient({ request });
}

function actorName(user: { name?: string | null; email?: string | null; id: string }): string {
  return user.name || user.email || user.id;
}

/**
 * GET /api/mutasi-cabang/[id]
 *
 * Detail pengajuan mutasi cabang — khusus pengurus/admin (manage keanggotaan).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);

    const { id } = await context.params;
    const client = await getClient(request);

    const { data, error } = await client
      .from('pengajuan_mutasi_cabang')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching pengajuan mutasi cabang:', error);
      return NextResponse.json(
        { error: 'Gagal mengambil detail pengajuan mutasi cabang', details: error.message },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json({ error: 'Pengajuan mutasi cabang tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses ke pengajuan mutasi cabang');
    }
    console.error('Error in GET /api/mutasi-cabang/[id]:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}

/**
 * PATCH /api/mutasi-cabang/[id]
 *
 * Mekanisme pencatatan status pengajuan — dasar verifikasi admin/PC/PP.
 * body: { status: 'diverifikasi_pc'|'disetujui_pp'|'ditolak'|'dibatalkan', catatan? }
 *
 * Khusus pengurus/admin (manage keanggotaan). Transisi divalidasi terhadap
 * workflow yang diizinkan (lib/workflow/mutasi-cabang-status.ts).
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);

    const { id } = await context.params;
    const body = await request.json();
    const targetStatus = body?.status;
    const catatan = body?.catatan ? String(body.catatan).trim() : null;

    const statusConfig = getMutasiCabangStatusConfig(targetStatus);
    if (statusConfig.value === 'unknown') {
      return NextResponse.json({ error: 'Status tujuan tidak valid', code: 'INVALID_STATUS' }, { status: 400 });
    }

    const client = await getClient(request);

    const { data: existing, error: existingError } = await client
      .from('pengajuan_mutasi_cabang')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (existingError) {
      console.error('Error fetching pengajuan mutasi cabang:', existingError);
      return NextResponse.json(
        { error: 'Gagal memuat pengajuan mutasi cabang', details: existingError.message },
        { status: 500 },
      );
    }

    if (!existing) {
      return NextResponse.json({ error: 'Pengajuan mutasi cabang tidak ditemukan' }, { status: 404 });
    }

    if (!isValidMutasiCabangTransition(existing.status, targetStatus)) {
      return NextResponse.json(
        {
          error: `Transisi status dari "${existing.status}" ke "${targetStatus}" tidak diizinkan.`,
          code: 'INVALID_TRANSITION',
        },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: targetStatus,
      updated_at: now,
    };

    if (targetStatus === 'diverifikasi_pc') {
      updatePayload.diverifikasi_oleh = actorName(user);
      updatePayload.diverifikasi_pada = now;
      updatePayload.catatan_verifikasi = catatan;
    }

    if (targetStatus === 'disetujui_pp' || targetStatus === 'ditolak') {
      updatePayload.diputuskan_oleh = actorName(user);
      updatePayload.diputuskan_pada = now;
      updatePayload.alasan_keputusan = catatan;
    }

    const { data, error } = await client
      .from('pengajuan_mutasi_cabang')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating pengajuan mutasi cabang:', error);
      return NextResponse.json(
        { error: 'Gagal memperbarui status pengajuan', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ data, message: 'Status pengajuan berhasil diperbarui.' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk memperbarui status pengajuan');
    }
    console.error('Error in PATCH /api/mutasi-cabang/[id]:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
