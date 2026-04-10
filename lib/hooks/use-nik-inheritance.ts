import { useQuery } from '@tanstack/react-query';

interface InheritanceData {
  id: string;
  nik_id: string;
  anggota_id: string;
  hubungan: string | null;
  status: string;
  tanggal_mulai: string;
  tanggal_selesai: string | null;
  is_current: boolean;
  created_at: string;
  updated_at: string;
  nik_master: {
    nik: string;
  };
}

interface InheritanceResponse {
  data: InheritanceData[];
  message?: string;
}

interface ApiError {
  error: string;
  details?: string;
}

// Fetch inheritance history for an anggota
export function useNikInheritance(anggotaId: string | undefined) {
  return useQuery({
    queryKey: ['nik-inheritance', anggotaId],
    queryFn: async () => {
      if (!anggotaId) return { data: [] };

      const response = await fetch(`/api/anggota/${anggotaId}/pewarisan`);
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Failed to fetch inheritance data');
      }
      return response.json() as Promise<InheritanceResponse>;
    },
    enabled: !!anggotaId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
