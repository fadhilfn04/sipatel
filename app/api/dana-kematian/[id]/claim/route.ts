import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { supabaseAdmin } from '@/lib/supabase-storage';
import { getActorClient } from '@/lib/supabase-actor';
import { getDakemActorContext, getActorCabang } from '@/lib/server/dakem-enforcement';
import { canClaimClaim, canReleaseClaim } from '@/lib/server/dakem-claim-rules';

async function getClient(request?: NextRequest) {
  // Client dengan header aktor — audit_log mencatat pelaku (migration 036).
  return getActorClient({ request });
}

/**
 * POST /api/dana-kematian/[id]/claim — cabang mengambil pengajuan tersedia.
 *
 * Race-safe: claim dilakukan lewat satu UPDATE atomik dengan syarat
 * `claim_status = 'tersedia'`; bila dua cabang claim bersamaan, hanya
 * satu yang berhasil (yang lain menerima 409).
 *
 * Body (opsional, khusus Pusat/admin):
 *   { "reassign": "KODE_CABANG", "catatan": "..." } — pengalihan kepemilikan.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const actor = await getDakemActorContext();
    if (!actor.userId) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (!actor.canManagePC) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses untuk mengklaim pengajuan', code: 'PERMISSION_DENIED' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const reassignKode = typeof body?.reassign === 'string' && body.reassign.trim() ? body.reassign.trim() : null;
    if (reassignKode && !actor.canVerifyPP) {
      return NextResponse.json(
        { error: 'Pengalihan kepemilikan pengajuan hanya dapat dilakukan oleh Pusat.', code: 'PERMISSION_DENIED' },
        { status: 403 },
      );
    }

    // Ambil kondisi pengajuan saat ini (untuk validasi aturan + audit).
    const { data: claim, error: fetchError } = await (await getClient(request))
      .from('dana_kematian')
      .select('id, status_proses, claim_status, cabang_pemilik_kode, diklaim_oleh, kode_cabang, nama_anggota, data_perubahan')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchError || !claim) {
      return NextResponse.json({ error: 'Dana kematian tidak ditemukan' }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    const actorNama = session?.user?.name || 'Sistem';

    let targetKodeCabang: string | null;
    let targetUserId: string;

    if (reassignKode) {
      // Pengalihan kepemilikan oleh Pusat/admin.
      targetKodeCabang = reassignKode;
      targetUserId = actor.userId;
    } else {
      const actorCabang = await getActorCabang(actor.userId);
      const kodeCabang = actorCabang.kode_cabang || actorCabang.nama_cabang;
      const gate = canClaimClaim(claim, { isPusat: false, userId: actor.userId, kodeCabang });
      if (!gate.allowed) {
        const code = claim.claim_status === 'diklaim' ? 'CLAIMED_BY_OTHER' : 'CLAIM_NOT_ALLOWED';
        return NextResponse.json({ error: gate.reason, code }, { status: claim.claim_status === 'diklaim' ? 409 : 400 });
      }
      targetKodeCabang = kodeCabang;
      targetUserId = actor.userId;
    }

    const nowIso = new Date().toISOString();

    // ── UPDATE atomik (anti race dua cabang claim bersamaan) ──
    // Kondisi WHERE memastikan baris masih 'tersedia' saat update dijalankan.
    const { data: updated, error: updateError } = await (await getClient(request))
      .from('dana_kematian')
      .update({
        claim_status: 'diklaim',
        cabang_pemilik_kode: targetKodeCabang,
        diklaim_oleh: targetUserId,
        diklaim_pada: nowIso,
        data_perubahan: {
          ...((claim as any).data_perubahan || {}),
          actor_id: actor.userId,
          actor_role: actor.canVerifyPP ? 'pusat' : 'cabang',
          actor_nama: actorNama,
          actor_cabang: targetKodeCabang,
          catatan: reassignKode
            ? `Pengalihan kepemilikan pengajuan ke cabang ${targetKodeCabang}`
            : `Pengajuan diklaim oleh cabang ${targetKodeCabang}`,
          changed_fields: ['claim_status', 'cabang_pemilik_kode', 'diklaim_oleh', 'diklaim_pada'],
        },
      })
      .eq('id', id)
      .eq('claim_status', 'tersedia')
      .is('deleted_at', null)
      .select();

    if (updateError) {
      console.error('Error claiming dana kematian:', updateError);
      return NextResponse.json({ error: 'Gagal mengklaim pengajuan', details: updateError.message }, { status: 500 });
    }

    if (!updated || updated.length === 0) {
      // Baris sudah diklaim pihak lain di antara pembacaan dan update ini.
      return NextResponse.json(
        { error: 'Pengajuan baru saja diklaim cabang lain.', code: 'CLAIMED_BY_OTHER' },
        { status: 409 },
      );
    }

    // Audit trail eksplisit (claim bukan transisi status → trigger DB tidak mencatat).
    const { error: logError } = await (await getClient(request))
      .from('riwayat_proses_dakem')
      .insert({
        dana_kematian_id: id,
        status_dari: claim.status_proses,
        status_ke: claim.status_proses,
        actor_id: actor.userId,
        actor_role: actor.canVerifyPP ? 'pusat' : 'cabang',
        actor_nama: actorNama,
        actor_cabang: targetKodeCabang,
        catatan: reassignKode
          ? `Pengalihan kepemilikan pengajuan ke cabang ${targetKodeCabang}${body?.catatan ? ` — ${body.catatan}` : ''}`
          : `Pengajuan diklaim oleh cabang ${targetKodeCabang}`,
        data_perubahan: {
          aksi: reassignKode ? 'reassign_claim' : 'claim_pengajuan',
          sebelum: { claim_status: claim.claim_status, cabang_pemilik_kode: claim.cabang_pemilik_kode, diklaim_oleh: claim.diklaim_oleh },
          sesudah: { claim_status: 'diklaim', cabang_pemilik_kode: targetKodeCabang, diklaim_oleh: targetUserId },
        },
      });
    if (logError) {
      console.error('Error logging claim audit:', logError);
    }

    return NextResponse.json({
      data: updated[0],
      message: reassignKode
        ? `Kepemilikan pengajuan dialihkan ke cabang ${targetKodeCabang}`
        : 'Pengajuan berhasil diklaim oleh cabang Anda',
    });
  } catch (error) {
    console.error('Error in POST /api/dana-kematian/[id]/claim:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}

/**
 * DELETE /api/dana-kematian/[id]/claim — lepas pengajuan kembali ke tersedia.
 * Hanya cabang pemilik atau Pusat/admin.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const actor = await getDakemActorContext();
    if (!actor.userId) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (!actor.canManagePC) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses untuk melepas pengajuan', code: 'PERMISSION_DENIED' }, { status: 403 });
    }

    const { data: claim, error: fetchError } = await (await getClient(request))
      .from('dana_kematian')
      .select('id, status_proses, claim_status, cabang_pemilik_kode, diklaim_oleh, kode_cabang')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchError || !claim) {
      return NextResponse.json({ error: 'Dana kematian tidak ditemukan' }, { status: 404 });
    }

    const isPusat = actor.canVerifyPP;
    const actorCabang = await getActorCabang(actor.userId);
    const gate = canReleaseClaim(claim, {
      isPusat,
      userId: actor.userId,
      kodeCabang: actorCabang.kode_cabang || actorCabang.nama_cabang,
    });
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.reason, code: 'PERMISSION_DENIED' }, { status: 403 });
    }

    // Pengajuan yang sudah submit ke pusat tidak boleh dilepaskan —
    // hanya tahap sebelum submit yang boleh berpindah tangan.
    if (!['draft', 'dilaporkan', 'verifikasi_cabang'].includes(String(claim.status_proses))) {
      return NextResponse.json(
        { error: `Pengajuan berstatus '${claim.status_proses}' tidak dapat dilepas.` },
        { status: 400 },
      );
    }

    const session = await getServerSession(authOptions);
    const actorNama = session?.user?.name || 'Sistem';

    const { data: updated, error: updateError } = await (await getClient(request))
      .from('dana_kematian')
      .update({
        claim_status: 'tersedia',
        cabang_pemilik_kode: null,
        diklaim_oleh: null,
        diklaim_pada: null,
        data_perubahan: {
          actor_id: actor.userId,
          actor_role: isPusat ? 'pusat' : 'cabang',
          actor_nama: actorNama,
          actor_cabang: claim.cabang_pemilik_kode || null,
          catatan: `Pengajuan dilepas kembali ke status tersedia oleh ${isPusat ? 'Pusat' : 'cabang pemilik'}`,
          changed_fields: ['claim_status', 'cabang_pemilik_kode', 'diklaim_oleh', 'diklaim_pada'],
        },
      })
      .eq('id', id)
      .eq('claim_status', 'diklaim')
      .is('deleted_at', null)
      .select();

    if (updateError) {
      console.error('Error releasing claim:', updateError);
      return NextResponse.json({ error: 'Gagal melepas pengajuan', details: updateError.message }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'Pengajuan tidak sedang diklaim.', code: 'NOT_CLAIMED' }, { status: 409 });
    }

    const { error: logError } = await (await getClient(request))
      .from('riwayat_proses_dakem')
      .insert({
        dana_kematian_id: id,
        status_dari: claim.status_proses,
        status_ke: claim.status_proses,
        actor_id: actor.userId,
        actor_role: isPusat ? 'pusat' : 'cabang',
        actor_nama: actorNama,
        actor_cabang: claim.cabang_pemilik_kode || null,
        catatan: 'Pengajuan dilepas kembali ke status tersedia',
        data_perubahan: {
          aksi: 'release_claim',
          sebelum: { claim_status: 'diklaim', cabang_pemilik_kode: claim.cabang_pemilik_kode, diklaim_oleh: claim.diklaim_oleh },
          sesudah: { claim_status: 'tersedia', cabang_pemilik_kode: null, diklaim_oleh: null },
        },
      });
    if (logError) {
      console.error('Error logging release audit:', logError);
    }

    return NextResponse.json({
      data: updated[0],
      message: 'Pengajuan dilepas kembali ke status tersedia',
    });
  } catch (error) {
    console.error('Error in DELETE /api/dana-kematian/[id]/claim:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
