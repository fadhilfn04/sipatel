import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { supabaseAdmin, deleteFromSupabaseStorage } from '@/lib/supabase-storage';
import { getActorClient } from '@/lib/supabase-actor';
import { getDakemActorContext, getActorCabang, CABANG_EDITABLE_STATUSES } from '@/lib/server/dakem-enforcement';
import { canEditClaim } from '@/lib/server/dakem-claim-rules';
import { BERKAS_DOCUMENTS } from '@/lib/config/dana-kematian-berkas';

async function getClient(request?: NextRequest) {
  // Client dengan header aktor — audit_log mencatat pelaku (migration 036).
  return getActorClient({ request });
}

/** Kolom file dokumen pengajuan yang dikenal (dari konfigurasi berkas). */
const KNOWN_FILE_KEYS = new Set(BERKAS_DOCUMENTS.map(d => d.fileKey));

/**
 * DELETE /api/dana-kematian/[id]/documents?fileKey=file_sk_pensiun
 *
 * Hapus dokumen pengajuan — mengikuti mekanisme penyimpanan (bucket
 * dana-kematian via lib/supabase-storage) & audit trail aplikasi.
 *
 * Aturan:
 *  - Cabang hanya boleh menghapus dokumen saat status editable
 *    (draft / dikembalikan untuk koreksi). Setelah submit ke pusat → 403.
 *  - Hanya cabang pemilik pengajuan (atau Pusat) yang boleh menghapus.
 *  - Penghapusan file storage + kolom dinolkan + dicatat di riwayat audit.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fileKey = new URL(request.url).searchParams.get('fileKey') || '';

    if (!KNOWN_FILE_KEYS.has(fileKey)) {
      return NextResponse.json({ error: `Jenis dokumen tidak dikenal: ${fileKey}` }, { status: 400 });
    }

    const actor = await getDakemActorContext();
    if (!actor.userId) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (!actor.canManagePC && !actor.canVerifyPP) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses ke modul Dana Kematian', code: 'PERMISSION_DENIED' }, { status: 403 });
    }

    const { data: claim, error: fetchError } = await (await getClient(request))
      .from('dana_kematian')
      .select('id, nama_anggota, status_proses, kode_cabang, claim_status, cabang_pemilik_kode, data_perubahan')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchError || !claim) {
      return NextResponse.json({ error: 'Dana kematian tidak ditemukan' }, { status: 404 });
    }

    // Dokumen terkunci bagi cabang setelah submit (kecuali Pusat).
    if (actor.isCabangOnly && !(CABANG_EDITABLE_STATUSES as readonly string[]).includes(String(claim.status_proses))) {
      return NextResponse.json(
        {
          error:
            'Dokumen terkunci setelah pengajuan disubmit ke Pusat dan tidak dapat dihapus oleh cabang. ' +
            'Dokumen hanya dapat diubah saat draft atau setelah dikembalikan untuk koreksi.',
          code: 'DOCUMENT_LOCKED',
        },
        { status: 403 },
      );
    }

    // Kepemilikan: cabang hanya boleh mengubah pengajuan miliknya.
    if (actor.isCabangOnly) {
      const actorCabang = await getActorCabang(actor.userId);
      const ownership = canEditClaim(claim, {
        isPusat: false,
        userId: actor.userId,
        kodeCabang: actorCabang.kode_cabang || actorCabang.nama_cabang,
      });
      if (!ownership.allowed) {
        return NextResponse.json({ error: ownership.reason, code: 'PERMISSION_DENIED' }, { status: 403 });
      }
    }

    // Ambil URL file saat ini.
    const { data: current, error: currentError } = await (await getClient(request))
      .from('dana_kematian')
      .select(fileKey)
      .eq('id', id)
      .single();

    if (currentError) {
      return NextResponse.json({ error: 'Gagal membaca dokumen', details: currentError.message }, { status: 500 });
    }

    const fileUrl = (current as any)[fileKey] as string | null;
    if (!fileUrl) {
      return NextResponse.json({ error: 'Dokumen belum ada / sudah terhapus.' }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    const actorNama = session?.user?.name || 'Sistem';

    // 1) Null-kan kolom + audit metadata (trigger riwayat/audit membaca data_perubahan).
    const { error: updateError } = await (await getClient(request))
      .from('dana_kematian')
      .update({
        [fileKey]: null,
        data_perubahan: {
          ...((claim as any).data_perubahan || {}),
          actor_id: actor.userId,
          actor_role: actor.canVerifyPP ? 'pusat' : 'cabang',
          actor_nama: actorNama,
          actor_cabang: claim.kode_cabang || null,
          catatan: `Dokumen ${fileKey} dihapus`,
          changed_fields: [fileKey],
        },
      })
      .eq('id', id)
      .is('deleted_at', null);

    if (updateError) {
      return NextResponse.json({ error: 'Gagal menghapus dokumen', details: updateError.message }, { status: 500 });
    }

    // 2) Hapus file fisik dari bucket (mekanisme penyimpanan existing).
    try {
      await deleteFromSupabaseStorage(fileUrl, 'dana-kematian');
    } catch (storageError) {
      // Kolom sudah dinolkan — file fisik gagal dihapus (mis. sudah tidak ada);
      // catat agar dapat ditindaklanjuti, jangan gagalkan request.
      console.error('Storage deletion failed for document:', fileKey, storageError);
    }

    // 3) Audit trail eksplisit.
    const { error: logError } = await (await getClient(request))
      .from('riwayat_proses_dakem')
      .insert({
        dana_kematian_id: id,
        status_dari: claim.status_proses,
        status_ke: claim.status_proses,
        actor_id: actor.userId,
        actor_role: actor.canVerifyPP ? 'pusat' : 'cabang',
        actor_nama: actorNama,
        actor_cabang: claim.kode_cabang || null,
        catatan: `Dokumen ${fileKey} dihapus dari pengajuan`,
        data_perubahan: {
          aksi: 'hapus_dokumen',
          dokumen: fileKey,
          url_dihapus: fileUrl,
          sebelum: { [fileKey]: fileUrl },
          sesudah: { [fileKey]: null },
        },
      });
    if (logError) {
      console.error('Error logging document deletion audit:', logError);
    }

    return NextResponse.json({ message: 'Dokumen berhasil dihapus' });
  } catch (error) {
    console.error('Error in DELETE /api/dana-kematian/[id]/documents:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
