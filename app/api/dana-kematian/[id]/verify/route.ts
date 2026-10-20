import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { supabaseAdmin } from '@/lib/supabase-storage';
import { getDakemActorContext } from '@/lib/server/dakem-enforcement';
import { isValidStatusTransition } from '@/lib/workflow/dana-kematian-transitions';
import {
  notifyDanaKematianVerified,
  notifyDanaKematianDitolak,
  notifyDanaKematianUpdated,
} from '@/lib/server/create-notification';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  return supabaseAdmin;
}

type VerifyAction = 'verify' | 'return' | 'reject';

/**
 * POST /api/dana-kematian/[id]/verify — aksi verifikasi Pusat.
 *
 * body:
 *  { action: 'verify' | 'return' | 'reject',
 *    alasan: string (wajib untuk 'return' dan 'reject'),
 *    catatan?: string,
 *    benefitAmount?: number,
 *    documentVerifications?: Record<string, {verified:boolean}> }
 *
 * - Hanya user dengan kapabilitas Pusat (verify_pp) / superuser.
 * - Pengembalian & penolakan wajib menyertakan alasan.
 * - Optimistic lock: update hanya dijalankan bila status masih 'proses_pusat'.
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
    if (!actor.canVerifyPP) {
      return NextResponse.json(
        { error: 'Hanya Pusat yang dapat melakukan verifikasi pengajuan Dana Kematian.', code: 'PERMISSION_DENIED' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const action: VerifyAction = body?.action === 'return' ? 'return' : body?.action === 'reject' ? 'reject' : 'verify';
    const alasan: string = (body?.alasan || body?.rejectionReason || '').trim();

    if ((action === 'return' || action === 'reject') && !alasan) {
      return NextResponse.json(
        { error: 'Alasan wajib diisi untuk pengembalian atau penolakan pengajuan.' },
        { status: 400 },
      );
    }

    // Ambil kondisi terkini.
    const { data: claim, error: fetchError } = await getClient()
      .from('dana_kematian')
      .select('id, nama_anggota, status_proses, besaran_dana_kematian, document_metadata')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchError || !claim) {
      return NextResponse.json({ error: 'Dana kematian tidak ditemukan' }, { status: 404 });
    }

    if (claim.status_proses !== 'proses_pusat') {
      return NextResponse.json(
        { error: `Pengajuan berstatus '${claim.status_proses}' — verifikasi hanya untuk status Verifikasi Pusat.` },
        { status: 400 },
      );
    }

    const session = await getServerSession(authOptions);
    const actorNama = session?.user?.name || 'Sistem';
    const nowIso = new Date().toISOString();

    let targetStatus: string;
    let aksi: string;
    let catatan: string;

    const updateData: Record<string, unknown> = {};

    if (action === 'verify') {
      targetStatus = 'verified';
      aksi = 'pp_verified';
      catatan = body?.catatan || 'Pengajuan diverifikasi dan disetujui oleh Pusat.';
      updateData.status_proses = 'verified';
      updateData.is_validated_pp = true;
      updateData.is_approved = true;
      updateData.waktu_3 = nowIso; // Waktu-3: PP validation completion
      updateData.pusat_tanggal_validasi = nowIso.slice(0, 10);
      if (body?.benefitAmount) updateData.besaran_dana_kematian = body.benefitAmount;
      if (body?.catatan) updateData.pusat_catatan_verifikasi = body.catatan;
      // Flag verifikasi dokumen (dokumen_*_verified).
      if (body?.documentVerifications && typeof body.documentVerifications === 'object') {
        for (const [docKey, v] of Object.entries(body.documentVerifications as Record<string, any>)) {
          if (v && typeof v.verified === 'boolean') {
            const verifiedField = `${String(docKey).replace('file_', 'dokumen_')}_verified`;
            updateData[verifiedField] = v.verified;
          }
        }
      }
    } else if (action === 'return') {
      targetStatus = 'pending_dokumen';
      aksi = 'pp_returned_to_pc';
      catatan = alasan;
      updateData.status_proses = 'pending_dokumen';
      updateData.pusat_catatan_verifikasi = alasan;
      updateData.can_resubmit = true;
      updateData.resubmission_deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      updateData.document_metadata = {
        ...((claim as any).document_metadata || {}),
        rejection_note: alasan,
      };
    } else {
      targetStatus = 'ditolak';
      aksi = 'pp_rejected';
      catatan = alasan;
      updateData.status_proses = 'ditolak';
      updateData.rejection_reason = alasan;
      updateData.rejection_category = body?.rejectionCategory || 'other';
      updateData.can_resubmit = body?.canResubmit === true; // default false
      updateData.waktu_3 = nowIso;
    }

    // Validasi transisi workflow (harus diperbolehkan).
    const transition = isValidStatusTransition(claim.status_proses, targetStatus);
    if (!transition.valid) {
      return NextResponse.json({ error: transition.message }, { status: 400 });
    }

    updateData.data_perubahan = {
      actor_id: actor.userId,
      actor_role: 'pusat',
      actor_nama: actorNama,
      actor_cabang: null,
      catatan,
      changed_fields: ['status_proses', ...Object.keys(updateData).filter(k => !['status_proses', 'data_perubahan'].includes(k))],
    };

    // Optimistic lock: hanya update bila status masih 'proses_pusat'.
    const { data: updated, error: updateError } = await getClient()
      .from('dana_kematian')
      .update(updateData)
      .eq('id', id)
      .eq('status_proses', 'proses_pusat')
      .is('deleted_at', null)
      .select();

    if (updateError) {
      console.error('Error verifying claim:', updateError);
      return NextResponse.json({ error: 'Gagal memproses verifikasi', details: updateError.message }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: 'Pengajuan sudah diproses pihak lain. Muat ulang data.', code: 'ALREADY_PROCESSED' },
        { status: 409 },
      );
    }

    // Audit trail eksplisit dengan kolom yang BENAR (riwayat_proses_dakem).
    const { error: logError } = await getClient()
      .from('riwayat_proses_dakem')
      .insert({
        dana_kematian_id: id,
        status_dari: claim.status_proses,
        status_ke: targetStatus,
        actor_id: actor.userId,
        actor_role: 'pusat',
        actor_nama: actorNama,
        actor_cabang: null,
        catatan,
        data_perubahan: {
          aksi,
          sebelum: { status_proses: claim.status_proses },
          sesudah: { status_proses: targetStatus },
        },
      });

    if (logError) {
      console.error('Error logging verification audit:', logError);
    }

    // Notifikasi (non-blocking).
    if (action === 'verify') {
      notifyDanaKematianVerified(id, claim.nama_anggota, actorNama);
    } else if (action === 'reject') {
      notifyDanaKematianDitolak(id, claim.nama_anggota, alasan);
    } else {
      notifyDanaKematianUpdated(id, claim.nama_anggota, actorNama);
    }

    return NextResponse.json({
      success: true,
      data: updated[0],
      message:
        action === 'verify'
          ? 'Pengajuan berhasil diverifikasi dan disetujui'
          : action === 'return'
          ? 'Pengajuan dikembalikan ke cabang untuk koreksi'
          : 'Pengajuan ditolak',
    });
  } catch (error) {
    console.error('Error in POST /api/dana-kematian/[id]/verify:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}

/**
 * GET /api/dana-kematian/[id]/verify — detail klaim + riwayat untuk panel PP.
 * Hanya user dengan akses Dana Kematian.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getDakemActorContext();
    if (!actor.userId) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (!actor.canManagePC && !actor.canVerifyPP) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses ke modul Dana Kematian', code: 'PERMISSION_DENIED' }, { status: 403 });
    }

    const { id } = await params;
    const { data: claim, error } = await getClient()
      .from('dana_kematian')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error || !claim) {
      return NextResponse.json({ error: 'Claim tidak ditemukan' }, { status: 404 });
    }

    const { data: history } = await getClient()
      .from('riwayat_proses_dakem')
      .select('*')
      .eq('dana_kematian_id', id)
      .order('timestamp', { ascending: false })
      .limit(20);

    return NextResponse.json({ claim, history: history || [] });
  } catch (error) {
    console.error('Error in GET /api/dana-kematian/[id]/verify:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
