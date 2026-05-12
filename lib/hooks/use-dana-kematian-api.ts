import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DanaKematian, CreateDanaKematianInput, UpdateDanaKematianInput } from '@/lib/supabase';

// API response types
interface DanaKematianListResponse {
  data: DanaKematian[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface DanaKematianResponse {
  data: DanaKematian;
  message?: string;
}

interface ApiError {
  error: string;
  details?: string;
}

// Fetch all death benefits with filters
export function useDanaKematianList(params: {
  search?: string;
  status_proses?: string;
  tanggal_meninggal_from?: string;
  tanggal_meninggal_to?: string;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params.search) queryParams.set('search', params.search);
  if (params.status_proses && params.status_proses !== 'all') {
    queryParams.set('status_proses', params.status_proses);
  }
  if (params.tanggal_meninggal_from) {
    queryParams.set('tanggal_meninggal_from', params.tanggal_meninggal_from);
  }
  if (params.tanggal_meninggal_to) {
    queryParams.set('tanggal_meninggal_to', params.tanggal_meninggal_to);
  }
  queryParams.set('page', String(params.page || 1));
  queryParams.set('limit', String(params.limit || 10));

  return useQuery({
    queryKey: ['danaKematian', params],
    queryFn: async () => {
      const response = await fetch(`/api/dana-kematian?${queryParams.toString()}`);
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Failed to fetch dana kematian');
      }
      return response.json() as Promise<DanaKematianListResponse>;
    },
    staleTime: 0,
  });
}

// Fetch single death benefit by ID
export function useDanaKematian(id: string) {
  return useQuery({
    queryKey: ['danaKematian', id],
    queryFn: async () => {
      const response = await fetch(`/api/dana-kematian/${id}`);
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Failed to fetch dana kematian');
      }
      const result: DanaKematianResponse = await response.json();
      return result.data;
    },
    enabled: !!id,
  });
}

// Create new death benefit claim
export function useCreateDanaKematian() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateDanaKematianInput) => {
      const response = await fetch('/api/dana-kematian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Failed to create dana kematian');
      }

      return response.json() as Promise<DanaKematianResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['danaKematian'] });
    },
  });
}

// Update death benefit claim
export function useUpdateDanaKematian(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateDanaKematianInput) => {
      const response = await fetch(`/api/dana-kematian/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Failed to update dana kematian');
      }

      return response.json() as Promise<DanaKematianResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['danaKematian'] });
      queryClient.invalidateQueries({ queryKey: ['danaKematian', id] });
    },
  });
}

// Delete death benefit claim
export function useDeleteDanaKematian() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/dana-kematian/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Failed to delete dana kematian');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['danaKematian'] });
    },
  });
}