import { useQuery } from '@tanstack/react-query';

export interface DashboardStats {
  totalAnggota: number;
  anggotaAktif: number;
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
  // legacy
  klaimPending?: number;
}

export interface LatestData {
  anggota: any[];
  klaim: any[];
  sosial: any[];
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/stats');
      if (!response.ok) {
        const error = await response.json();
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
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch latest data');
      }
      return response.json() as Promise<LatestData>;
    },
    refetchInterval: 60000,
  });
}
