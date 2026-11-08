import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';
import { getActorClient } from '@/lib/supabase-actor';
import {
  requireAnyPermission,
  notAuthenticatedResponse,
  unauthorizedResponse,
} from '@/lib/rbac-server';
import {
  ENTRY_KEMATIAN_MANAGE_PERMISSIONS,
  ENTRY_KEMATIAN_VIEW_PERMISSIONS,
} from '@/lib/rbac';
import {
  ANGGOTA_KEMATIAN_WITH_ANGGOTA_SELECT,
  markAnggotaMeninggal,
} from '@/lib/server/anggota-kematian-service';
import type { UpdateAnggotaKematianInput } from '@/lib/supabase';

async function getClient(request?: NextRequest) {
  // Client dengan header aktor — audit_log mencatat pelaku (migration 036).
  return getActorClient({ request });
}

function validateTanggalMeninggal(value: unknown): string | null {
  if (!value || typeof value !== 'string' || !value.trim()) {
    return 'Tanggal meninggal wajib diisi';
  }
  const dateOnly = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return 'Format tanggal tidak valid';
  const parsed = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return 'Format tanggal tidak valid';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsed.getTime() > today.getTime()) return 'Tanggal meninggal tidak boleh di masa depan';
  return null;
}

/** GET /api/anggota-kematian/[id] — detail entry kematian. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAnyPermission([...ENTRY_KEMATIAN_VIEW_PERMISSIONS]);

    const { id } = await context.params;
    const client = await getClient(request);

    const { data, error } = await client
      .from('anggota_kematian')
      .select(ANGGOTA_KEMATIAN_WITH_ANGGOTA_SELECT)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('Error fetching anggota_kematian:', error);
      return NextResponse.json(
        { error: 'Gagal mengambil detail entry meninggal dunia', details: error.message },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json({ error: 'Entry meninggal dunia tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses ke data entry meninggal dunia');
    }
    console.error('Error in GET /api/anggota-kematian/[id]:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}

/** PUT /api/anggota-kematian/[id] — ubah tanggal meninggal / dokumen. */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAnyPermission([...ENTRY_KEMATIAN_MANAGE_PERMISSIONS]);

    const { id } = await context.params;
    const body: UpdateAnggotaKematianInput = await request.json();

    if (body.tanggal_meninggal !== undefined) {
      const tanggalError = validateTanggalMeninggal(body.tanggal_meninggal);
      if (tanggalError) {
        return NextResponse.json({ error: tanggalError }, { status: 400 });
      }
    }

    const client = await getClient(request);

    const { data: existing, error: existingError } = await client
      .from('anggota_kematian')
      .select('id, anggota_id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingError) {
      console.error('Error fetching anggota_kematian:', existingError);
      return NextResponse.json(
        { error: 'Gagal memuat entry meninggal dunia', details: existingError.message },
        { status: 500 },
      );
    }
    if (!existing) {
      return NextResponse.json({ error: 'Entry meninggal dunia tidak ditemukan' }, { status: 404 });
    }

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.tanggal_meninggal !== undefined) {
      payload.tanggal_meninggal = String(body.tanggal_meninggal).trim().slice(0, 10);
    }
    if (body.file_surat_kematian !== undefined) {
      payload.file_surat_kematian = body.file_surat_kematian || null;
    }

    const { data, error } = await client
      .from('anggota_kematian')
      .update(payload)
      .eq('id', id)
      .select(ANGGOTA_KEMATIAN_WITH_ANGGOTA_SELECT)
      .single();

    if (error) {
      console.error('Error updating anggota_kematian:', error);
      return NextResponse.json(
        { error: 'Gagal memperbarui entry meninggal dunia', details: error.message },
        { status: 500 },
      );
    }

    // Pastikan status anggota tetap konsisten 'meninggal' (idempotent).
    await markAnggotaMeninggal(existing.anggota_id, client);

    return NextResponse.json({ data, message: 'Entry meninggal dunia berhasil diperbarui.' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk mengubah data meninggal dunia');
    }
    console.error('Error in PUT /api/anggota-kematian/[id]:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}

/**
 * DELETE /api/anggota-kematian/[id] — soft delete (koreksi data).
 *
 * Status anggota TIDAK dikembalikan otomatis; admin dapat memperbaiki status
 * lewat Pengelolaan Data bila memang diperlukan. Data historis dipertahankan.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAnyPermission([...ENTRY_KEMATIAN_MANAGE_PERMISSIONS]);

    const { id } = await context.params;
    const client = await getClient(request);

    const { data: existing, error: existingError } = await client
      .from('anggota_kematian')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingError) {
      console.error('Error fetching anggota_kematian:', existingError);
      return NextResponse.json(
        { error: 'Gagal memuat entry meninggal dunia', details: existingError.message },
        { status: 500 },
      );
    }
    if (!existing) {
      return NextResponse.json({ error: 'Entry meninggal dunia tidak ditemukan' }, { status: 404 });
    }

    const { error } = await client
      .from('anggota_kematian')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting anggota_kematian:', error);
      return NextResponse.json(
        { error: 'Gagal menghapus entry meninggal dunia', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message:
        'Entry meninggal dunia dihapus. Status anggota tidak diubah otomatis — periksa kembali lewat Pengelolaan Data bila perlu.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk menghapus data meninggal dunia');
    }
    console.error('Error in DELETE /api/anggota-kematian/[id]:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
