import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { UpdateDanaKematianInput } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-storage';
import { isValidStatusTransition } from '@/lib/workflow/dana-kematian-transitions';
import {
  getDeathClaimPeriodExceededMessage,
  isDeathClaimWithinPeriod,
} from '@/lib/utils/death-claim-period';
import { validateDakemDateOrder, formatDateOrderErrors } from '@/lib/utils/dakem-date-order';
import { getDakemActorContext, getActorCabang, validateCabangPatchPermissions } from '@/lib/server/dakem-enforcement';
import { canEditClaim } from '@/lib/server/dakem-claim-rules';
import { getMaxDeathClaimPeriodYears, getRequiredDocumentOverride } from '@/lib/server/dakem-config';
import { isBerkasLengkap } from '@/lib/config/dana-kematian-berkas';
import {
  notifyDanaKematianVerifikasiCabang,
  notifyDanaKematianProsesPusat,
  notifyDanaKematianVerified,
  notifyDanaKematianPenyaluran,
  notifyDanaKematianSelesai,
  notifyDanaKematianDitolak,
  notifyDanaKematianUpdated,
  notifyDanaKematianTerimaAhliWaris,
  notifyDanaKematianLaporan,
  notifyDanaKematianBatal,
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
    const actor = await getDakemActorContext();
    if (!actor.userId) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (!actor.canManagePC && !actor.canVerifyPP) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses ke modul Dana Kematian', code: 'PERMISSION_DENIED' }, { status: 403 });
    }

    const { id } = await params;
    const { data: danaKematian, error } = await getClient()
      .from('dana_kematian')
      .select('*, anggota:anggota_id(nik)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !danaKematian) {
      return NextResponse.json(
        { error: 'Dana kematian tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: danaKematian });
  } catch (error) {
    console.error('Error in GET /api/dana-kematian/[id]:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
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
        tanggal_meninggal, status_ahli_waris, data_perubahan,
        kode_cabang, claim_status, cabang_pemilik_kode, diklaim_oleh,
        tanggal_lapor_keluarga, cabang_tanggal_awal_terima_berkas, cabang_tanggal_kirim_ke_pusat,
        pusat_tanggal_awal_terima, pusat_tanggal_validasi, pusat_tanggal_selesai,
        cabang_tanggal_lapor_ke_pusat, cabang_tanggal_serah_ke_ahli_waris, waktu_2,
        dokumen_surat_kematian_verified, dokumen_sk_pensiun_verified,
        dokumen_surat_pernyataan_verified, dokumen_kartu_keluarga_verified,
        dokumen_ktp_ahli_waris_verified, dokumen_surat_nikah_verified,
        dokumen_surat_keterangan_verified, dokumen_pendukung_verified,
        file_sk_pensiun, file_surat_kematian, file_surat_pernyataan_ahli_waris,
        file_kartu_keluarga, file_e_ktp, file_surat_nikah, file_surat_keterangan,
        file_dokumen_pendukung, document_metadata
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existingClaim) {
      return NextResponse.json(
        { error: 'Dana kematian tidak ditemukan' },
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
    if ((body as any).file_bukti_penyerahan !== undefined) patch['file_bukti_penyerahan'] = (body as any).file_bukti_penyerahan;
    if ((body as any).document_metadata !== undefined) patch['document_metadata'] = (body as any).document_metadata;
    const boolFields = [
      'dokumen_surat_kematian_verified', 'dokumen_sk_pensiun_verified',
      'dokumen_surat_pernyataan_verified', 'dokumen_kartu_keluarga_verified',
      'dokumen_ktp_ahli_waris_verified', 'dokumen_surat_nikah_verified',
      'dokumen_surat_keterangan_verified', 'dokumen_pendukung_verified',
    ];
    boolFields.forEach(f => { if ((body as any)[f] !== undefined) patch[f] = (body as any)[f]; });

    // Auto-revert status to proses_pusat when a document is re-uploaded after rejection
    const docFileFields: Record<string, string> = {
      file_sk_pensiun:                  'file_sk_pensiun_rejection_note',
      file_surat_kematian:              'file_surat_kematian_rejection_note',
      file_surat_pernyataan_ahli_waris: 'file_surat_pernyataan_ahli_waris_rejection_note',
      file_kartu_keluarga:              'file_kartu_keluarga_rejection_note',
      file_e_ktp:                       'file_e_ktp_rejection_note',
      file_surat_nikah:                 'file_surat_nikah_rejection_note',
      file_surat_keterangan:            'file_surat_keterangan_rejection_note',
      file_dokumen_pendukung:           'file_dokumen_pendukung_rejection_note',
    };
    if (
      existingClaim.status_proses === 'pending_dokumen' &&
      // Only skip if the caller is explicitly advancing to a different status
      (!patch['status_proses'] || patch['status_proses'] === 'pending_dokumen')
    ) {
      const updatedFileKeys = Object.keys(docFileFields).filter(
        field => patch[field] !== undefined && patch[field] !== (existingClaim as any)[field]
      );
      if (updatedFileKeys.length > 0) {
        patch['status_proses'] = 'proses_pusat';
        // Clear rejection notes for the re-uploaded documents. Base on the
        // client-provided metadata when present so fields saved in the same
        // request (form edit) are not lost.
        const baseMeta: Record<string, any> =
          (patch['document_metadata'] as Record<string, any>) ||
          (existingClaim as any).document_metadata || {};
        const clearedMeta = { ...baseMeta };
        updatedFileKeys.forEach(field => {
          delete clearedMeta[docFileFields[field]];
          delete clearedMeta[`${field}_rejected_at`];
        });
        patch['document_metadata'] = clearedMeta;
      }
    }

    // Enforce the workflow sequence server-side: a status change must follow
    // an allowed transition (lib/workflow/dana-kematian-transitions.ts).
    const requestedStatus = patch['status_proses'] as string | undefined;
    if (requestedStatus && requestedStatus !== existingClaim.status_proses) {
      const transition = isValidStatusTransition(existingClaim.status_proses, requestedStatus);
      if (!transition.valid) {
        return NextResponse.json({ error: transition.message }, { status: 400 });
      }
    }

    // Batas waktu pengajuan Dana Kematian (MAX_DEATH_CLAIM_PERIOD_YEARS, di
    // lib/config/dana-kematian-config.ts): pengajuan hanya boleh diproses jika
    // jarak tanggal meninggal → tanggal pengajuan masih dalam batas. Gate
    // berlaku saat (1) draft dikirim untuk diproses, atau (2) tanggal meninggal
    // diubah pada pengajuan non-draft. Pengajuan existing yang sudah berjalan
    // tidak divalidasi ulang selama tanggalnya tidak diubah, dan status
    // draft/batal tidak diblokir (draft divalidasi saat dikirim; batal adalah
    // arsip).
    const isDraftClaim = existingClaim.status_proses === 'draft';
    const tanggalMeninggalChanged =
      patch['tanggal_meninggal'] != null &&
      patch['tanggal_meninggal'] !== existingClaim.tanggal_meninggal;
    const nextStatus = (requestedStatus || existingClaim.status_proses) as string;
    const isProcessingStatus = nextStatus !== 'draft' && nextStatus !== 'batal';
    const needsPeriodValidation =
      isProcessingStatus &&
      ((isDraftClaim && requestedStatus !== undefined) ||
        (!isDraftClaim && tanggalMeninggalChanged));

    if (needsPeriodValidation) {
      const effectiveTanggalMeninggal =
        (patch['tanggal_meninggal'] as string | null | undefined) ?? existingClaim.tanggal_meninggal;
      if (effectiveTanggalMeninggal) {
        // Batas tahun dikelola admin pusat (tabel dana_kematian_config);
        // fallback ke MAX_DEATH_CLAIM_PERIOD_YEARS (4) bila belum dikonfigurasi.
        const maxYears = await getMaxDeathClaimPeriodYears();
        if (!isDeathClaimWithinPeriod(effectiveTanggalMeninggal, new Date(), maxYears)) {
          return NextResponse.json(
            { error: getDeathClaimPeriodExceededMessage(maxYears) },
            { status: 400 }
          );
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // AUTHORIZATION & BUSINESS-RULE ENFORCEMENT (backend, anti-bypass API)
    // ─────────────────────────────────────────────────────────────────────
    const actor = await getDakemActorContext();
    if (!actor.userId) {
      return NextResponse.json(
        { error: 'Silakan login terlebih dahulu', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    if (!actor.canManagePC && !actor.canVerifyPP) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses ke modul Dana Kematian', code: 'PERMISSION_DENIED' },
        { status: 403 }
      );
    }

    // 1) Field-level lock: read-only pasca submit ke Pusat untuk Cabang,
    //    bidang ranah Pusat hanya oleh Pusat (lib/server/dakem-enforcement-rules).
    const permissionCheck = validateCabangPatchPermissions(patch, existingClaim, actor);
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: permissionCheck.message, code: 'PERMISSION_DENIED' }, { status: 403 });
    }

    // 2) Kepemilikan pengajuan (anti akses lintas-cabang / IDOR): user cabang
    //    hanya boleh mengubah pengajuan milik cabangnya sendiri.
    if (actor.isCabangOnly) {
      const actorCabang = await getActorCabang(actor.userId);
      const ownership = canEditClaim(existingClaim, {
        isPusat: false,
        userId: actor.userId,
        kodeCabang: actorCabang.kode_cabang || actorCabang.nama_cabang,
      });
      if (!ownership.allowed) {
        return NextResponse.json({ error: ownership.reason, code: 'PERMISSION_DENIED' }, { status: 403 });
      }
    }

    // 3) Urutan tanggal kronologis (lib/utils/dakem-date-order.ts).
    const dateFields = [
      'tanggal_meninggal',
      'tanggal_lapor_keluarga',
      'cabang_tanggal_awal_terima_berkas',
      'cabang_tanggal_kirim_ke_pusat',
      'pusat_tanggal_awal_terima',
      'pusat_tanggal_validasi',
      'pusat_tanggal_selesai',
      'cabang_tanggal_lapor_ke_pusat',
      'cabang_tanggal_serah_ke_ahli_waris',
    ];
    const mergedDates: Record<string, string | null> = {};
    for (const field of dateFields) {
      mergedDates[field] =
        patch[field] !== undefined
          ? ((patch[field] as string | null) ?? null)
          : ((existingClaim as any)[field] ?? null);
    }
    const dateErrors = validateDakemDateOrder(mergedDates);
    if (dateErrors.length > 0) {
      return NextResponse.json(
        { error: formatDateOrderErrors(dateErrors), fields: dateErrors },
        { status: 400 }
      );
    }

    // 4) Gate dokumen wajib saat submit/submit ulang ke Verifikasi Pusat.
    //    Konfigurasi wajib/opsional dikelola admin pusat (dana_kematian_config).
    const finalStatus = (patch['status_proses'] as string | undefined) ?? existingClaim.status_proses;
    if (finalStatus === 'proses_pusat' && existingClaim.status_proses !== 'proses_pusat') {
      const override = await getRequiredDocumentOverride();
      const mergedClaim = { ...existingClaim, ...patch } as Record<string, any>;
      if (!isBerkasLengkap(mergedClaim, { statusAhliWaris: mergedClaim.status_ahli_waris }, override)) {
        return NextResponse.json(
          {
            error:
              'Dokumen wajib belum lengkap — lengkapi dokumen sebelum mengirim ke Verifikasi Pusat.',
            code: 'DOCUMENTS_INCOMPLETE',
          },
          { status: 400 }
        );
      }
      // Waktu-2: submit final dokumen ke PP (untuk pengukuran waktu proses).
      if (!patch['waktu_2'] && !(existingClaim as any).waktu_2) {
        patch['waktu_2'] = new Date().toISOString();
      }
    }

    // 5) Audit aktor: data_perubahan dipakai trigger riwayat_proses_dakem &
    //    audit_dana_kematian (migration 006/011/012) — kolom actor_* wajib terisi.
    const sessionForActor = await getServerSession(authOptions);
    patch['data_perubahan'] = {
      ...(existingClaim.data_perubahan || {}),
      actor_id: actor.userId,
      actor_role: actor.canVerifyPP ? 'pusat' : 'cabang',
      actor_nama: sessionForActor?.user?.name || 'Sistem',
      actor_cabang: existingClaim.cabang_asal_melapor || null,
      catatan: (body as any).keterangan || `Update oleh ${actor.canVerifyPP ? 'Pusat' : 'Cabang'}`,
      changed_fields: Object.keys(patch).filter(k => k !== 'data_perubahan' && k !== 'updated_at'),
    };
    // ─────────────────────────────────────────────────────────────────────

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
    const session = await getServerSession(authOptions);
    const aktor = session?.user?.name || '';
    const newStatus = patch['status_proses'] as string | undefined;

    if (newStatus && newStatus !== existingClaim.status_proses) {
      switch (newStatus) {
        case 'verifikasi_cabang':
          notifyDanaKematianVerifikasiCabang(id, nama, aktor);
          break;
        case 'proses_pusat':
          notifyDanaKematianProsesPusat(id, nama, aktor);
          break;
        case 'verified':
          notifyDanaKematianVerified(id, nama, aktor);
          break;
        case 'penyaluran':
          notifyDanaKematianPenyaluran(id, nama, aktor);
          break;
        case 'terima_ahli_waris':
          notifyDanaKematianTerimaAhliWaris(id, nama, aktor);
          break;
        case 'laporan':
          notifyDanaKematianLaporan(id, nama, aktor);
          break;
        case 'selesai':
          notifyDanaKematianSelesai(
            id,
            nama,
            updatedDanaKematian.besaran_dana_kematian || existingClaim.besaran_dana_kematian || 0,
          );
          break;
        case 'batal':
          notifyDanaKematianBatal(id, nama, aktor);
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
      { error: 'Terjadi kesalahan pada server' },
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
    // Auth: hanya user dengan akses Dana Kematian; cabang hanya boleh
    // menghapus pengajuan milik cabangnya sendiri (anti akses lintas-cabang).
    const actor = await getDakemActorContext();
    if (!actor.userId) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (!actor.canManagePC) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses untuk menghapus pengajuan Dana Kematian', code: 'PERMISSION_DENIED' }, { status: 403 });
    }

    const { id } = await params;
    // Check if claim exists
    const { data: existingClaim } = await getClient()
      .from('dana_kematian')
      .select('id, status_proses, nama_anggota, kode_cabang, cabang_asal_melapor, claim_status, cabang_pemilik_kode')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existingClaim) {
      return NextResponse.json(
        { error: 'Dana kematian tidak ditemukan' },
        { status: 404 }
      );
    }

    // Kepemilikan: cabang hanya boleh menghapus pengajuan miliknya.
    if (actor.isCabangOnly) {
      const actorCabang = await getActorCabang(actor.userId);
      const ownership = canEditClaim(existingClaim, {
        isPusat: false,
        userId: actor.userId,
        kodeCabang: actorCabang.kode_cabang || actorCabang.nama_cabang,
      });
      if (!ownership.allowed) {
        return NextResponse.json({ error: ownership.reason, code: 'PERMISSION_DENIED' }, { status: 403 });
      }
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
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}
