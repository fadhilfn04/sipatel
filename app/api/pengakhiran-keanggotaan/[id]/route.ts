import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';
import { getActorClient } from '@/lib/supabase-actor';
import {
  requireAnyPermission,
  notAuthenticatedResponse,
  unauthorizedResponse,
} from '@/lib/rbac-server';
import {
  PENGAKHIRAN_MANAGE_PERMISSIONS,
  PENGAKHIRAN_VIEW_PERMISSIONS,
} from '@/lib/rbac';
import {
  getPengakhiranStatusConfig,
  isValidPengakhiranTransition,
} from '@/lib/workflow/pengakhiran-keanggotaan-status';
import {
  PENGAKHIRAN_WITH_ANGGOTA_SELECT,
  markAnggotaBerhenti,
} from '@/lib/server/pengakhiran-keanggotaan-service';

async function getClient(request?: NextRequest) {
  // Client dengan header aktor — audit_log mencatat pelaku (migration 036).
  return getActorClient({ request });
}

function actorName(user: { name?: string | null; email?: string | null; id: string }): string {
  return user.name || user.email || user.id;
}

/**
 * GET /api/pengakhiran-keanggotaan/[id]
 *
 * Detail pengajuan pengakhiran keanggotaan — pengurus/admin.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAnyPermission([...PENGAKHIRAN_VIEW_PERMISSIONS]);

    const { id } = await context.params;
    const client = await getClient(request);

    const { data, error } = await client
      .from('pengakhiran_keanggotaan')
      .select(PENGAKHIRAN_WITH_ANGGOTA_SELECT)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('Error fetching pengakhiran_keanggotaan:', error);
      return NextResponse.json(
        { error: 'Gagal mengambil detail pengakhiran keanggotaan', details: error.message },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json({ error: 'Pengakhiran keanggotaan tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses ke pengakhiran keanggotaan');
    }
    console.error('Error in GET /api/pengakhiran-keanggotaan/[id]:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}

/**
 * PATCH /api/pengakhiran-keanggotaan/[id]
 *
 * Verifikasi PC / keputusan PP / pembatalan.
 * body: { status: 'diverifikasi_pc'|'disetujui_pp'|'ditolak'|'dibatalkan', catatan? }
 *
 * Saat transisi ke 'disetujui_pp': status_keanggotaan anggota diset 'berhenti'
 * LEBIH DULU. Bila gagal, update baris pengajuan dibatalkan (status tetap
 * 'diverifikasi_pc' sehingga dapat diulang) — pelajaran dari gap Mutasi Cabang.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAnyPermission([...PENGAKHIRAN_MANAGE_PERMISSIONS]);

    const { id } = await context.params;
    const body = await request.json();
    const targetStatus = body?.status;
    const catatan = body?.catatan ? String(body.catatan).trim() : null;

    const statusConfig = getPengakhiranStatusConfig(targetStatus);
    if (statusConfig.value === 'unknown') {
      return NextResponse.json(
        { error: 'Status tujuan tidak valid', code: 'INVALID_STATUS' },
        { status: 400 },
      );
    }

    const client = await getClient(request);

    const { data: existing, error: existingError } = await client
      .from('pengakhiran_keanggotaan')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingError) {
      console.error('Error fetching pengakhiran_keanggotaan:', existingError);
      return NextResponse.json(
        { error: 'Gagal memuat pengakhiran keanggotaan', details: existingError.message },
        { status: 500 },
      );
    }
    if (!existing) {
      return NextResponse.json({ error: 'Pengakhiran keanggotaan tidak ditemukan' }, { status: 404 });
    }

    if (!isValidPengakhiranTransition(existing.status, targetStatus)) {
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

    // Apply status anggota LEBIH DULU untuk 'disetujui_pp' agar tidak ada
    // pengakhiran disetujui tanpa status anggota yang konsisten.
    if (targetStatus === 'disetujui_pp') {
      const applied = await markAnggotaBerhenti(existing.anggota_id, client);
      if (!applied.updated && applied.error) {
        return NextResponse.json(
          {
            error:
              'Gagal memperbarui status keanggotaan anggota. Persetujuan dibatalkan, silakan coba lagi.',
            details: applied.error,
            code: 'STATUS_SYNC_FAILED',
          },
          { status: 502 },
        );
      }
    }

    const { data, error } = await client
      .from('pengakhiran_keanggotaan')
      .update(updatePayload)
      .eq('id', id)
      .select(PENGAKHIRAN_WITH_ANGGOTA_SELECT)
      .single();

    if (error) {
      console.error('Error updating pengakhiran_keanggotaan:', error);

      // Rollback konsistensi bila status anggota sudah berubah namun update gagal.
      if (targetStatus === 'disetujui_pp') {
        await client
          .from('anggota')
          .update({ status_keanggotaan: 'aktif', updated_at: new Date().toISOString() })
          .eq('id', existing.anggota_id)
          .eq('status_keanggotaan', 'berhenti');
      }

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
    console.error('Error in PATCH /api/pengakhiran-keanggotaan/[id]:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
