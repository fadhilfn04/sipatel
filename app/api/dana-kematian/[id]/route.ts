import { NextRequest, NextResponse } from 'next/server';
import { UpdateDanaKematianInput } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-storage';
import {
  notifyDanaKematianVerifikasiCabang,
  notifyDanaKematianProsesPusat,
  notifyDanaKematianSelesai,
  notifyDanaKematianDitolak,
  notifyDanaKematianUpdated,
  notifyDokumenVerified,
  notifyDanaKematianDeleted,
} from '@/lib/server/create-notification';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  return supabaseAdmin;
}

// GET /api/dana-kematian/[id] - Get single death benefit claim by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: danaKematian, error } = await getClient()
      .from('dana_kematian')
      .select('*, anggota:anggota_id(nik)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !danaKematian) {
      return NextResponse.json(
        { error: 'Dana kematian not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: danaKematian });
  } catch (error) {
    console.error('Error in GET /api/dana-kematian/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/dana-kematian/[id] - Update death benefit claim
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateDanaKematianInput = await request.json();

    // Fetch existing claim to compare changes for notifications
    const { data: existingClaim } = await getClient()
      .from('dana_kematian')
      .select(`
        id, nama_anggota, cabang_asal_melapor, status_proses, besaran_dana_kematian, keterangan,
        dokumen_surat_kematian_verified, dokumen_sk_pensiun_verified,
        dokumen_surat_pernyataan_verified, dokumen_kartu_keluarga_verified,
        dokumen_ktp_ahli_waris_verified, dokumen_surat_nikah_verified,
        dokumen_surat_keterangan_verified, dokumen_pendukung_verified
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existingClaim) {
      return NextResponse.json(
        { error: 'Dana kematian not found' },
        { status: 404 }
      );
    }

    // undefined = field not sent (skip), '' = clear to null, value = update
    const toDate = (v: string | null | undefined) => v === undefined ? undefined : (v || null);
    const toText = (v: string | null | undefined) => v === undefined ? undefined : v;

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const d = (k: string, v: ReturnType<typeof toDate>) => { if (v !== undefined) patch[k] = v; };
    const t = (k: string, v: ReturnType<typeof toText>) => { if (v !== undefined) patch[k] = v; };

    t('nama_anggota', toText(body.nama_anggota));
    t('status_anggota', toText(body.status_anggota));
    t('status_mps', toText(body.status_mps));
    d('tanggal_meninggal', toDate(body.tanggal_meninggal));
    t('penyebab_meninggal', toText(body.penyebab_meninggal));
    d('tanggal_lapor_keluarga', toDate(body.tanggal_lapor_keluarga));
    t('cabang_asal_melapor', toText(body.cabang_asal_melapor));
    t('cabang_nama_pelapor', toText(body.cabang_nama_pelapor));
    t('cabang_nik_pelapor', toText(body.cabang_nik_pelapor));
    d('cabang_tanggal_awal_terima_berkas', toDate(body.cabang_tanggal_awal_terima_berkas));
    d('cabang_tanggal_kirim_ke_pusat', toDate(body.cabang_tanggal_kirim_ke_pusat));
    d('pusat_tanggal_awal_terima', toDate(body.pusat_tanggal_awal_terima));
    d('pusat_tanggal_validasi', toDate(body.pusat_tanggal_validasi));
    d('pusat_tanggal_selesai', toDate(body.pusat_tanggal_selesai));
    if (body.besaran_dana_kematian !== undefined) patch['besaran_dana_kematian'] = body.besaran_dana_kematian;
    d('cabang_tanggal_serah_ke_ahli_waris', toDate(body.cabang_tanggal_serah_ke_ahli_waris));
    d('cabang_tanggal_lapor_ke_pusat', toDate(body.cabang_tanggal_lapor_ke_pusat));
    t('nama_ahli_waris', toText(body.nama_ahli_waris));
    t('status_ahli_waris', toText(body.status_ahli_waris));
    t('file_sk_pensiun', toText(body.file_sk_pensiun));
    t('file_surat_kematian', toText(body.file_surat_kematian));
    t('file_surat_pernyataan_ahli_waris', toText(body.file_surat_pernyataan_ahli_waris));
    t('file_kartu_keluarga', toText(body.file_kartu_keluarga));
    t('file_e_ktp', toText(body.file_e_ktp));
    t('file_surat_nikah', toText(body.file_surat_nikah));
    t('file_surat_keterangan', toText(body.file_surat_keterangan));
    t('file_dokumen_pendukung', toText(body.file_dokumen_pendukung));
    t('susunan_keluarga', toText(body.susunan_keluarga));
    t('status_proses', toText(body.status_proses));
    t('keterangan', toText(body.keterangan));
    if ((body as any).waktu_3 !== undefined) patch['waktu_3'] = (body as any).waktu_3;
    if ((body as any).waktu_4 !== undefined) patch['waktu_4'] = (body as any).waktu_4;
    if ((body as any).waktu_5 !== undefined) patch['waktu_5'] = (body as any).waktu_5;
    if ((body as any).waktu_6 !== undefined) patch['waktu_6'] = (body as any).waktu_6;
    if ((body as any).waktu_7 !== undefined) patch['waktu_7'] = (body as any).waktu_7;
    const boolFields = [
      'dokumen_surat_kematian_verified', 'dokumen_sk_pensiun_verified',
      'dokumen_surat_pernyataan_verified', 'dokumen_kartu_keluarga_verified',
      'dokumen_ktp_ahli_waris_verified', 'dokumen_surat_nikah_verified',
      'dokumen_surat_keterangan_verified', 'dokumen_pendukung_verified',
    ];
    boolFields.forEach(f => { if ((body as any)[f] !== undefined) patch[f] = (body as any)[f]; });

    // Update dana kematian
    const { data: updatedDanaKematian, error } = await getClient()
      .from('dana_kematian')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating dana kematian:', error);
      return NextResponse.json(
        { error: 'Failed to update dana kematian', details: error.message },
        { status: 500 }
      );
    }

    // ── Fire workflow notifications (non-blocking) ────────────────────
    const nama = existingClaim.nama_anggota;
    const aktor = (body as any).data_perubahan?.actor_nama || '';
    const newStatus = patch['status_proses'] as string | undefined;

    if (newStatus && newStatus !== existingClaim.status_proses) {
      switch (newStatus) {
        case 'verifikasi_cabang':
          notifyDanaKematianVerifikasiCabang(id, nama, aktor);
          break;
        case 'proses_pusat':
          notifyDanaKematianProsesPusat(id, nama, aktor);
          break;
        case 'selesai':
          notifyDanaKematianSelesai(
            id,
            nama,
            updatedDanaKematian.besaran_dana_kematian || existingClaim.besaran_dana_kematian || 0,
          );
          break;
        case 'ditolak':
          notifyDanaKematianDitolak(id, nama, (body as any).keterangan || existingClaim.keterangan);
          break;
        default:
          notifyDanaKematianUpdated(id, nama, aktor);
      }
    } else {
      // Check if any document was verified (false → true transition)
      const docFields: Array<{ field: string; label: string }> = [
        { field: 'dokumen_surat_kematian_verified',    label: 'Surat Kematian' },
        { field: 'dokumen_sk_pensiun_verified',         label: 'SK Pensiun' },
        { field: 'dokumen_surat_pernyataan_verified',   label: 'Surat Pernyataan Ahli Waris' },
        { field: 'dokumen_kartu_keluarga_verified',     label: 'Kartu Keluarga' },
        { field: 'dokumen_ktp_ahli_waris_verified',     label: 'KTP Ahli Waris' },
        { field: 'dokumen_surat_nikah_verified',        label: 'Surat Nikah' },
        { field: 'dokumen_surat_keterangan_verified',   label: 'Surat Keterangan' },
        { field: 'dokumen_pendukung_verified',          label: 'Dokumen Pendukung' },
      ];

      for (const { field, label } of docFields) {
        const wasVerified = (existingClaim as any)[field];
        const nowVerified = (body as any)[field];
        if (!wasVerified && nowVerified === true) {
          notifyDokumenVerified(id, nama, label);
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────

    return NextResponse.json({
      data: updatedDanaKematian,
      message: 'Dana kematian berhasil diupdate',
    });

  } catch (error) {
    console.error('Error in PUT /api/dana-kematian/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/dana-kematian/[id] - Soft delete death benefit claim
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Check if claim exists
    const { data: existingClaim } = await getClient()
      .from('dana_kematian')
      .select('id, status_proses, nama_anggota')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existingClaim) {
      return NextResponse.json(
        { error: 'Dana kematian not found' },
        { status: 404 }
      );
    }

    // Prevent deletion if already completed
    if (existingClaim.status_proses === 'selesai') {
      return NextResponse.json(
        { error: 'Cannot delete claim that has been completed' },
        { status: 400 }
      );
    }

    // Soft delete by setting deleted_at
    const { error } = await getClient()
      .from('dana_kematian')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting dana kematian:', error);
      return NextResponse.json(
        { error: 'Failed to delete dana kematian', details: error.message },
        { status: 500 }
      );
    }

    notifyDanaKematianDeleted(existingClaim.nama_anggota);

    return NextResponse.json({
      message: 'Dana kematian berhasil dihapus',
    });

  } catch (error) {
    console.error('Error in DELETE /api/dana-kematian/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
