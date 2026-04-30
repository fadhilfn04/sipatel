import { useQuery } from '@tanstack/react-query';

interface HistoryUser {
  id: string;
  email: string;
  full_name: string;
}

interface AnggotaHistoryRecord {
  id: string;
  anggota_id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  changed_by: string;
  changed_data: any;
  previous_data: any;
  changed_fields: string[];
  created_at: string;
  changed_by_user: HistoryUser | null;
}

interface AnggotaHistoryResponse {
  data: AnggotaHistoryRecord[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

interface ApiError {
  error: string;
  details?: string;
}

export function useAnggotaHistory(anggotaId: string, limit?: number, offset?: number) {
  return useQuery({
    queryKey: ['anggota-history', anggotaId, limit, offset],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (limit) queryParams.set('limit', String(limit));
      if (offset) queryParams.set('offset', String(offset));

      const response = await fetch(`/api/anggota/${anggotaId}/history?${queryParams.toString()}`);
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Failed to fetch history');
      }
      return response.json() as Promise<AnggotaHistoryResponse>;
    },
    enabled: !!anggotaId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}