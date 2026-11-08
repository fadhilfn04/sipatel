import { NextRequest, NextResponse } from 'next/server';
import {
  buildAnggotaPartialUpdatePayload,
  computeFieldDiff,
  safeParsePerubahanDataPribadi,
} from '@/lib/anggota-perubahan';
import { PERMISSIONS } from '@/lib/rbac';
import {
  notAuthenticatedResponse,
  requirePermission,
  unauthorizedResponse,
} from '@/lib/rbac-server';
import { isAdminActor } from '@/lib/server/anggota-service';
import { supabase } from '@/lib/supabase';
import { getActorClient } from '@/lib/supabase-actor';

/**
 * POST /api/anggota/[id]/perubahan-data
 *
 * Menu Keanggotaan → Perubahan Data Pribadi.
 *
 * body: {
 *   perubahan: { ...field data pribadi yang berubah (allowlist) ... },
 *   alasan: string (wajib, minimal 10 karakter)
 * }
 *
 * - Non-admin (cabang/pengurus) → buat usulan `anggota_perubahan`
 *   (jenis 'edit', status 'menunggu'); data utama TIDAK berubah sampai admin menyetujui.
 * - Admin → data langsung berubah + jejak audit `anggota_perubahan`
 *   (status 'disetujui', self-approved) agar riwayat "siapa/kenapa/kapan" tetap utuh.
 *
 * Field milik modul lain (NIK, nama, kategori/status, cabang, mutasi, status
 * keanggotaan/kematian) ditolak di level schema (strict) — lihat
 * `lib/anggota-perubahan.ts` (PERSONAL_DATA_EDITABLE_FIELDS / PROTECTED_FIELDS).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);
    // Client dengan header aktor — audit_log mencatat pelaku (migration 036).
    const supabase = await getActorClient({ request });
    const { id } = await context.params;

    const body = await request.json();
    const parsed = safeParsePerubahanDataPribadi(body);

    if (!parsed.ok) {
      return NextResponse.json(
        { error: 'Validasi gagal', errors: parsed.errors },
        { status: 422 },
      );
    }

    const changes = parsed.changes!;
    const alasan = parsed.alasan!;

    // Ambil data anggota existing.
    const { data: existing, error: fetchError } = await supabase
      .from('anggota')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Anggota tidak ditemukan' },
        { status: 404 },
      );
    }

    // Diff — hanya field yang benar-benar berubah yang diproses.
    const perubahan = computeFieldDiff(existing, changes, Object.keys(changes));
    if (perubahan.length === 0) {
      return NextResponse.json(
        {
          error:
            'Tidak ada perubahan data yang terdeteksi. Tidak ada data yang disimpan.',
        },
        { status: 400 },
      );
    }

    // Snapshot data lama hanya untuk field yang berubah.
    const dataSebelum: Record<string, unknown> = {};
    for (const item of perubahan) {
      dataSebelum[item.field] = (existing as Record<string, unknown>)[
        item.field
      ];
    }

    // ── Non-admin → usulan approval ──────────────────────────────
    if (!isAdminActor(user)) {
      const { error: proposalError } = await supabase
        .from('anggota_perubahan')
        .insert({
          anggota_id: id,
          jenis: 'edit',
          status: 'menunggu',
          data_sebelum: dataSebelum,
          data_usulan: changes,
          alasan,
          diajukan_oleh: user.id,
        });

      if (proposalError) {
        console.error(
          'Error creating perubahan-data-pribadi approval:',
          proposalError,
        );
        return NextResponse.json(
          {
            error: 'Gagal membuat usulan perubahan data pribadi',
            details: proposalError.message,
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          status: 'menunggu',
          message: 'Usulan perubahan data pribadi menunggu persetujuan admin.',
          perubahan,
        },
        { status: 202 },
      );
    }

    // ── Admin → terapkan langsung ────────────────────────────────
    const payload = buildAnggotaPartialUpdatePayload(changes);
    const { data: updated, error: updateError } = await supabase
      .from('anggota')
      .update(payload)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (updateError) {
      console.error(
        'Error updating anggota (perubahan data pribadi):',
        updateError,
      );
      return NextResponse.json(
        {
          error: 'Gagal menyimpan perubahan data pribadi',
          details: updateError.message,
        },
        { status: 500 },
      );
    }

    // Jejak audit (best-effort): pastikan riwayat siapa/kenapa/kapan tercatat
    // untuk edit langsung admin — pola serupa `recordMutasiIfCabangChanged`.
    const nowIso = new Date().toISOString();
    const { error: logError } = await supabase
      .from('anggota_perubahan')
      .insert({
        anggota_id: id,
        jenis: 'edit',
        status: 'disetujui',
        data_sebelum: dataSebelum,
        data_usulan: changes,
        alasan,
        diajukan_oleh: user.id,
        diputuskan_oleh: user.id,
        diputuskan_pada: nowIso,
        alasan_keputusan:
          'Perubahan data pribadi disimpan langsung oleh admin.',
      });

    if (logError) {
      console.error(
        'Gagal mencatat jejak audit perubahan data pribadi:',
        logError.message,
      );
    }

    return NextResponse.json({
      data: updated,
      status: 'tersimpan',
      message: 'Perubahan data pribadi berhasil disimpan.',
      perubahan,
    });
  } catch (error: any) {
    console.error('Error in POST /api/anggota/[id]/perubahan-data:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse(
        'Anda tidak memiliki akses untuk mengubah data pribadi anggota',
      );
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server', details: error.message },
      { status: 500 },
    );
  }
}
