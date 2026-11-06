import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateKepengurusanInput,
  AnggotaKepengurusanWithAnggota,
  UpdateKepengurusanStatusInput,
} from '@/lib/supabase';

interface KepengurusanListResponse {
  data: AnggotaKepengurusanWithAnggota[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

interface KepengurusanResponse {
  data: AnggotaKepengurusanWithAnggota | AnggotaKepengurusanWithAnggota[] | null;
  message?: string;
  status?: string;
}

interface ApiError {
  error: string;
  details?: string;
  code?: string;
}

// Daftar pengajuan/riwayat perubahan kepengurusan (filter/search server-side).
export function useKepengurusanList(params: {
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
    queryKey: ['anggota-kepengurusan', params],
    queryFn: async () => {
      const response = await fetch(`/api/anggota-kepengurusan?${queryParams.toString()}`);
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Gagal memuat data perubahan kepengurusan');
      }
      return response.json() as Promise<KepengurusanListResponse>;
    },
    staleTime: 1000 * 30,
  });
}

// Riwayat kepengurusan per anggota (panel riwayat halaman Perubahan Kepengurusan).
export function useKepengurusanByAnggota(anggotaId: string) {
  return useQuery({
    queryKey: ['anggota-kepengurusan', 'anggota', anggotaId],
    queryFn: async () => {
      const response = await fetch(`/api/anggota/${anggotaId}/kepengurusan`);
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Gagal memuat riwayat kepengurusan anggota');
      }
      const result: { data: AnggotaKepengurusanWithAnggota[] } = await response.json();
      return result.data;
    },
    enabled: !!anggotaId,
    staleTime: 1000 * 30,
  });
}

// Kirim pengajuan perubahan kepengurusan baru.
export function useCreateKepengurusan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateKepengurusanInput) => {
      const response = await fetch('/api/anggota-kepengurusan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Gagal mengirim pengajuan perubahan kepengurusan');
      }

      return response.json() as Promise<KepengurusanResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anggota-kepengurusan'] });
      queryClient.invalidateQueries({ queryKey: ['anggota'] });
    },
  });
}

// Perbarui status pengajuan (verifikasi PC / keputusan PP / batal).
// Dipakai per-baris: { id, status, catatan? }.
export function useUpdateKepengurusanStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      id: string;
    } & UpdateKepengurusanStatusInput) => {
      const { id, ...data } = vars;
      const response = await fetch(`/api/anggota-kepengurusan/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Gagal memperbarui status pengajuan');
      }

      return response.json() as Promise<KepengurusanResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anggota-kepengurusan'] });
      queryClient.invalidateQueries({ queryKey: ['anggota'] });
    },
  });
}
