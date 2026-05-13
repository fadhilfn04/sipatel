import { useQuery } from '@tanstack/react-query';

export interface DashboardKeuanganOverview {
  totalAnggota: number;
  anggotaAktif: number;
  totalKlaim: number;
  klaimAktif: number;
  klaimSelesai: number;
  klaimDitolak: number;
  totalNilaiKlaim: number;
  nilaiSelesai: number;
  klaimPeriod: number;
  nilaiPeriod: number;
  selesaiPeriod: number;
  kasMasuk: number;
  kasKeluar: number;
  cashBalance: number;
  totalDanaSosial: number;
  bantuanDisalurkan: number;
  // legacy
  totalAset: number;
  totalDana: number;
  totalReports: number;
  pendingReports: number;
}

export interface DashboardKeuanganResponse {
  overview: DashboardKeuanganOverview;
  klaimByStatus: Record<string, number>;
  danaKematian: { totalDana: number; klaimDibayar: number; sisaDana: number };
  danaSosial: { totalDana: number; bantuanDiberikan: number; sisaDana: number };
  ringkasanKeuangan: { totalPemasukan: number; totalPengeluaran: number; saldo: number };
  arusKas: { kasMasuk: number; kasKeluar: number; netCashFlow: number };
  labaRugi: { pendapatan: number; beban: number; labaBersih: number };
  neraca: { totalAset: number; totalKewajiban: number; totalEkuitas: number };
  pembayaranSumbangan: { totalTerbayar: number; totalTertunda: number; jumlahTransaksi: number };
  laporanPeriode: { totalReports: number; pendingReports: number };
}

export function useDashboardKeuangan(params?: { period?: string }) {
  const queryParams = new URLSearchParams();
  if (params?.period) queryParams.set('period', params.period);

  return useQuery({
    queryKey: ['dashboardKeuangan', params],
    queryFn: async () => {
      const url = `/api/keuangan/dashboard${queryParams.toString() ? `?${queryParams}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch dashboard data');
      }
      return res.json() as Promise<DashboardKeuanganResponse>;
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  });
}
