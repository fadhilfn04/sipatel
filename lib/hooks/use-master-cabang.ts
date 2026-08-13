import { useQuery } from '@tanstack/react-query';
import { MasterCabang } from '@/lib/supabase';

interface MasterCabangListResponse {
  data: MasterCabang[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface ApiError {
  error: string;
  details?: string;
}

/**
 * Fetch active branch master data from /api/master-cabang.
 * Used by MemberFormModal to populate the Kode Cabang dropdown
 * and auto-fill derived branch fields.
 */
export function useMasterCabangList(params?: {
  search?: string;
  page?: number;
  limit?: number;
  include_inactive?: boolean;
}) {
  const queryParams = new URLSearchParams();
  if (params?.search) queryParams.set('search', params.search);
  if (params?.include_inactive) queryParams.set('include_inactive', 'true');
  queryParams.set('page', String(params?.page || 1));
  queryParams.set('limit', String(params?.limit || 200));

  return useQuery({
    queryKey: ['master-cabang', params],
    queryFn: async () => {
      const response = await fetch(`/api/master-cabang?${queryParams.toString()}`);
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Failed to fetch cabang data');
      }
      return response.json() as Promise<MasterCabangListResponse>;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}