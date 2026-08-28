import { NextRequest, NextResponse } from 'next/server';
import { supabase, CreateArusKasInput } from '@/lib/supabase';

// GET /api/arus-kas - List cash flow transactions with filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const jenis = searchParams.get('jenis_transaksi') || '';
    const kategori = searchParams.get('kategori_transaksi') || '';
    const dateFrom = searchParams.get('tanggal_transaksi_from') || '';
    const dateTo = searchParams.get('tanggal_transaksi_to') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('arus_kas')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    // Search
    if (search) {
      query = query.or(
        `deskripsi.ilike.%${search}%,nomor_referensi.ilike.%${search}%`
      );
    }

    // Filter by jenis transaksi
    if (jenis && jenis !== 'all') {
      query = query.eq('jenis_transaksi', jenis);
    }

    // Filter by kategori
    if (kategori && kategori !== 'all') {
      query = query.eq('kategori_transaksi', kategori);
    }

    // Filter by date range
    if (dateFrom) {
      query = query.gte('tanggal_transaksi', dateFrom);
    }
    if (dateTo) {
      query = query.lte('tanggal_transaksi', dateTo);
    }

    // Get paginated data
    const { data: arusKas, error, count } = await query
      .order('tanggal_transaksi', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching arus kas:', error);
      return NextResponse.json(
        { error: 'Failed to fetch arus kas', details: error.message },
        { status: 500 }
      );
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      data: arusKas || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/arus-kas:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}

// POST /api/arus-kas - Create new cash flow transaction
export async function POST(request: NextRequest) {
  try {
    const body: CreateArusKasInput = await request.json();

    // Validate required fields
    const requiredFields = [
      'tanggal_transaksi',
      'jenis_transaksi',
      'kategori_transaksi',
      'jumlah_transaksi',
      'deskripsi',
    ];

    for (const field of requiredFields) {
      if (!body[field as keyof CreateArusKasInput]) {
        return NextResponse.json(
          { error: `Field '${field}' is required` },
          { status: 400 }
        );
      }
    }

    // Generate reference number if not provided
    const nomorReferensi = body.nomor_referensi || `AK-${Date.now()}`;

    // Create arus kas
    const { data: newArusKas, error } = await supabase
      .from('arus_kas')
      .insert([{
        ...body,
        nomor_referensi: nomorReferensi,
        anggota_id: body.anggota_id || null,
        dana_kematian_id: body.dana_kematian_id || null,
        dana_sosial_id: body.dana_sosial_id || null,
        pembayaran_sumbangan_id: body.pembayaran_sumbangan_id || null,
        saldo_awal: body.saldo_awal || null,
        saldo_akhir: body.saldo_akhir || null,
        metode_pembayaran: body.metode_pembayaran || null,
        akun_bank: body.akun_bank || null,
        bukti_transaksi: body.bukti_transaksi || null,
        catatan: body.catatan || null,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating arus kas:', error);
      return NextResponse.json(
        { error: 'Failed to create arus kas', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: newArusKas,
      message: 'Transaksi arus kas berhasil ditambahkan',
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/arus-kas:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}
