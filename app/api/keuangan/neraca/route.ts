import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/keuangan/neraca - Get balance sheet data
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get('date_from') || new Date().toISOString().split('T')[0];
    const dateTo = searchParams.get('date_to') || new Date().toISOString().split('T')[0];
    const tipeLaporan = searchParams.get('tipe_laporan') || 'bulanan';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Fetch laporan periode data filtered by date range and type
    let query = supabase
      .from('laporan_periode')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .gte('tanggal_mulai', dateFrom)
      .lte('tanggal_selesai', dateTo);

    // Filter by report type if specified
    if (tipeLaporan !== 'all') {
      query = query.eq('tipe_laporan', tipeLaporan);
    }

    const { data: laporanData, error, count } = await query
      .order('tanggal_mulai', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching neraca:', error);
      return NextResponse.json(
        { error: 'Failed to fetch neraca', details: error.message },
        { status: 500 }
      );
    }

    // Calculate aggregations
    const totalAssets = laporanData?.reduce((sum, r) => sum + (r.total_aset || 0), 0) || 0;
    const totalLiabilities = laporanData?.reduce((sum, r) => sum + (r.total_kewajiban || 0), 0) || 0;
    const totalEquity = laporanData?.reduce((sum, r) => sum + (r.total_ekuitas || 0), 0) || 0;

    // Get latest balance sheet data
    const latestReport = laporanData && laporanData.length > 0 ? laporanData[0] : null;

    // Asset breakdown
    const assetBreakdown = [
      {
        category: 'Kas & Bank',
        amount: latestReport?.kas_masuk || 0,
        percentage: totalAssets > 0 ? ((latestReport?.kas_masuk || 0) / totalAssets) * 100 : 0,
      },
      {
        category: 'Piutang',
        amount: 0, // Would need to be calculated from arus_kas
        percentage: 0,
      },
      {
        category: 'Properti',
        amount: latestReport?.total_aset || 0,
        percentage: totalAssets > 0 ? ((latestReport?.total_aset || 0) / totalAssets) * 100 : 0,
      },
    ];

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      data: laporanData || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages,
      },
      summary: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        debtToAssetRatio: totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0,
        debtToEquityRatio: totalEquity > 0 ? (totalLiabilities / totalEquity) * 100 : 0,
      },
      assetBreakdown,
      latestBalance: latestReport ? {
        totalAset: latestReport.total_aset,
        totalKewajiban: latestReport.total_kewajiban,
        totalEkuitas: latestReport.total_ekuitas,
      } : null,
    });

  } catch (error) {
    console.error('Error in GET /api/keuangan/neraca:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}
