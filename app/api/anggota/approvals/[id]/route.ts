import { NextRequest, NextResponse } from 'next/server';
import { buildAnggotaPartialUpdatePayload } from '@/lib/anggota-perubahan';
import { PERMISSIONS } from '@/lib/rbac';
import {
  notAuthenticatedResponse,
  requirePermission,
  unauthorizedResponse,
} from '@/lib/rbac-server';
import { applyPenggantianRekening } from '@/lib/server/anggota-rekening-service';
import {
  buildAnggotaCreatePayload,
  hasActiveDakemTransactions,
  isAdminActor,
  isNikExists,
  recordMutasiIfCabangChanged,
} from '@/lib/server/anggota-service';
import { supabase } from '@/lib/supabase';
import { getActorClient } from '@/lib/supabase-actor';
import { writeAudit } from '@/lib/server/audit-service';

/**
 * POST /api/anggota/approvals/[id] — keputusan usulan perubahan anggota.
 * Hanya admin. body: { keputusan: 'setujui' | 'tolak', alasan?: string }
 *
 * - 'tolak'   : data utama TIDAK berubah.
 * - 'setujui' : edit → terapkan data_usulan; hapus → soft delete.
 * - Double-decision dihindari lewat optimistic lock (status harus 'menunggu').
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);
    if (!isAdminActor(user)) {
      return unauthorizedResponse(
        'Hanya admin yang dapat memutuskan usulan perubahan anggota',
      );
    }
    // Client dengan header aktor + pencatatan aksi APPROVE/REJECT.
    const supabase = await getActorClient({ request });

    const { id } = await context.params;
    const body = await request.json();
    const keputusan =
      body?.keputusan === 'tolak'
        ? 'tolak'
        : body?.keputusan === 'setujui'
          ? 'setujui'
          : null;
    if (!keputusan) {
      return NextResponse.json(
        { error: 'keputusan wajib diisi (setujui|tolak).' },
        { status: 400 },
      );
    }
    if (keputusan === 'tolak' && !(body?.alasan || '').trim()) {
      return NextResponse.json(
        { error: 'Alasan wajib diisi saat menolak usulan.' },
        { status: 400 },
      );
    }

    const { data: proposal, error: proposalError } = await supabase
      .from('anggota_perubahan')
      .select('*')
      .eq('id', id)
      .single();

    if (proposalError || !proposal) {
      return NextResponse.json(
        { error: 'Usulan tidak ditemukan' },
        { status: 404 },
      );
    }
    if (proposal.status !== 'menunggu') {
      return NextResponse.json(
        { error: `Usulan sudah diputuskan (status: ${proposal.status}).` },
        { status: 409 },
      );
    }

    const nowIso = new Date().toISOString();

    if (keputusan === 'tolak') {
      // Data utama TIDAK berubah — hanya status usulan + alasan keputusan.
      const { data: updated, error } = await supabase
        .from('anggota_perubahan')
        .update({
          status: 'ditolak',
          diputuskan_oleh: user.id,
          diputuskan_pada: nowIso,
          alasan_keputusan: body.alasan,
        })
        .eq('id', id)
        .eq('status', 'menunggu')
        .select()
        .single();

      if (error) {
        console.error('Error rejecting approval:', error);
        return NextResponse.json(
          { error: 'Gagal memutuskan usulan', details: error.message },
          { status: 500 },
        );
      }

      // Audit aksi keputusan (supplementary — baris data juga diaudit trigger).
      await writeAudit({
        module: 'keanggotaan',
        tableName: 'anggota_perubahan',
        entityId: id,
        anggotaId: proposal.anggota_id ?? null,
        action: 'REJECT',
        actorUserId: user.id,
        reason: body.alasan ?? null,
      });

      return NextResponse.json({
        data: updated,
        message: 'Usulan ditolak — data utama tidak berubah.',
      });
    }

    // ── SETUJUI ──
    // 1) Tandai usulan disetujui (optimistic lock).
    const { data: approvedProposal, error: approveError } = await supabase
      .from('anggota_perubahan')
      .update({
        status: 'disetujui',
        diputuskan_oleh: user.id,
        diputuskan_pada: nowIso,
        alasan_keputusan: body?.alasan || null,
      })
      .eq('id', id)
      .eq('status', 'menunggu')
      .select()
      .single();

    if (approveError) {
      console.error('Error approving proposal:', approveError);
      return NextResponse.json(
        { error: 'Gagal menyetujui usulan', details: approveError.message },
        { status: 500 },
      );
    }

    // Audit aksi persetujuan (supplementary — apply data juga diaudit trigger).
    await writeAudit({
      module: 'keanggotaan',
      tableName: 'anggota_perubahan',
      entityId: id,
      anggotaId: proposal.anggota_id ?? null,
      action: 'APPROVE',
      actorUserId: user.id,
      reason: body?.alasan || null,
      newValues: { jenis: proposal.jenis, diajukan_oleh: proposal.diajukan_oleh },
    });

    const anggotaId = proposal.anggota_id;

    // Helper: kembalikan status usulan ke 'menunggu' bila apply gagal,
    // agar dapat diputuskan ulang tanpa duplikasi.
    const revertToPending = async () => {
      await supabase
        .from('anggota_perubahan')
        .update({
          status: 'menunggu',
          diputuskan_oleh: null,
          diputuskan_pada: null,
          alasan_keputusan: null,
        })
        .eq('id', id);
    };

    // Usulan edit/hapus wajib terhubung ke anggota yang ada.
    if (proposal.jenis !== 'create' && !anggotaId) {
      await revertToPending();
      return NextResponse.json(
        { error: 'Usulan tidak terhubung ke anggota yang valid.' },
        { status: 400 },
      );
    }

    // ── CREATE: usulan anggota baru ──
    if (proposal.jenis === 'create') {
      const payload = proposal.data_usulan || {};
      if (!payload.nik || !payload.nama_anggota || !payload.nama_cabang) {
        await revertToPending();
        return NextResponse.json(
          {
            error:
              'Usulan anggota tidak lengkap (nik/nama_anggota/nama_cabang wajib).',
          },
          { status: 400 },
        );
      }

      if (await isNikExists(payload.nik)) {
        await revertToPending();
        return NextResponse.json(
          { error: 'NIK sudah terdaftar — usulan tidak dapat disetujui.' },
          { status: 409 },
        );
      }

      const { data: createdAnggota, error } = await supabase
        .from('anggota')
        .insert([buildAnggotaCreatePayload(payload)])
        .select()
        .single();

      if (error) {
        console.error('Error applying approved create:', error);
        await revertToPending();
        return NextResponse.json(
          {
            error: 'Usulan disetujui tetapi gagal dibuat',
            details: error.message,
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          data: createdAnggota,
          message: 'Usulan penambahan anggota disetujui dan dibuat.',
        },
        { status: 201 },
      );
    }

    // ── EDIT ──
    if (proposal.jenis === 'edit') {
      const payload = proposal.data_usulan || {};

      // Re-cek NIK saat apply (data mungkin berubah sejak usulan diajukan).
      if (payload.nik && payload.nik !== proposal.data_sebelum?.nik) {
        if (await isNikExists(payload.nik, anggotaId)) {
          await revertToPending();
          return NextResponse.json(
            { error: 'NIK sudah terdaftar pada anggota lain.' },
            { status: 409 },
          );
        }
      }

      // Partial-safe: usulan Perubahan Data Pribadi hanya berisi field yang
      // berubah — builder ini tidak men-null-kan kolom yang tidak disertakan.
      // Untuk usulan Edit lama (payload lengkap) hasilnya ekuivalen.
      const updatePayload = buildAnggotaPartialUpdatePayload(payload);
      const { data: updatedAnggota, error } = await supabase
        .from('anggota')
        .update(updatePayload)
        .eq('id', anggotaId)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) {
        console.error('Error applying approved edit:', error);
        await revertToPending();
        return NextResponse.json(
          {
            error: 'Usulan disetujui tetapi gagal diterapkan',
            details: error.message,
          },
          { status: 500 },
        );
      }

      await recordMutasiIfCabangChanged({
        before: proposal.data_sebelum || {},
        after: updatedAnggota,
        diajukanOleh: proposal.diajukan_oleh,
        disetujuiOleh: user.id,
        alasan: proposal.alasan,
      }, supabase);

      return NextResponse.json({
        data: updatedAnggota,
        message: 'Usulan edit disetujui dan diterapkan.',
      });
    }

    // ── REKENING ── usulan penggantian rekening anggota.
    if (proposal.jenis === 'rekening') {
      const payload = proposal.data_usulan || {};

      // Rekening aktif saat ini (bisa berubah sejak usulan diajukan).
      const { data: currentAnggota, error: currentError } = await supabase
        .from('anggota')
        .select('id, nama_bank, norek_bank, nama_pemilik_rekening, deleted_at')
        .eq('id', anggotaId)
        .is('deleted_at', null)
        .single();

      if (currentError || !currentAnggota) {
        await revertToPending();
        return NextResponse.json(
          { error: 'Anggota tidak ditemukan — usulan tidak dapat diterapkan.' },
          { status: 404 },
        );
      }

      const applied = await applyPenggantianRekening({
        anggotaId,
        before: currentAnggota,
        usulan: { ...payload, alasan: payload.alasan ?? proposal.alasan },
        diajukanOleh: proposal.diajukan_oleh,
        disetujuiOleh: user.id,
        diputuskanPada: nowIso,
      }, supabase);

      if (applied.error) {
        console.error('Error applying approved rekening change:', applied.error);
        await revertToPending();
        return NextResponse.json(
          {
            error: 'Usulan disetujui tetapi gagal diterapkan',
            details: applied.error,
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        data: applied.data,
        message: 'Usulan penggantian rekening disetujui dan diterapkan.',
      });
    }

    // jenis 'hapus'
    const hasActiveTransactions = await hasActiveDakemTransactions(anggotaId);
    if (hasActiveTransactions) {
      return NextResponse.json(
        {
          error:
            'Anggota masih memiliki pengajuan Dana Kematian aktif dan tidak dapat dihapus. ' +
            'Selesaikan atau batalkan pengajuan terkait terlebih dahulu.',
        },
        { status: 409 },
      );
    }

    const { error: deleteError } = await supabase
      .from('anggota')
      .update({ deleted_at: nowIso })
      .eq('id', anggotaId)
      .is('deleted_at', null);

    if (deleteError) {
      console.error('Error applying approved delete:', deleteError);
      return NextResponse.json(
        {
          error: 'Usulan disetujui tetapi gagal menghapus',
          details: deleteError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: 'Usulan hapus disetujui dan anggota dinonaktifkan.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN')
      return unauthorizedResponse(
        'Anda tidak memiliki akses ke approval keanggotaan',
      );
    console.error('Error in POST /api/anggota/approvals/[id]:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 },
    );
  }
}
