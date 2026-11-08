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
  formatPengakhiranValidationErrors,
  validatePengakhiranInput,
} from '@/lib/utils/pengakhiran-keanggotaan-validation';
import {
  PENGAKHIRAN_WITH_ANGGOTA_SELECT,
  hasActiveMutasiForAnggota,
  hasActivePengakhiran,
  hasBlockingDakemForAnggota,
  hasFinalPengakhiran,
} from '@/lib/server/pengakhiran-keanggotaan-service';

async function getClient(request?: NextRequest) {
  // Client dengan header aktor — audit_log mencatat pelaku (migration 036).
  return getActorClient({ request });
}

/**
 * GET /api/pengakhiran-keanggotaan?status=&search=&page=&limit=
 *
 * Daftar pengajuan pengakhiran keanggotaan — pengurus/admin.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAnyPermission([...PENGAKHIRAN_VIEW_PERMISSIONS]);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const search = (searchParams.get('search') || '').trim();
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20'), 1), 100);
    const offset = (page - 1) * limit;

    const client = await getClient(request);

    let query = client
      .from('pengakhiran_keanggotaan')
      .select(PENGAKHIRAN_WITH_ANGGOTA_SELECT, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') query = query.eq('status', status);

    if (search) {
      // Cari berdasarkan NIK/Nama anggota (relasi) — cari id anggota yang cocok.
      const { data: matchingAnggota } = await client
        .from('anggota')
        .select('id')
        .or(`nik.ilike.%${search}%,nama_anggota.ilike.%${search}%`)
        .is('deleted_at', null)
        .limit(200);

      const matchingIds = (matchingAnggota || []).map((a: { id: string }) => a.id);
      query = query.in(
        'anggota_id',
        matchingIds.length ? matchingIds : ['00000000-0000-0000-0000-000000000000'],
      );
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching pengakhiran_keanggotaan:', error);
      return NextResponse.json(
        { error: 'Gagal mengambil data pengakhiran keanggotaan', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: data || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 1,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses ke data pengakhiran keanggotaan');
    }
    console.error('Error in GET /api/pengakhiran-keanggotaan:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}

/**
 * POST /api/pengakhiran-keanggotaan
 *
 * Membuat pengajuan pengakhiran keanggotaan — pengurus/admin.
 * Anggota di-resolve server-side; data di-snapshot; status awal 'menunggu'.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyPermission([...PENGAKHIRAN_MANAGE_PERMISSIONS]);

    const body = await request.json();
    const validationErrors = validatePengakhiranInput({
      anggota_id: body?.anggota_id,
      alasan: body?.alasan,
      keterangan_alasan: body?.keterangan_alasan,
      tanggal_efektif_berhenti: body?.tanggal_efektif_berhenti,
      nomor_dokumen: body?.nomor_dokumen,
      tanggal_dokumen: body?.tanggal_dokumen,
    });

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: formatPengakhiranValidationErrors(validationErrors),
          fields: validationErrors,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 },
      );
    }

    const client = await getClient(request);
    const anggotaId = String(body.anggota_id).trim();

    // Anggota harus terdaftar, aktif, dan bukan berstatus meninggal.
    const { data: anggota, error: anggotaError } = await client
      .from('anggota')
      .select('id, nik, nama_anggota, nama_cabang, kode_cabang, status_anggota, status_keanggotaan')
      .eq('id', anggotaId)
      .is('deleted_at', null)
      .maybeSingle();

    if (anggotaError) {
      console.error('Error resolving anggota:', anggotaError);
      return NextResponse.json(
        { error: 'Gagal memuat data anggota', details: anggotaError.message },
        { status: 500 },
      );
    }
    if (!anggota) {
      return NextResponse.json(
        { error: 'Anggota tidak ditemukan', code: 'ANGGOTA_NOT_FOUND' },
        { status: 404 },
      );
    }
    if (anggota.status_anggota === 'meninggal') {
      return NextResponse.json(
        {
          error:
            'Anggota berstatus meninggal — gunakan modul Data Meninggal Dunia, bukan Pengakhiran Keanggotaan.',
          code: 'ANGGOTA_MENINGGAL',
        },
        { status: 409 },
      );
    }
    if (anggota.status_keanggotaan === 'berhenti') {
      return NextResponse.json(
        { error: 'Anggota sudah berstatus berhenti keanggotaannya.', code: 'ALREADY_BERHENTI' },
        { status: 409 },
      );
    }

    // Cegah duplikasi & konflik lifecycle.
    if (await hasActivePengakhiran(anggotaId)) {
      return NextResponse.json(
        {
          error: 'Anggota ini masih memiliki pengajuan pengakhiran yang sedang berjalan.',
          code: 'DUPLICATE_ACTIVE',
        },
        { status: 409 },
      );
    }
    if (await hasFinalPengakhiran(anggotaId)) {
      return NextResponse.json(
        {
          error: 'Anggota ini sudah memiliki pengakhiran keanggotaan yang disetujui.',
          code: 'DUPLICATE_FINAL',
        },
        { status: 409 },
      );
    }
    if (await hasActiveMutasiForAnggota(anggotaId)) {
      return NextResponse.json(
        {
          error:
            'Anggota ini memiliki pengajuan mutasi cabang yang sedang berjalan. Batalkan terlebih dahulu.',
          code: 'ACTIVE_MUTASI',
        },
        { status: 409 },
      );
    }
    if (await hasBlockingDakemForAnggota(anggotaId)) {
      return NextResponse.json(
        {
          error: 'Anggota ini memiliki pengajuan Dana Kematian yang belum selesai.',
          code: 'ACTIVE_DAKEM',
        },
        { status: 409 },
      );
    }

    const nomorDokumen = String(body.nomor_dokumen).trim();

    // Nomor dokumen tidak boleh dipakai pengajuan lain yang belum ditolak/dibatalkan.
    const { data: docExisting } = await client
      .from('pengakhiran_keanggotaan')
      .select('id')
      .eq('nomor_dokumen', nomorDokumen)
      .in('status', ['menunggu', 'diverifikasi_pc', 'disetujui_pp'])
      .is('deleted_at', null)
      .maybeSingle();

    if (docExisting) {
      return NextResponse.json(
        {
          error: `Nomor dokumen "${nomorDokumen}" sudah digunakan pada pengajuan lain.`,
          code: 'DOCUMENT_NUMBER_USED',
        },
        { status: 409 },
      );
    }

    const { data, error } = await client
      .from('pengakhiran_keanggotaan')
      .insert({
        anggota_id: anggota.id,
        diajukan_oleh: user.id,
        nik: anggota.nik ?? null,
        nama_anggota: anggota.nama_anggota ?? null,
        nama_cabang: anggota.nama_cabang ?? null,
        kode_cabang: anggota.kode_cabang ?? null,
        alasan: String(body.alasan).trim(),
        keterangan_alasan: body.keterangan_alasan ? String(body.keterangan_alasan).trim() : null,
        tanggal_efektif_berhenti: String(body.tanggal_efektif_berhenti).trim().slice(0, 10),
        nomor_dokumen: nomorDokumen,
        tanggal_dokumen: String(body.tanggal_dokumen).trim().slice(0, 10),
        keterangan: body.keterangan ? String(body.keterangan).trim() : null,
        file_dokumen_pendukung: body.file_dokumen_pendukung || null,
        catatan_pengaju: body.catatan_pengaju ? String(body.catatan_pengaju).trim() : null,
        status: 'menunggu',
      })
      .select(PENGAKHIRAN_WITH_ANGGOTA_SELECT)
      .single();

    if (error) {
      console.error('Error creating pengakhiran_keanggotaan:', error);

      if (error.code === '23505') {
        const message = String(error.message || '');
        if (message.includes('uq_pengakhiran_aktif_per_anggota')) {
          return NextResponse.json(
            {
              error: 'Anggota ini masih memiliki pengajuan pengakhiran yang sedang berjalan.',
              code: 'DUPLICATE_ACTIVE',
            },
            { status: 409 },
          );
        }
        if (message.includes('uq_pengakhiran_nomor_aktif')) {
          return NextResponse.json(
            {
              error: `Nomor dokumen "${nomorDokumen}" sudah digunakan pada pengajuan lain.`,
              code: 'DOCUMENT_NUMBER_USED',
            },
            { status: 409 },
          );
        }
      }

      return NextResponse.json(
        { error: 'Gagal menyimpan pengajuan pengakhiran keanggotaan', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        data,
        message: 'Pengajuan pengakhiran keanggotaan berhasil dikirim dan menunggu verifikasi PC.',
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk mengajukan pengakhiran keanggotaan');
    }
    console.error('Error in POST /api/pengakhiran-keanggotaan:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
