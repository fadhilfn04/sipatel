import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/keuangan/laba-rugi - Get income statement data
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
      console.error('Error fetching laba rugi:', error);
      return NextResponse.json(
        { error: 'Failed to fetch laba rugi', details: error.message },
        { status: 500 }
      );
    }

    // Calculate aggregations
    const totalRevenue = laporanData?.reduce((sum, r) => sum + r.total_pendapatan, 0) || 0;
    const totalExpenses = laporanData?.reduce((sum, r) => sum + r.total_pengeluaran, 0) || 0;
    const totalProfit = laporanData?.reduce((sum, r) => sum + r.laba_bersih, 0) || 0;
    const avgProfitMargin = laporanData && laporanData.length > 0
      ? laporanData.reduce((sum, r) => sum + (r.marjin_laba || 0), 0) / laporanData.length
      : 0;

    // Revenue breakdown
    const revenueBreakdown = [
      {
        category: 'Sumbangan Anggota',
        amount: laporanData?.reduce((sum, r) => sum + r.sumbangan_anggota, 0) || 0,
        percentage: totalRevenue > 0 ? ((laporanData?.reduce((sum, r) => sum + r.sumbangan_anggota, 0) || 0) / totalRevenue) * 100 : 0,
      },
      {
        category: 'Dana Kematian',
        amount: laporanData?.reduce((sum, r) => sum + r.dana_kematian, 0) || 0,
        percentage: totalRevenue > 0 ? ((laporanData?.reduce((sum, r) => sum + r.dana_kematian, 0) || 0) / totalRevenue) * 100 : 0,
      },
      {
        category: 'Dana Sosial',
        amount: laporanData?.reduce((sum, r) => sum + r.dana_sosial, 0) || 0,
        percentage: totalRevenue > 0 ? ((laporanData?.reduce((sum, r) => sum + r.dana_sosial, 0) || 0) / totalRevenue) * 100 : 0,
      },
      {
        category: 'Pendapatan Investasi',
        amount: laporanData?.reduce((sum, r) => sum + r.pendapatan_investasi, 0) || 0,
        percentage: totalRevenue > 0 ? ((laporanData?.reduce((sum, r) => sum + r.pendapatan_investasi, 0) || 0) / totalRevenue) * 100 : 0,
      },
      {
        category: 'Pendapatan Jasa',
        amount: laporanData?.reduce((sum, r) => sum + r.pendapatan_jasa, 0) || 0,
        percentage: totalRevenue > 0 ? ((laporanData?.reduce((sum, r) => sum + r.pendapatan_jasa, 0) || 0) / totalRevenue) * 100 : 0,
      },
      {
        category: 'Pendapatan Lainnya',
        amount: laporanData?.reduce((sum, r) => sum + r.pendapatan_lainnya, 0) || 0,
        percentage: totalRevenue > 0 ? ((laporanData?.reduce((sum, r) => sum + r.pendapatan_lainnya, 0) || 0) / totalRevenue) * 100 : 0,
      },
    ];

    // Expense breakdown
    const expenseBreakdown = [
      {
        category: 'Klaim Kematian',
        amount: laporanData?.reduce((sum, r) => sum + r.klaim_kematian, 0) || 0,
        percentage: totalExpenses > 0 ? ((laporanData?.reduce((sum, r) => sum + r.klaim_kematian, 0) || 0) / totalExpenses) * 100 : 0,
      },
      {
        category: 'Bantuan Sosial',
        amount: laporanData?.reduce((sum, r) => sum + r.bantuan_sosial, 0) || 0,
        percentage: totalExpenses > 0 ? ((laporanData?.reduce((sum, r) => sum + r.bantuan_sosial, 0) || 0) / totalExpenses) * 100 : 0,
      },
      {
        category: 'Operasional',
        amount: laporanData?.reduce((sum, r) => sum + r.operasional, 0) || 0,
        percentage: totalExpenses > 0 ? ((laporanData?.reduce((sum, r) => sum + r.operasional, 0) || 0) / totalExpenses) * 100 : 0,
      },
      {
        category: 'Gaji & Tunjangan',
        amount: laporanData?.reduce((sum, r) => sum + r.gaji_dan_tunjangan, 0) || 0,
        percentage: totalExpenses > 0 ? ((laporanData?.reduce((sum, r) => sum + r.gaji_dan_tunjangan, 0) || 0) / totalExpenses) * 100 : 0,
      },
      {
        category: 'Biaya Administrasi',
        amount: laporanData?.reduce((sum, r) => sum + r.biaya_administrasi, 0) || 0,
        percentage: totalExpenses > 0 ? ((laporanData?.reduce((sum, r) => sum + r.biaya_administrasi, 0) || 0) / totalExpenses) * 100 : 0,
      },
      {
        category: 'Biaya Pemasaran',
        amount: laporanData?.reduce((sum, r) => sum + r.biaya_pemasaran, 0) || 0,
        percentage: totalExpenses > 0 ? ((laporanData?.reduce((sum, r) => sum + r.biaya_pemasaran, 0) || 0) / totalExpenses) * 100 : 0,
      },
      {
        category: 'Penyusutan',
        amount: laporanData?.reduce((sum, r) => sum + r.penyusutan, 0) || 0,
        percentage: totalExpenses > 0 ? ((laporanData?.reduce((sum, r) => sum + r.penyusutan, 0) || 0) / totalExpenses) * 100 : 0,
      },
      {
        category: 'Pengeluaran Lainnya',
        amount: laporanData?.reduce((sum, r) => sum + r.pengeluaran_lainnya, 0) || 0,
        percentage: totalExpenses > 0 ? ((laporanData?.reduce((sum, r) => sum + r.pengeluaran_lainnya, 0) || 0) / totalExpenses) * 100 : 0,
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
        totalRevenue,
        totalExpenses,
        totalProfit,
        avgProfitMargin,
        profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
      },
      revenueBreakdown,
      expenseBreakdown,
    });

  } catch (error) {
    console.error('Error in GET /api/keuangan/laba-rugi:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}
