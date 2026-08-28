import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/keuangan/ringkasan - Get financial summary
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get('date_from') || new Date().toISOString().split('T')[0];
    const dateTo = searchParams.get('date_to') || new Date().toISOString().split('T')[0];

    // Get total revenue from pembayaran sumbangan
    const { data: pembayaranData } = await supabase
      .from('pembayaran_sumbangan')
      .select('jumlah_pembayaran, status_pembayaran')
      .gte('tanggal_transaksi', dateFrom)
      .lte('tanggal_transaksi', dateTo)
      .is('deleted_at', null);

    const totalPaid = pembayaranData?.filter(p => p.status_pembayaran === 'paid').reduce((sum, p) => sum + p.jumlah_pembayaran, 0) || 0;
    const totalPending = pembayaranData?.filter(p => p.status_pembayaran === 'pending').reduce((sum, p) => sum + p.jumlah_pembayaran, 0) || 0;

    // Get cash flow data
    const { data: arusKasData } = await supabase
      .from('arus_kas')
      .select('jenis_transaksi, jumlah_transaksi')
      .gte('tanggal_transaksi', dateFrom)
      .lte('tanggal_transaksi', dateTo)
      .is('deleted_at', null);

    const totalInflow = arusKasData?.filter(a => a.jenis_transaksi === 'masuk').reduce((sum, a) => sum + a.jumlah_transaksi, 0) || 0;
    const totalOutflow = arusKasData?.filter(a => a.jenis_transaksi === 'keluar').reduce((sum, a) => sum + a.jumlah_transaksi, 0) || 0;

    // Get latest balance from arus kas
    const { data: latestArusKas } = await supabase
      .from('arus_kas')
      .select('saldo_akhir')
      .order('tanggal_transaksi', { ascending: false })
      .limit(1)
      .is('deleted_at', null)
      .single();

    const cashBalance = latestArusKas?.saldo_akhir || 0;

    // Get dana kematian summary
    const { data: danaKematianData } = await supabase
      .from('dana_kematian')
      .select('besaran_dana_kematian, status_proses')
      .is('deleted_at', null);

    const totalDanaKematian = danaKematianData?.reduce((sum, d) => sum + d.besaran_dana_kematian, 0) || 0;
    const klaimPaid = danaKematianData?.filter(d => d.status_proses === 'selesai').reduce((sum, d) => sum + d.besaran_dana_kematian, 0) || 0;

    // Get dana sosial summary
    const { data: danaSosialData } = await supabase
      .from('dana_sosial')
      .select('jumlah_disetujui, status_pengajuan, status_penyaluran')
      .is('deleted_at', null);

    const totalDanaSosial = danaSosialData?.reduce((sum, d) => sum + (d.jumlah_disetujui || 0), 0) || 0;
    const bantuanGiven = danaSosialData?.filter(d => d.status_penyaluran === 'Sudah Disalurkan').reduce((sum, d) => sum + (d.jumlah_disetujui || 0), 0) || 0;

    // Get recent transactions from arus kas
    const { data: recentTransactions } = await supabase
      .from('arus_kas')
      .select('*')
      .order('tanggal_transaksi', { ascending: false })
      .limit(10)
      .is('deleted_at', null);

    const netProfit = totalInflow - totalOutflow;
    const revenueGrowth = 12.5; // Placeholder - would need historical data
    const expenseGrowth = -8.3; // Placeholder - would need historical data
    const profitGrowth = 15.2; // Placeholder - would need historical data

    return NextResponse.json({
      overview: {
        totalRevenue: totalInflow,
        totalExpenses: totalOutflow,
        netProfit,
        cashBalance,
        revenueGrowth,
        expenseGrowth,
        profitGrowth,
      },
      revenueBreakdown: [
        { category: 'Pembayaran Sumbangan', amount: totalPaid, percentage: totalInflow > 0 ? (totalPaid / totalInflow) * 100 : 0, color: 'bg-blue-500' },
        { category: 'Pendapatan Lainnya', amount: totalInflow - totalPaid, percentage: totalInflow > 0 ? ((totalInflow - totalPaid) / totalInflow) * 100 : 0, color: 'bg-green-500' },
      ],
      expenseBreakdown: [
        { category: 'Klaim Kematian', amount: klaimPaid, percentage: totalOutflow > 0 ? (klaimPaid / totalOutflow) * 100 : 0, color: 'bg-red-500' },
        { category: 'Bantuan Sosial', amount: bantuanGiven, percentage: totalOutflow > 0 ? (bantuanGiven / totalOutflow) * 100 : 0, color: 'bg-orange-500' },
        { category: 'Pengeluaran Lainnya', amount: totalOutflow - klaimPaid - bantuanGiven, percentage: totalOutflow > 0 ? ((totalOutflow - klaimPaid - bantuanGiven) / totalOutflow) * 100 : 0, color: 'bg-yellow-500' },
      ],
      recentTransactions: recentTransactions?.map(t => ({
        id: t.id,
        type: t.jenis_transaksi === 'masuk' ? 'income' : 'expense',
        description: t.deskripsi,
        amount: t.jumlah_transaksi,
        date: t.tanggal_transaksi,
        category: t.kategori_transaksi,
        reference: t.nomor_referensi,
      })) || [],
      danaKematian: {
        total: totalDanaKematian,
        klaimPaid,
        remaining: totalDanaKematian - klaimPaid,
      },
      danaSosial: {
        total: totalDanaSosial,
        bantuanGiven,
        remaining: totalDanaSosial - bantuanGiven,
      },
    });

  } catch (error) {
    console.error('Error in GET /api/keuangan/ringkasan:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}
