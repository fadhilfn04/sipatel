import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Anggota, CreateAnggotaInput, UpdateAnggotaInput } from '@/lib/supabase';

// API response types
interface AnggotaListResponse {
  data: Anggota[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface AnggotaResponse {
  data: Anggota;
  message?: string;
}

interface ApiError {
  error: string;
  details?: string;
}

// Fetch all anggota with filters
export function useAnggotaList(params: {
  search?: string;
  kategori_anggota?: string;
  status_anggota?: string;
  status_mps?: string;
  status_iuran?: string;
  nama_cabang?: string;
  page?: number;
  limit?: number;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
}) {
  const queryParams = new URLSearchParams();
  if (params.search) queryParams.set('search', params.search);
  if (params.kategori_anggota && params.kategori_anggota !== 'all') {
    queryParams.set('kategori_anggota', params.kategori_anggota);
  }
  if (params.status_anggota && params.status_anggota !== 'all') {
    queryParams.set('status_anggota', params.status_anggota);
  }
  if (params.status_mps && params.status_mps !== 'all') {
    queryParams.set('status_mps', params.status_mps);
  }
  if (params.status_iuran && params.status_iuran !== 'all') {
    queryParams.set('status_iuran', params.status_iuran);
  }
  if (params.nama_cabang && params.nama_cabang !== 'all') {
    queryParams.set('nama_cabang', params.nama_cabang);
  }
  queryParams.set('page', String(params.page || 1));
  queryParams.set('limit', String(params.limit || 10));
  if (params.sortColumn) {
    queryParams.set('sortColumn', params.sortColumn);
  }
  if (params.sortDirection) {
    queryParams.set('sortDirection', params.sortDirection);
  }

  return useQuery({
    queryKey: ['anggota', params],
    queryFn: async () => {
      const response = await fetch(`/api/anggota?${queryParams.toString()}`);
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Failed to fetch anggota');
      }
      return response.json() as Promise<AnggotaListResponse>;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Fetch single anggota by ID
export function useAnggota(id: string) {
  return useQuery({
    queryKey: ['anggota', id],
    queryFn: async () => {
      const response = await fetch(`/api/anggota/${id}`);
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Failed to fetch anggota');
      }
      const result: AnggotaResponse = await response.json();
      return result.data;
    },
    enabled: !!id,
  });
}

// Create new anggota
export function useCreateAnggota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAnggotaInput) => {
      const response = await fetch('/api/anggota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Failed to create anggota');
      }

      return response.json() as Promise<AnggotaResponse>;
    },
    onSuccess: () => {
      // Invalidate and refetch anggota list
      queryClient.invalidateQueries({ queryKey: ['anggota'] });
    },
  });
}

// Update anggota
export function useUpdateAnggota(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateAnggotaInput) => {
      const response = await fetch(`/api/anggota/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Failed to update anggota');
      }

      return response.json() as Promise<AnggotaResponse>;
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['anggota'] });
      queryClient.invalidateQueries({ queryKey: ['anggota', id] });
    },
  });
}

// Delete anggota
export function useDeleteAnggota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/anggota/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Failed to delete anggota');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch anggota list
      queryClient.invalidateQueries({ queryKey: ['anggota'] });
    },
  });
}