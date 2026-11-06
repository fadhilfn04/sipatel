import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';
import {
  requireAnyPermission,
  notAuthenticatedResponse,
  unauthorizedResponse,
} from '@/lib/rbac-server';
import {
  KEPENGURUSAN_MANAGE_PERMISSIONS,
  KEPENGURUSAN_VIEW_PERMISSIONS,
} from '@/lib/rbac';
import {
  getKepengurusanStatusConfig,
  isValidKepengurusanTransition,
} from '@/lib/workflow/kepengurusan-status';
import {
  KEPENGURUSAN_WITH_ANGGOTA_SELECT,
  applyKepengurusanApproval,
} from '@/lib/server/kepengurusan-service';

function getClient() {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  }
  return supabaseAdmin;
}

function actorName(user: { name?: string | null; email?: string | null; id: string }): string {
  return user.name || user.email || user.id;
}

/**
 * GET /api/anggota-kepengurusan/[id]
 *
 * Detail pengajuan perubahan kepengurusan — pengurus/admin.
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
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('Error fetching anggota_kepengurusan:', error);
      return NextResponse.json(
        { error: 'Gagal mengambil detail perubahan kepengurusan', details: error.message },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json({ error: 'Perubahan kepengurusan tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses ke perubahan kepengurusan');
    }
    console.error('Error in GET /api/anggota-kepengurusan/[id]:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}

/**
 * PATCH /api/anggota-kepengurusan/[id]
 *
 * Verifikasi PC / keputusan PP / pembatalan.
 * body: { status: 'diverifikasi_pc'|'disetujui_pp'|'ditolak'|'dibatalkan', catatan? }
 *
 * Saat transisi ke 'disetujui_pp': tutup jabatan lama + sinkron posisi anggota
 * (via applyKepengurusanApproval — dengan rollback bila gagal).
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAnyPermission([...KEPENGURUSAN_MANAGE_PERMISSIONS]);

    const { id } = await context.params;
    const body = await request.json();
    const targetStatus = body?.status;
    const catatan = body?.catatan ? String(body.catatan).trim() : null;

    const statusConfig = getKepengurusanStatusConfig(targetStatus);
    if (statusConfig.value === 'unknown') {
      return NextResponse.json(
        { error: 'Status tujuan tidak valid', code: 'INVALID_STATUS' },
        { status: 400 },
      );
    }

    const client = getClient();

    const { data: existing, error: existingError } = await client
      .from('anggota_kepengurusan')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingError) {
      console.error('Error fetching anggota_kepengurusan:', existingError);
      return NextResponse.json(
        { error: 'Gagal memuat perubahan kepengurusan', details: existingError.message },
        { status: 500 },
      );
    }
    if (!existing) {
      return NextResponse.json({ error: 'Perubahan kepengurusan tidak ditemukan' }, { status: 404 });
    }

    if (!isValidKepengurusanTransition(existing.status, targetStatus)) {
      return NextResponse.json(
        {
          error: `Transisi status dari "${existing.status}" ke "${targetStatus}" tidak diizinkan.`,
          code: 'INVALID_TRANSITION',
        },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();

    // ── Persetujuan: tutup jabatan lama + sync posisi ──
    if (targetStatus === 'disetujui_pp') {
      const applied = await applyKepengurusanApproval({
        id,
        anggotaId: existing.anggota_id,
        jabatan: existing.jabatan,
        tanggalMulai: existing.tanggal_mulai,
        decidedBy: actorName(user),
        catatanKeputusan: catatan,
      });

      if (!applied.ok) {
        return NextResponse.json(
          {
            error: 'Gagal menerapkan persetujuan kepengurusan. Silakan coba lagi.',
            details: applied.error,
            code: applied.code || 'APPLY_FAILED',
          },
          { status: 502 },
        );
      }

      const { data: updated } = await client
        .from('anggota_kepengurusan')
        .select(KEPENGURUSAN_WITH_ANGGOTA_SELECT)
        .eq('id', id)
        .maybeSingle();

      return NextResponse.json({
        data: updated,
        message: 'Perubahan kepengurusan disetujui dan diterapkan.',
      });
    }

    // ── Verifikasi / tolak / batalkan: update status langsung ──
    const updatePayload: Record<string, unknown> = {
      status: targetStatus,
      updated_at: now,
    };

    if (targetStatus === 'diverifikasi_pc') {
      updatePayload.diverifikasi_oleh = actorName(user);
      updatePayload.diverifikasi_pada = now;
      updatePayload.catatan_verifikasi = catatan;
    }

    if (targetStatus === 'ditolak') {
      updatePayload.diputuskan_oleh = actorName(user);
      updatePayload.diputuskan_pada = now;
      updatePayload.alasan_keputusan = catatan;
    }

    if (targetStatus === 'dibatalkan') {
      updatePayload.alasan_keputusan = catatan;
    }

    const { data, error } = await client
      .from('anggota_kepengurusan')
      .update(updatePayload)
      .eq('id', id)
      .select(KEPENGURUSAN_WITH_ANGGOTA_SELECT)
      .single();

    if (error) {
      console.error('Error updating anggota_kepengurusan:', error);
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
    console.error('Error in PATCH /api/anggota-kepengurusan/[id]:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
