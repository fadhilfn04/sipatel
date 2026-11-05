import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  AnggotaKematian,
  AnggotaKematianWithAnggota,
  CreateAnggotaKematianInput,
  UpdateAnggotaKematianInput,
} from '@/lib/supabase';

interface AnggotaKematianListResponse {
  data: AnggotaKematianWithAnggota[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

interface AnggotaKematianResponse {
  data: AnggotaKematianWithAnggota | AnggotaKematian | null;
  message?: string;
}

interface ApiError {
  error: string;
  details?: string;
  code?: string;
}

// Daftar entry kematian (filter/search server-side).
export function useAnggotaKematianList(params: { search?: string; page?: number; limit?: number }) {
  const queryParams = new URLSearchParams();
  if (params.search?.trim()) queryParams.set('search', params.search.trim());
  queryParams.set('page', String(params.page || 1));
  queryParams.set('limit', String(params.limit || 20));

  return useQuery({
    queryKey: ['anggota-kematian', params],
    queryFn: async () => {
      const response = await fetch(`/api/anggota-kematian?${queryParams.toString()}`);
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Gagal memuat data entry meninggal dunia');
      }
      return response.json() as Promise<AnggotaKematianListResponse>;
    },
    staleTime: 1000 * 60,
  });
}

// Lookup data kematian per anggota (prefill Dana Kematian).
export function useAnggotaKematianByAnggota(anggotaId: string) {
  return useQuery({
    queryKey: ['anggota-kematian', 'anggota', anggotaId],
    queryFn: async () => {
      const response = await fetch(`/api/anggota/${anggotaId}/kematian`);
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Gagal memuat data kematian anggota');
      }
      const result: { data: AnggotaKematianWithAnggota | null } = await response.json();
      return result.data;
    },
    enabled: !!anggotaId,
    staleTime: 1000 * 60,
  });
}

export function useCreateAnggotaKematian() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAnggotaKematianInput) => {
      const response = await fetch('/api/anggota-kematian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((json as ApiError).error || 'Gagal menyimpan entry meninggal dunia');
      }
      return json as AnggotaKematianResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anggota-kematian'] });
    },
  });
}

export function useUpdateAnggotaKematian(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateAnggotaKematianInput) => {
      const response = await fetch(`/api/anggota-kematian/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((json as ApiError).error || 'Gagal memperbarui entry meninggal dunia');
      }
      return json as AnggotaKematianResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anggota-kematian'] });
    },
  });
}

export function useDeleteAnggotaKematian() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/anggota-kematian/${id}`, { method: 'DELETE' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((json as ApiError).error || 'Gagal menghapus entry meninggal dunia');
      }
      return json as { message?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anggota-kematian'] });
    },
  });
}
