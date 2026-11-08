import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';
import { getActorClient } from '@/lib/supabase-actor';
import {
  requirePermission,
  notAuthenticatedResponse,
  unauthorizedResponse,
} from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';
import {
  formatMutasiValidationErrors,
  validatePengajuanMutasiInput,
} from '@/lib/utils/mutasi-cabang-validation';
import { MUTASI_CABANG_ACTIVE_STATUSES } from '@/lib/workflow/mutasi-cabang-status';

async function getClient(request?: NextRequest) {
  // Client dengan header aktor — audit_log mencatat pelaku (migration 036).
  return getActorClient({ request });
}

/** Resolve cabang tujuan dari master_cabang, fallback ke nama cabang anggota. */
async function resolveCabangTujuan(
  client: NonNullable<typeof supabaseAdmin>,
  cabangTujuan: string,
  kodeCabangTujuan?: string | null,
): Promise<{ nama_cabang: string; kode_cabang: string | null } | null> {
  if (kodeCabangTujuan) {
    const { data: byKode } = await client
      .from('master_cabang')
      .select('kode_cabang, nama_cabang')
      .eq('kode_cabang', kodeCabangTujuan)
      .eq('is_active', true)
      .maybeSingle();
    if (byKode) return { nama_cabang: byKode.nama_cabang, kode_cabang: byKode.kode_cabang };
  }

  const { data: byNama } = await client
    .from('master_cabang')
    .select('kode_cabang, nama_cabang')
    .eq('nama_cabang', cabangTujuan)
    .eq('is_active', true)
    .maybeSingle();
  if (byNama) return { nama_cabang: byNama.nama_cabang, kode_cabang: byNama.kode_cabang };

  const { data: fromAnggota } = await client
    .from('anggota')
    .select('nama_cabang')
    .eq('nama_cabang', cabangTujuan)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (fromAnggota?.nama_cabang) {
    return { nama_cabang: fromAnggota.nama_cabang, kode_cabang: null };
  }

  return null;
}

/**
 * GET /api/mutasi-cabang?status=menunggu&page=1&limit=10
 *
 * Daftar pengajuan mutasi cabang — khusus pengurus/admin (manage keanggotaan).
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10'), 1), 100);
    const offset = (page - 1) * limit;

    const client = await getClient(request);

    let query = client
      .from('pengajuan_mutasi_cabang')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') query = query.eq('status', status);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching pengajuan mutasi cabang:', error);
      return NextResponse.json(
        { error: 'Gagal mengambil daftar pengajuan mutasi cabang', details: error.message },
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
      can_manage: true,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses ke menu mutasi cabang');
    }
    console.error('Error in GET /api/mutasi-cabang:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}

/**
 * POST /api/mutasi-cabang
 *
 * Membuat pengajuan mutasi cabang — khusus pengurus/admin (manage keanggotaan).
 * Anggota dipilih dari NIK, cabang tujuan dipilih dari opsi cabang, lalu data
 * anggota di-snapshot server-side untuk keperluan verifikasi.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);

    const body = await request.json();

    const anggotaId = body?.anggota_id ? String(body.anggota_id).trim() : '';
    const cabangTujuan = body?.cabang_tujuan ? String(body.cabang_tujuan).trim() : '';
    const kodeCabangTujuan = body?.kode_cabang_tujuan
      ? String(body.kode_cabang_tujuan).trim()
      : null;

    if (!anggotaId) {
      return NextResponse.json(
        {
          error: 'Anggota (NIK) wajib dipilih.',
          fields: [{ field: 'anggota_id', message: 'Anggota (NIK) wajib dipilih.' }],
          code: 'VALIDATION_ERROR',
        },
        { status: 400 },
      );
    }

    const client = await getClient(request);

    // Anggota dipilih pengurus dari daftar NIK — diverifikasi server-side.
    const { data: anggota, error: anggotaError } = await client
      .from('anggota')
      .select(
        'id, nik, nama_anggota, nama_cabang, kode_cabang, kategori_anggota, status_anggota, status_keanggotaan',
      )
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

    // Anggota yang sudah berhenti / non-aktif tidak dapat dimutasikan.
    if (anggota.status_keanggotaan && anggota.status_keanggotaan !== 'aktif') {
      return NextResponse.json(
        {
          error:
            'Anggota berstatus tidak aktif (berhenti/non-aktif) dan tidak dapat diajukan mutasi cabang.',
          code: 'ANGGOTA_TIDAK_AKTIF',
        },
        { status: 409 },
      );
    }

    // Validasi lengkap (termasuk cabang tujuan harus berbeda dari cabang asal).
    const validationErrors = validatePengajuanMutasiInput({
      anggota_id: anggotaId,
      cabang_tujuan: cabangTujuan,
      cabang_asal: anggota.nama_cabang,
      tanggal_mulai_mutasi: body?.tanggal_mulai_mutasi,
      nomor_dokumen_mutasi: body?.nomor_dokumen_mutasi,
      tanggal_dokumen_mutasi: body?.tanggal_dokumen_mutasi,
    });

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: formatMutasiValidationErrors(validationErrors),
          fields: validationErrors,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 },
      );
    }

    // Pastikan cabang tujuan dikenal sistem (master cabang / data anggota).
    const cabang = await resolveCabangTujuan(client, cabangTujuan, kodeCabangTujuan);
    if (!cabang) {
      const message = `Cabang tujuan "${cabangTujuan}" tidak ditemukan pada data cabang.`;
      return NextResponse.json(
        {
          error: message,
          fields: [{ field: 'cabang_tujuan', message }],
          code: 'CABANG_TUJUAN_NOT_FOUND',
        },
        { status: 400 },
      );
    }

    const nomorDokumen = String(body.nomor_dokumen_mutasi).trim();

    // Cegah pengajuan ganda yang masih aktif untuk anggota yang sama.
    const { data: activeExisting } = await client
      .from('pengajuan_mutasi_cabang')
      .select('id')
      .eq('anggota_id', anggota.id)
      .in('status', MUTASI_CABANG_ACTIVE_STATUSES as readonly string[])
      .maybeSingle();

    if (activeExisting) {
      return NextResponse.json(
        {
          error: 'Anda masih memiliki pengajuan mutasi cabang yang sedang berjalan.',
          code: 'DUPLICATE_ACTIVE',
        },
        { status: 409 },
      );
    }

    // Nomor dokumen tidak boleh dipakai pengajuan lain yang belum ditolak/dibatalkan.
    const { data: docExisting } = await client
      .from('pengajuan_mutasi_cabang')
      .select('id')
      .eq('nomor_dokumen_mutasi', nomorDokumen)
      .in('status', ['menunggu', 'diverifikasi_pc', 'disetujui_pp'])
      .maybeSingle();

    if (docExisting) {
      return NextResponse.json(
        {
          error: `Nomor dokumen mutasi "${nomorDokumen}" sudah digunakan pada pengajuan lain.`,
          code: 'DOCUMENT_NUMBER_USED',
        },
        { status: 409 },
      );
    }

    const { data, error } = await client
      .from('pengajuan_mutasi_cabang')
      .insert({
        anggota_id: anggota.id,
        diajukan_oleh: user.id,
        nik: anggota.nik ?? null,
        nama_anggota: anggota.nama_anggota ?? null,
        cabang_asal: anggota.nama_cabang ?? null,
        kode_cabang_asal: anggota.kode_cabang ?? null,
        cabang_tujuan: cabang.nama_cabang,
        kode_cabang_tujuan: cabang.kode_cabang,
        tanggal_mulai_mutasi: String(body.tanggal_mulai_mutasi).trim(),
        nomor_dokumen_mutasi: nomorDokumen,
        tanggal_dokumen_mutasi: String(body.tanggal_dokumen_mutasi).trim(),
        status: 'menunggu',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating pengajuan mutasi cabang:', error);

      // Partial unique index → tangani konflik secara eksplisit.
      if (error.code === '23505') {
        const message = String(error.message || '');
        if (message.includes('uq_pengajuan_mutasi_aktif_per_anggota')) {
          return NextResponse.json(
            {
              error: 'Anda masih memiliki pengajuan mutasi cabang yang sedang berjalan.',
              code: 'DUPLICATE_ACTIVE',
            },
            { status: 409 },
          );
        }
        if (message.includes('uq_pengajuan_mutasi_nomor_aktif')) {
          return NextResponse.json(
            {
              error: `Nomor dokumen mutasi "${nomorDokumen}" sudah digunakan pada pengajuan lain.`,
              code: 'DOCUMENT_NUMBER_USED',
            },
            { status: 409 },
          );
        }
      }

      return NextResponse.json(
        { error: 'Gagal menyimpan pengajuan mutasi cabang', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        data,
        message: 'Pengajuan mutasi cabang berhasil dikirim dan menunggu verifikasi.',
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk mengajukan mutasi cabang');
    }
    console.error('Error in POST /api/mutasi-cabang:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}

