import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  return supabaseAdmin;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'month';

    const now = new Date();
    const from = new Date();

    switch (period) {
      case 'today':
        from.setHours(0, 0, 0, 0);
        break;
      case 'week':
        from.setDate(now.getDate() - 7);
        break;
      case 'month':
        from.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        from.setFullYear(now.getFullYear() - 1);
        break;
    }

    const client = getClient();

    const [anggotaResult, danaKematianAllResult, danaKematianPeriodResult, danaSosialResult] =
      await Promise.all([
        client.from('anggota').select('status_anggota').is('deleted_at', null),

        client.from('dana_kematian')
          .select('besaran_dana_kematian, status_proses, created_at')
          .is('deleted_at', null),

        client.from('dana_kematian')
          .select('besaran_dana_kematian, status_proses')
          .is('deleted_at', null)
          .gte('created_at', from.toISOString())
          .lte('created_at', now.toISOString()),

        client.from('dana_sosial')
          .select('jumlah_diajukan, jumlah_disetujui, status_pengajuan, status_penyaluran')
          .is('deleted_at', null),
      ]);

    // Anggota stats
    const anggotaData = anggotaResult.data || [];
    const totalAnggota = anggotaData.length;
    const anggotaAktif = anggotaData.filter(
      (a) => a.status_anggota !== 'meninggal' && a.status_anggota !== 'non-aktif',
    ).length;

    // Dana kematian all-time
    const dkAll = danaKematianAllResult.data || [];
    const klaimByStatus: Record<string, number> = {};
    let totalNilaiKlaim = 0;
    let nilaiSelesai = 0;

    dkAll.forEach((row) => {
      const s = row.status_proses || 'unknown';
      klaimByStatus[s] = (klaimByStatus[s] || 0) + 1;
      totalNilaiKlaim += row.besaran_dana_kematian || 0;
      if (s === 'selesai') nilaiSelesai += row.besaran_dana_kematian || 0;
    });

    const totalKlaim = dkAll.length;
    const klaimSelesai = klaimByStatus['selesai'] || 0;
    const klaimDitolak = klaimByStatus['ditolak'] || 0;
    const klaimAktif = totalKlaim - klaimSelesai - klaimDitolak;

    // Dana kematian in period
    const dkPeriod = danaKematianPeriodResult.data || [];
    const klaimPeriod = dkPeriod.length;
    const nilaiPeriod = dkPeriod.reduce((s, r) => s + (r.besaran_dana_kematian || 0), 0);
    const selesaiPeriod = dkPeriod.filter((r) => r.status_proses === 'selesai').length;

    // Dana sosial
    const dsData = danaSosialResult.data || [];
    const totalDanaSosial = dsData.reduce((s, r) => s + (r.jumlah_diajukan || 0), 0);
    const bantuanDisalurkan = dsData
      .filter((r) => r.status_penyaluran === 'Sudah Disalurkan' || r.status_pengajuan === 'Selesai')
      .reduce((s, r) => s + (r.jumlah_disetujui || 0), 0);

    // Try arus_kas (may not exist — fail gracefully)
    let kasMasuk = 0;
    let kasKeluar = 0;
    let cashBalance = 0;
    try {
      const arusKasResult = await client
        .from('arus_kas')
        .select('jenis_transaksi, jumlah_transaksi, saldo_akhir, tanggal_transaksi')
        .is('deleted_at', null)
        .gte('tanggal_transaksi', from.toISOString().split('T')[0])
        .lte('tanggal_transaksi', now.toISOString().split('T')[0]);

      if (!arusKasResult.error && arusKasResult.data?.length) {
        kasMasuk = arusKasResult.data
          .filter((r) => r.jenis_transaksi === 'masuk')
          .reduce((s, r) => s + (r.jumlah_transaksi || 0), 0);
        kasKeluar = arusKasResult.data
          .filter((r) => r.jenis_transaksi === 'keluar')
          .reduce((s, r) => s + (r.jumlah_transaksi || 0), 0);
        const sorted = arusKasResult.data.sort((a, b) =>
          new Date(b.tanggal_transaksi).getTime() - new Date(a.tanggal_transaksi).getTime(),
        );
        cashBalance = sorted[0]?.saldo_akhir || 0;
      }
    } catch {
      // table doesn't exist — keep defaults as 0
    }

    return NextResponse.json({
      overview: {
        totalAnggota,
        anggotaAktif,
        totalKlaim,
        klaimAktif,
        klaimSelesai,
        klaimDitolak,
        totalNilaiKlaim,
        nilaiSelesai,
        klaimPeriod,
        nilaiPeriod,
        selesaiPeriod,
        kasMasuk,
        kasKeluar,
        cashBalance,
        totalDanaSosial,
        bantuanDisalurkan,
        // legacy fields
        totalAset: cashBalance,
        totalDana: totalNilaiKlaim + totalDanaSosial,
        totalReports: 0,
        pendingReports: 0,
      },
      klaimByStatus,
      danaKematian: {
        totalDana: totalNilaiKlaim,
        klaimDibayar: nilaiSelesai,
        sisaDana: totalNilaiKlaim - nilaiSelesai,
      },
      danaSosial: {
        totalDana: totalDanaSosial,
        bantuanDiberikan: bantuanDisalurkan,
        sisaDana: totalDanaSosial - bantuanDisalurkan,
      },
      // Legacy shape kept for backward compat with existing sub-pages
      ringkasanKeuangan: {
        totalPemasukan: kasMasuk,
        totalPengeluaran: kasKeluar,
        saldo: kasMasuk - kasKeluar,
      },
      arusKas: {
        kasMasuk,
        kasKeluar,
        netCashFlow: kasMasuk - kasKeluar,
      },
      labaRugi: {
        pendapatan: kasMasuk,
        beban: kasKeluar,
        labaBersih: kasMasuk - kasKeluar,
      },
      neraca: {
        totalAset: cashBalance + totalNilaiKlaim,
        totalKewajiban: nilaiSelesai,
        totalEkuitas: cashBalance + totalNilaiKlaim - nilaiSelesai,
      },
      pembayaranSumbangan: {
        totalTerbayar: 0,
        totalTertunda: 0,
        jumlahTransaksi: 0,
      },
      laporanPeriode: {
        totalReports: 0,
        pendingReports: 0,
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/keuangan/dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
