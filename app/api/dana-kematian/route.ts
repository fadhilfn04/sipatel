import { NextRequest, NextResponse } from 'next/server';
import { supabase, CreateDanaKematianInput, DanaKematianFilter } from '@/lib/supabase';

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

    let query = supabase
      .from('dana_kematian')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    // Search
    if (search) {
      query = query.or(
        `nama_anggota.ilike.%${search}%,nama_ahli_waris.ilike.%${search}%,cabang_asal_melapor.ilike.%${search}%`
      );
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
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/dana-kematian - Create new death benefit claim
export async function POST(request: NextRequest) {
  try {
    const body: CreateDanaKematianInput = await request.json();

    // Validate required fields
    const requiredFields = [
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

    // Check if member exists (if anggota_id is provided)
    if (body.anggota_id) {
      const { data: member } = await supabase
        .from('anggota')
        .select('id')
        .eq('id', body.anggota_id)
        .single();

      if (!member) {
        return NextResponse.json(
          { error: 'Anggota not found' },
          { status: 404 }
        );
      }
    }

    // Create dana kematian
    const { data: newDanaKematian, error } = await supabase
      .from('dana_kematian')
      .insert([{
        ...body,
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
        status_proses: body.status_proses || 'verifikasi_cabang', // Default: verifikasi cabang
        keterangan: body.keterangan || null,
        data_perubahan: {
          actor_id: null,
          actor_role: 'cabang',
          actor_nama: 'System',
          catatan: 'Pembuatan baru'
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

    return NextResponse.json({
      data: newDanaKematian,
      message: 'Dana kematian berhasil diajukan',
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/dana-kematian:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
