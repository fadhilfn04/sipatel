import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { CreateDanaKematianInput, DanaKematianFilter } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-storage';
import { notifyDanaKematianCreated } from '@/lib/server/create-notification';
import {
  getDeathClaimPeriodExceededMessage,
  isDeathClaimWithinPeriod,
} from '@/lib/utils/death-claim-period';
import { validateDakemDateOrder, formatDateOrderErrors } from '@/lib/utils/dakem-date-order';
import { getDakemActorContext, getActorCabang } from '@/lib/server/dakem-enforcement';
import { getMaxDeathClaimPeriodYears, getRequiredDocumentOverride } from '@/lib/server/dakem-config';
import { isBerkasLengkap } from '@/lib/config/dana-kematian-berkas';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  return supabaseAdmin;
}

// GET /api/dana-kematian - List death benefits with filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status_proses') || '';
    const dateFrom = searchParams.get('tanggal_meninggal_from') || '';
    const dateTo = searchParams.get('tanggal_meninggal_to') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    const orderBy = searchParams.get('orderBy') || 'created_at';
    const orderDirection = searchParams.get('orderDirection') || 'desc';

    let query = getClient()
      .from('dana_kematian')
      .select('*, anggota:anggota_id(nik)', { count: 'exact' })
      .order(orderBy, {
        ascending: orderDirection === 'asc',
      })
      .is('deleted_at', null);

    // Search
    if (search) {
      // Find anggota IDs whose NIK matches the search term (NIK lives in the anggota table, not dana_kematian)
      const { data: nikMatches } = await getClient()
        .from('anggota')
        .select('id')
        .ilike('nik', `%${search}%`)
        .is('deleted_at', null);

      const matchingIds = (nikMatches || []).map((a: { id: string }) => a.id);

      let orFilter = `nama_anggota.ilike.%${search}%,nama_ahli_waris.ilike.%${search}%,cabang_asal_melapor.ilike.%${search}%,cabang_nik_pelapor.ilike.%${search}%`;

      if (matchingIds.length > 0) {
        orFilter += `,anggota_id.in.(${matchingIds.join(',')})`;
      }

      query = query.or(orFilter);
    }

    // Filter by status
    if (status && status !== 'all') {
      query = query.eq('status_proses', status);
    }

    // Filter by date range
    if (dateFrom) {
      query = query.gte('tanggal_meninggal', dateFrom);
    }
    if (dateTo) {
      query = query.lte('tanggal_meninggal', dateTo);
    }

    // Get paginated data
    const { data: danaKematian, error, count } = await query
      .order('tanggal_meninggal', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching dana kematian:', error);
      return NextResponse.json(
        { error: 'Failed to fetch dana kematian', details: error.message },
        { status: 500 }
      );
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      data: danaKematian || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/dana-kematian:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}

// POST /api/dana-kematian - Create new death benefit claim
export async function POST(request: NextRequest) {
  try {
    const body: CreateDanaKematianInput = await request.json();

    // Auth: hanya user cabang/pusat dengan akses Dana Kematian yang boleh
    // membuat pengajuan.
    const actor = await getDakemActorContext();
    if (!actor.userId) {
      return NextResponse.json(
        { error: 'Silakan login terlebih dahulu', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    if (!actor.canManagePC) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses untuk membuat pengajuan Dana Kematian', code: 'PERMISSION_DENIED' },
        { status: 403 }
      );
    }
    const actorCabang = await getActorCabang(actor.userId);
    const kodeCabangPengaju = body.kode_cabang || actorCabang.kode_cabang || null;
    const cabangPengaju = body.cabang_asal_melapor || actorCabang.nama_cabang || '';

    // Drafts (on going process) only require the identity fields; full
    // validation applies when the berkas is submitted for verification.
    const isDraft = body.status_proses === 'draft';
    const requiredFields = isDraft
      ? [
          'nama_anggota',
          'status_anggota',
          'status_mps',
          'cabang_asal_melapor',
        ]
      : [
          'nama_anggota',
          'status_anggota',
          'status_mps',
          'tanggal_meninggal',
          'cabang_asal_melapor',
          'besaran_dana_kematian',
          'nama_ahli_waris',
          'status_ahli_waris',
        ];

    for (const field of requiredFields) {
      if (!body[field as keyof CreateDanaKematianInput]) {
        return NextResponse.json(
          { error: `Field '${field}' is required` },
          { status: 400 }
        );
      }
    }

    // Batas waktu pengajuan: nilai tahun dikelola admin pusat (tabel
    // dana_kematian_config); fallback ke MAX_DEATH_CLAIM_PERIOD_YEARS (4).
    // Draft bebas dari rule ini — gate berlaku saat berkas dikirim untuk
    // diproses.
    const maxYears = await getMaxDeathClaimPeriodYears();
    if (!isDraft && !isDeathClaimWithinPeriod(body.tanggal_meninggal, new Date(), maxYears)) {
      return NextResponse.json(
        { error: getDeathClaimPeriodExceededMessage(maxYears) },
        { status: 400 }
      );
    }

    // Urutan tanggal kronologis workflow (lib/utils/dakem-date-order.ts).
    // Hanya pasangan tanggal yang terisi yang divalidasi — draft parsial aman.
    const dateErrors = validateDakemDateOrder({
      tanggal_meninggal: body.tanggal_meninggal,
      tanggal_lapor_keluarga: body.tanggal_lapor_keluarga,
      cabang_tanggal_awal_terima_berkas: body.cabang_tanggal_awal_terima_berkas,
      cabang_tanggal_kirim_ke_pusat: body.cabang_tanggal_kirim_ke_pusat,
      pusat_tanggal_awal_terima: body.pusat_tanggal_awal_terima,
      pusat_tanggal_validasi: body.pusat_tanggal_validasi,
      pusat_tanggal_selesai: body.pusat_tanggal_selesai,
      cabang_tanggal_lapor_ke_pusat: body.cabang_tanggal_lapor_ke_pusat,
      cabang_tanggal_serah_ke_ahli_waris: body.cabang_tanggal_serah_ke_ahli_waris,
    });
    if (dateErrors.length > 0) {
      return NextResponse.json(
        { error: formatDateOrderErrors(dateErrors), fields: dateErrors },
        { status: 400 }
      );
    }

    // Gate dokumen wajib saat langsung submit "Berkas Lengkap" ke Verifikasi
    // Pusat. Konfigurasi wajib/opsional dikelola admin pusat.
    if (body.status_proses === 'proses_pusat') {
      const override = await getRequiredDocumentOverride();
      const claimForCheck = {
        ...body,
        document_metadata: body.document_metadata || {},
      } as Record<string, any>;
      if (!isBerkasLengkap(claimForCheck, { statusAhliWaris: body.status_ahli_waris }, override)) {
        return NextResponse.json(
          {
            error: 'Dokumen wajib belum lengkap — lengkapi dokumen sebelum mengirim ke Verifikasi Pusat.',
            code: 'DOCUMENTS_INCOMPLETE',
          },
          { status: 400 }
        );
      }
    }

    // Check if member exists (if anggota_id is provided)
    if (body.anggota_id) {
      const { data: member } = await getClient()
        .from('anggota')
        .select('id, status_keanggotaan')
        .eq('id', body.anggota_id)
        .single();

      if (!member) {
        return NextResponse.json(
          { error: 'Anggota tidak ditemukan' },
          { status: 404 }
        );
      }

      // Anggota yang sudah berhenti / non-aktif bukan peserta aktif —
      // tidak boleh dibuatkan pengajuan Dana Kematian baru.
      if (member.status_keanggotaan && member.status_keanggotaan !== 'aktif') {
        return NextResponse.json(
          {
            error:
              'Anggota berstatus tidak aktif (berhenti/non-aktif) dan tidak dapat diajukan Dana Kematian baru.',
            code: 'ANGGOTA_TIDAK_AKTIF',
          },
          { status: 409 }
        );
      }
    }

    // Create dana kematian
    const sessionForActor = await getServerSession(authOptions);
    const nowIso = new Date().toISOString();
    const { data: newDanaKematian, error } = await getClient()
      .from('dana_kematian')
      .insert([{
        ...body,
        kode_cabang: kodeCabangPengaju,
        cabang_asal_melapor: cabangPengaju || body.cabang_asal_melapor,
        penyebab_meninggal: body.penyebab_meninggal || null,
        tanggal_lapor_keluarga: body.tanggal_lapor_keluarga || null,
        cabang_nama_pelapor: body.cabang_nama_pelapor || null,
        cabang_nik_pelapor: body.cabang_nik_pelapor || null,
        cabang_tanggal_awal_terima_berkas: body.cabang_tanggal_awal_terima_berkas || null,
        cabang_tanggal_kirim_ke_pusat: body.cabang_tanggal_kirim_ke_pusat || null,
        pusat_tanggal_awal_terima: body.pusat_tanggal_awal_terima || null,
        pusat_tanggal_validasi: body.pusat_tanggal_validasi || null,
        pusat_tanggal_selesai: body.pusat_tanggal_selesai || null,
        cabang_tanggal_serah_ke_ahli_waris: body.cabang_tanggal_serah_ke_ahli_waris || null,
        cabang_tanggal_lapor_ke_pusat: body.cabang_tanggal_lapor_ke_pusat || null,
        file_sk_pensiun: body.file_sk_pensiun || null,
        file_surat_kematian: body.file_surat_kematian || null,
        file_surat_pernyataan_ahli_waris: body.file_surat_pernyataan_ahli_waris || null,
        file_kartu_keluarga: body.file_kartu_keluarga || null,
        file_e_ktp: body.file_e_ktp || null,
        file_surat_nikah: body.file_surat_nikah || null,
        status_proses: body.status_proses || 'draft',
        keterangan: body.keterangan || null,
        // Penugasan: pengajuan baru otomatis diklaim oleh cabang pembuatnya.
        claim_status: 'diklaim',
        cabang_pemilik_kode: kodeCabangPengaju,
        diklaim_oleh: actor.userId,
        diklaim_pada: nowIso,
        // Waktu-0: pelaporan awal (untuk pengukuran waktu proses).
        waktu_0: body.waktu_0 || nowIso,
        data_perubahan: {
          actor_id: actor.userId,
          actor_role: actor.canVerifyPP ? 'pusat' : 'cabang',
          actor_nama: sessionForActor?.user?.name || 'Sistem',
          actor_cabang: cabangPengaju || null,
          catatan: 'Pembuatan pengajuan baru'
        }
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating dana kematian:', error);
      return NextResponse.json(
        { error: 'Failed to create dana kematian', details: error.message },
        { status: 500 }
      );
    }

    // Fire notification (non-blocking)
    notifyDanaKematianCreated(
      newDanaKematian.id,
      newDanaKematian.nama_anggota,
      newDanaKematian.cabang_asal_melapor || '',
    );

    return NextResponse.json({
      data: newDanaKematian,
      message: 'Dana kematian berhasil diajukan',
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/dana-kematian:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}
