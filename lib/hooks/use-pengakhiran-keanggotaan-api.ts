import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreatePengakhiranKeanggotaanInput,
  PengakhiranKeanggotaanWithAnggota,
  UpdatePengakhiranKeanggotaanStatusInput,
} from '@/lib/supabase';

interface PengakhiranListResponse {
  data: PengakhiranKeanggotaanWithAnggota[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

interface PengakhiranResponse {
  data: PengakhiranKeanggotaanWithAnggota;
  message?: string;
}

interface ApiError {
  error: string;
  details?: string;
  code?: string;
}

// Daftar pengajuan pengakhiran (filter/search server-side).
export function usePengakhiranKeanggotaanList(params: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params.status && params.status !== 'all') queryParams.set('status', params.status);
  if (params.search?.trim()) queryParams.set('search', params.search.trim());
  queryParams.set('page', String(params.page || 1));
  queryParams.set('limit', String(params.limit || 20));

  return useQuery({
    queryKey: ['pengakhiran-keanggotaan', params],
    queryFn: async () => {
      const response = await fetch(`/api/pengakhiran-keanggotaan?${queryParams.toString()}`);
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Gagal memuat data pengakhiran keanggotaan');
      }
      return response.json() as Promise<PengakhiranListResponse>;
    },
    staleTime: 1000 * 60,
  });
}

// Lookup pengakhiran per anggota (guard/prefill modul lain).
export function usePengakhiranByAnggota(anggotaId: string) {
  return useQuery({
    queryKey: ['pengakhiran-keanggotaan', 'anggota', anggotaId],
    queryFn: async () => {
      const response = await fetch(`/api/anggota/${anggotaId}/pengakhiran`);
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Gagal memuat data pengakhiran anggota');
      }
      const result: { data: PengakhiranKeanggotaanWithAnggota | null } = await response.json();
      return result.data;
    },
    enabled: !!anggotaId,
    staleTime: 1000 * 60,
  });
}

// Kirim pengajuan pengakhiran keanggotaan baru.
export function useCreatePengakhiranKeanggotaan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePengakhiranKeanggotaanInput) => {
      const response = await fetch('/api/pengakhiran-keanggotaan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Gagal mengirim pengajuan pengakhiran keanggotaan');
      }

      return response.json() as Promise<PengakhiranResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pengakhiran-keanggotaan'] });
    },
  });
}

// Perbarui status pengajuan (verifikasi PC / keputusan PP / batal).
// Dipakai per-baris: { id, status, catatan? }.
export function useUpdatePengakhiranKeanggotaanStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      id: string;
    } & UpdatePengakhiranKeanggotaanStatusInput) => {
      const { id, ...data } = vars;
      const response = await fetch(`/api/pengakhiran-keanggotaan/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Gagal memperbarui status pengajuan');
      }

      return response.json() as Promise<PengakhiranResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pengakhiran-keanggotaan'] });
      queryClient.invalidateQueries({ queryKey: ['anggota'] });
    },
  });
}

// Batalkan pengajuan yang masih aktif.
export function useCancelPengakhiranKeanggotaan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/pengakhiran-keanggotaan/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dibatalkan' }),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Gagal membatalkan pengajuan');
      }

      return response.json() as Promise<PengakhiranResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pengakhiran-keanggotaan'] });
    },
  });
}
