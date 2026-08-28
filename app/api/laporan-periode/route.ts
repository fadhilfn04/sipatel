import { NextRequest, NextResponse } from 'next/server';
import { supabase, CreateLaporanPeriodeInput } from '@/lib/supabase';

// GET /api/laporan-periode - List period reports with filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tipe = searchParams.get('tipe_laporan') || '';
    const status = searchParams.get('status_laporan') || '';
    const year = searchParams.get('year') || '';
    const month = searchParams.get('month') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('laporan_periode')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    // Filter by tipe laporan
    if (tipe && tipe !== 'all') {
      query = query.eq('tipe_laporan', tipe);
    }

    // Filter by status
    if (status && status !== 'all') {
      query = query.eq('status_laporan', status);
    }

    // Filter by year
    if (year) {
      query = query.gte('tanggal_mulai', `${year}-01-01`).lte('tanggal_mulai', `${year}-12-31`);
    }

    // Filter by month (if applicable)
    if (month && month !== 'all') {
      query = query.gte('tanggal_mulai', `${year || new Date().getFullYear()}-${month}-01`)
        .lte('tanggal_mulai', `${year || new Date().getFullYear()}-${month}-31`);
    }

    // Get paginated data
    const { data: laporan, error, count } = await query
      .order('tanggal_mulai', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching laporan periode:', error);
      return NextResponse.json(
        { error: 'Failed to fetch laporan periode', details: error.message },
        { status: 500 }
      );
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      data: laporan || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/laporan-periode:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}

// POST /api/laporan-periode - Create new period report
export async function POST(request: NextRequest) {
  try {
    const body: CreateLaporanPeriodeInput = await request.json();

    // Validate required fields
    const requiredFields = [
      'tipe_laporan',
      'tanggal_mulai',
      'tanggal_selesai',
      'total_pendapatan',
      'total_pengeluaran',
      'laba_bersih',
    ];

    for (const field of requiredFields) {
      if (body[field as keyof CreateLaporanPeriodeInput] === undefined) {
        return NextResponse.json(
          { error: `Field '${field}' is required` },
          { status: 400 }
        );
      }
    }

    // Calculate profit margin if not provided
    const marjinLaba = body.marjin_laba || ((body.laba_bersih / body.total_pendapatan) * 100);

    // Create laporan periode
    const { data: newLaporan, error } = await supabase
      .from('laporan_periode')
      .insert([{
        ...body,
        sumbangan_anggota: body.sumbangan_anggota || 0,
        dana_kematian: body.dana_kematian || 0,
        dana_sosial: body.dana_sosial || 0,
        pendapatan_investasi: body.pendapatan_investasi || 0,
        pendapatan_jasa: body.pendapatan_jasa || 0,
        pendapatan_lainnya: body.pendapatan_lainnya || 0,
        klaim_kematian: body.klaim_kematian || 0,
        bantuan_sosial: body.bantuan_sosial || 0,
        operasional: body.operasional || 0,
        gaji_dan_tunjangan: body.gaji_dan_tunjangan || 0,
        biaya_administrasi: body.biaya_administrasi || 0,
        biaya_pemasaran: body.biaya_pemasaran || 0,
        penyusutan: body.penyusutan || 0,
        pengeluaran_lainnya: body.pengeluaran_lainnya || 0,
        marjin_laba: marjinLaba,
        kas_masuk: body.kas_masuk || 0,
        kas_keluar: body.kas_keluar || 0,
        arus_kas_bersih: body.arus_kas_bersih || 0,
        total_aset: body.total_aset || 0,
        total_kewajiban: body.total_kewajiban || 0,
        total_ekuitas: body.total_ekuitas || 0,
        jumlah_transaksi: body.jumlah_transaksi || 0,
        jumlah_anggota: body.jumlah_anggota || 0,
        catatan: body.catatan || null,
        dibuat_olez: body.dibuat_olez || null,
        diverifikasi_oleh: body.diverifikasi_oleh || null,
        tanggal_disetujui: body.tanggal_disetujui || null,
        file_laporan: body.file_laporan || null,
        status_laporan: body.status_laporan || 'draft',
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating laporan periode:', error);
      return NextResponse.json(
        { error: 'Failed to create laporan periode', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: newLaporan,
      message: 'Laporan periode berhasil dibuat',
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/laporan-periode:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}
