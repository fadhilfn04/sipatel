import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Anggota, CreateAnggotaInput, UpdateAnggotaInput } from '@/lib/supabase';

// API response types
interface AnggotaMeResponse {
  data: Anggota | null;
}

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

// Direct fetch function (not a hook) for export functionality
export async function fetchAnggotaList(params: {
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
}): Promise<AnggotaListResponse> {
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

  const response = await fetch(`/api/anggota?${queryParams.toString()}`);
  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.error || 'Failed to fetch anggota');
  }
  return response.json() as Promise<AnggotaListResponse>;
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
    staleTime: 0, // Always refetch — ensures fresh data after mutations
    refetchOnWindowFocus: true,
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

// Fetch the anggota record linked to the currently logged-in user
export function useCurrentUserAnggota() {
  return useQuery({
    queryKey: ['anggota', 'me'],
    queryFn: async () => {
      const response = await fetch('/api/anggota/me');
      if (!response.ok) throw new Error('Failed to fetch current user anggota');
      const json = await response.json() as AnggotaMeResponse;
      return json.data;
    },
    staleTime: 5 * 60 * 1000,
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

// Bulk delete anggota
export function useBulkDeleteAnggota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      ids?: string[];
      deleteAll?: boolean;
      filters?: {
        search?: string;
        kategori_anggota?: string;
        status_anggota?: string;
        status_mps?: string;
        status_iuran?: string;
        nama_cabang?: string;
      };
    }) => {
      const response = await fetch('/api/anggota/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Failed to bulk delete anggota');
      }

      return response.json() as Promise<{ message: string; deletedCount: number }>;
    },
    onSuccess: () => {
      // Invalidate and refetch anggota list
      queryClient.invalidateQueries({ queryKey: ['anggota'] });
    },
  });
}

const IMPORT_CHUNK_SIZE = 500;

// Batch import anggota — splits records into chunks and sends them sequentially.
// Stops immediately on the first error (e.g. duplicate NIK) to avoid wasting time.
export function useBatchImportAnggota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      records: CreateAnggotaInput[];
      onProgress?: (imported: number, total: number) => void;
    }) => {
      // ... chunking logic is in mutationFn body
      const { records, onProgress } = params;
      const allErrors: { row: number; error: string }[] = [];
      let totalSuccess = 0;
      let stopped = false;

      for (let i = 0; i < records.length; i += IMPORT_CHUNK_SIZE) {
        // Stop if a previous chunk had an error
        if (stopped) break;

        const chunk = records.slice(i, i + IMPORT_CHUNK_SIZE);

        const response = await fetch('/api/anggota/batch-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records: chunk }),
        });

        if (!response.ok) {
          // Network/server error on this batch — stop immediately
          const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }));
          allErrors.push({
            row: i + 1,
            error: errorBody.error || 'Gagal mengirim batch',
          });
          stopped = true;
          break;
        }

        const result = await response.json();

        if (result.errorCount > 0 && result.successCount === 0) {
          // Entire chunk failed with a genuine error — stop immediately
          if (result.errors) {
            for (const err of result.errors) {
              allErrors.push({
                row: i + (err.row || 1),
                error: err.error,
              });
            }
          }
          stopped = true;
          break;
        }

        // Partial or full success
        totalSuccess += result.successCount || 0;
        if (result.errors) {
          for (const err of result.errors) {
            allErrors.push({
              row: i + (err.row || 1),
              error: err.error,
            });
          }
        }

        // Report progress
        if (onProgress) {
          onProgress(totalSuccess, records.length);
        }
      }

      return {
        message: stopped
          ? `Import dihentikan: ${totalSuccess} data berhasil diimpor sebelum error`
          : `${totalSuccess} data anggota berhasil diimpor`,
        successCount: totalSuccess,
        errorCount: allErrors.length,
        errors: allErrors.length > 0 ? allErrors : undefined,
        stopped,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anggota'] });
    },
  });
}
