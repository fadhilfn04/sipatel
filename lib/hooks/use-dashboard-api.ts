import { useQuery } from '@tanstack/react-query';

export interface DashboardStats {
  totalAnggota: number;
  anggotaAktif: number;
  anggotaNonAktif?: number;
  anggotaBerhenti?: number;
  anggotaMeninggal: number;
  totalKlaim: number;
  klaimAktif: number;
  klaimSelesai: number;
  klaimDitolak: number;
  klaimByStatus: Record<string, number>;
  totalDicairkan: number;
  totalDanaSosial: number;
  danaSosialPending: number;
  totalDanaSosialDicairkan: number;
  scope?: { cabang: string | null; isScoped: boolean };
  // legacy
  klaimPending?: number;
}

export interface LatestData {
  anggota: unknown[];
  klaim: unknown[];
  sosial: unknown[];
}

// ── Dashboard Overview (endpoint agregat) ─────────────────────────
export type DashboardPeriod = '7d' | '30d' | '3m' | '6m' | '1y';

export const DASHBOARD_PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: '7d', label: '7 Hari' },
  { value: '30d', label: '30 Hari' },
  { value: '3m', label: '3 Bulan' },
  { value: '6m', label: '6 Bulan' },
  { value: '1y', label: '1 Tahun' },
];

export interface DashboardKeanggotaanSummary {
  totalAnggota: number;
  anggotaAktif: number;
  anggotaNonAktif: number;
  anggotaBerhenti: number;
  anggotaMeninggal: number;
  pengurusAktif: number;
}

export interface DashboardActivity {
  id: string;
  occurred_at: string;
  module: string;
  table_name: string;
  entity_id: string | null;
  anggota_id: string | null;
  action: string;
  actor_name: string | null;
  actor_role_slug: string | null;
  anggota?: {
    id: string;
    nik: string | null;
    nama_anggota: string | null;
    nama_cabang: string | null;
  } | null;
}

export interface DashboardOverviewResponse {
  period: { key: string; from: string; to: string };
  scope: { cabang: string | null; isScoped: boolean };
  permissions: {
    keanggotaan: boolean;
    mutasi: boolean;
    pengakhiran: boolean;
    kepengurusan: boolean;
    danaKematian: boolean;
    keuangan: boolean;
    activity: boolean;
  };
  summary: {
    keanggotaan: DashboardKeanggotaanSummary | null;
    pendaftaranBaru: number | null;
    mutasiPending: number | null;
    dakemPending: number | null;
    totalDicairkan: number | null;
    iuran: { iuran: number; tidakIuran: number } | null;
    sumbangan: { totalPeriode: number; pendingVerifikasi: number } | null;
    dakemKpi: {
      rataRataDurasiHari: number | null;
      tertuaMenungguHari: number | null;
    } | null;
  };
  /** Perbandingan periode berjalan vs periode sebelumnya (panjang sama). */
  trends: {
    pendaftaranBaru: { current: number; previous: number } | null;
  } | null;
  charts: {
    pertumbuhanAnggota: { label: string; jumlah: number }[];
    distribusiStatus: { status: string; jumlah: number }[];
    anggotaPerCabang: { cabang: string; jumlah: number }[];
    dakemPerStatus: { status: string; jumlah: number }[];
    mutasiPerBulan: {
      label: string;
      menunggu: number;
      diverifikasi: number;
      selesai: number;
      ditolak: number;
    }[];
    pengurusPerJabatan: { jabatan: string; jumlah: number }[];
    usia: { label: string; jumlah: number }[];
    kategori: { status: string; jumlah: number }[];
    peranKeluarga: { status: string; jumlah: number }[];
    regional: { regional: string; jumlah: number }[];
    sumbanganPerBulan: { label: string; terbayar: number; pending: number }[];
    arusKasPerBulan: { label: string; masuk: number; keluar: number }[];
  };
  monitoring: {
    mutasi: Record<string, number> | null;
    pengakhiran: Record<string, number> | null;
    kepengurusan: Record<string, number> | null;
    danaKematian: Record<string, number> | null;
  };
  activity: DashboardActivity[];
  auditEnabled: boolean;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/stats');
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to fetch dashboard stats');
      }
      return response.json() as Promise<DashboardStats>;
    },
    refetchInterval: 60000,
  });
}

export function useLatestData(type: 'anggota' | 'klaim' | 'sosial' | 'both' = 'both', limit: number = 5) {
  return useQuery({
    queryKey: ['latest-data', type, limit],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/latest?type=${type}&limit=${limit}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to fetch latest data');
      }
      return response.json() as Promise<LatestData>;
    },
    refetchInterval: 60000,
  });
}

/**
 * Data dashboard teragregasi (summary + chart + monitoring + aktivitas).
 * Satu request untuk seluruh halaman — filter periode memengaruhi deret waktu
 * & counters periode secara konsisten di backend.
 */
export function useDashboardOverview(period: DashboardPeriod = '30d') {
  return useQuery({
    queryKey: ['dashboard-overview', period],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/overview?period=${period}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to fetch dashboard overview');
      }
      return response.json() as Promise<DashboardOverviewResponse>;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

