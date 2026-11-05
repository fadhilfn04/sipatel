import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreatePengajuanMutasiCabangInput,
  MutasiCabangOption,
  PengajuanMutasiCabang,
  UpdateMutasiCabangStatusInput,
} from '@/lib/supabase';

// API response types
interface MutasiCabangListResponse {
  data: PengajuanMutasiCabang[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  can_manage?: boolean;
}

interface MutasiCabangResponse {
  data: PengajuanMutasiCabang;
  message?: string;
}

interface ApiError {
  error: string;
  details?: string;
  code?: string;
  fields?: { field: string; message: string }[];
}

// Fetch opsi cabang tujuan (master cabang + nama cabang unik dari data anggota)
export function useMutasiCabangOptions() {
  return useQuery({
    queryKey: ['mutasi-cabang', 'cabang-options'],
    queryFn: async () => {
      const response = await fetch('/api/mutasi-cabang/cabang-options');
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Gagal memuat opsi cabang');
      }
      const result: { data: MutasiCabangOption[] } = await response.json();
      return result.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Fetch daftar pengajuan mutasi cabang (anggota: milik sendiri; pengelola: semua)
export function useMutasiCabangList(params: {
  status?: string;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params.status && params.status !== 'all') {
    queryParams.set('status', params.status);
  }
  queryParams.set('page', String(params.page || 1));
  queryParams.set('limit', String(params.limit || 10));

  return useQuery({
    queryKey: ['mutasi-cabang', params],
    queryFn: async () => {
      const response = await fetch(`/api/mutasi-cabang?${queryParams.toString()}`);
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Gagal memuat pengajuan mutasi cabang');
      }
      return response.json() as Promise<MutasiCabangListResponse>;
    },
    staleTime: 1000 * 60, // 1 minute
  });
}

// Fetch detail pengajuan mutasi cabang by ID
export function useMutasiCabang(id: string) {
  return useQuery({
    queryKey: ['mutasi-cabang', 'detail', id],
    queryFn: async () => {
      const response = await fetch(`/api/mutasi-cabang/${id}`);
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Gagal memuat detail pengajuan mutasi cabang');
      }
      const result: MutasiCabangResponse = await response.json();
      return result.data;
    },
    enabled: !!id,
  });
}

// Kirim pengajuan mutasi cabang baru
export function useCreateMutasiCabang() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePengajuanMutasiCabangInput) => {
      const response = await fetch('/api/mutasi-cabang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Gagal mengirim pengajuan mutasi cabang');
      }

      return response.json() as Promise<MutasiCabangResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mutasi-cabang'] });
    },
  });
}

// Perbarui status pengajuan (batal oleh pengaju; verifikasi oleh admin/PC/PP)
export function useUpdateMutasiCabangStatus(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateMutasiCabangStatusInput) => {
      const response = await fetch(`/api/mutasi-cabang/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Gagal memperbarui status pengajuan');
      }

      return response.json() as Promise<MutasiCabangResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mutasi-cabang'] });
    },
  });
}

// Batalkan pengajuan yang masih aktif (pemilik)
export function useCancelMutasiCabang() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/mutasi-cabang/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dibatalkan' }),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Gagal membatalkan pengajuan');
      }

      return response.json() as Promise<MutasiCabangResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mutasi-cabang'] });
    },
  });
}
