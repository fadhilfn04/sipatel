import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NikMaster, NikKepemilikan, CreateNikKepemilikanInput } from '@/lib/supabase';

// API response types
interface NikMasterListResponse {
  data: NikMaster[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface NikKepemilikanListResponse {
  data: NikKepemilikan[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface NikMasterResponse {
  data: NikMaster;
  message?: string;
}

interface ApiError {
  error: string;
  details?: string;
}

// Fetch all NIK master records
export function useNikMasterList(params?: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.search) queryParams.set('search', params.search);
  queryParams.set('page', String(params?.page || 1));
  queryParams.set('limit', String(params?.limit || 10));

  return useQuery({
    queryKey: ['nik-master', params],
    queryFn: async () => {
      const response = await fetch(`/api/nik-master?${queryParams.toString()}`);
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Failed to fetch NIK master');
      }
      return response.json() as Promise<NikMasterListResponse>;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Fetch single NIK master by ID
export function useNikMaster(id: string | undefined) {
  return useQuery({
    queryKey: ['nik-master', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await fetch(`/api/nik-master/${id}`);
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Failed to fetch NIK master');
      }
      const result: NikMasterResponse = await response.json();
      return result.data;
    },
    enabled: !!id,
  });
}

// Create new NIK master
export function useCreateNikMaster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { nik: string }) => {
      const response = await fetch('/api/nik-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Failed to create NIK master');
      }

      return response.json() as Promise<NikMasterResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nik-master'] });
    },
  });
}

// Fetch all NIK kepemilikan records
export function useNikKepemilikanList(params?: {
  nik_id?: string;
  anggota_id?: string;
  is_current?: boolean;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.nik_id) queryParams.set('nik_id', params.nik_id);
  if (params?.anggota_id) queryParams.set('anggota_id', params.anggota_id);
  if (params?.is_current !== undefined) queryParams.set('is_current', String(params.is_current));
  queryParams.set('page', String(params?.page || 1));
  queryParams.set('limit', String(params?.limit || 10));

  return useQuery({
    queryKey: ['nik-kepemilikan', params],
    queryFn: async () => {
      const response = await fetch(`/api/nik-kepemilikan?${queryParams.toString()}`);
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Failed to fetch NIK kepemilikan');
      }
      return response.json() as Promise<NikKepemilikanListResponse>;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Create new NIK kepemilikan
export function useCreateNikKepemilikan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateNikKepemilikanInput) => {
      const response = await fetch('/api/nik-kepemilikan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Failed to create NIK kepemilikan');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nik-kepemilikan'] });
      queryClient.invalidateQueries({ queryKey: ['nik-inheritance'] });
    },
  });
}
