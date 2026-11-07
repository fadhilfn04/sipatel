import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AnggotaRekeningHistory,
  PenggantianRekeningRequest,
} from '@/lib/anggota-rekening';
import {
  Anggota,
  CreateAnggotaInput,
  supabase,
  UpdateAnggotaInput,
} from '@/lib/supabase';

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

/**
 * Fetch ALL anggota records matching the given filters, across all pages.
 * Uses pagination internally to collect every record, so the caller gets
 * a complete dataset (useful for export, bulk operations, etc.)
 */
export async function fetchAllAnggota(params: {
  search?: string;
  kategori_anggota?: string;
  status_anggota?: string;
  status_mps?: string;
  status_iuran?: string;
  nama_cabang?: string;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
}): Promise<Anggota[]> {
  const PAGE_LIMIT = 1000; // Max per-page supported by Supabase
  const allRecords: Anggota[] = [];
  let page = 1;
  let totalPages = 1;

  // Fetch first page to get total count
  const firstPage = await fetchAnggotaList({
    ...params,
    page: 1,
    limit: PAGE_LIMIT,
  });

  allRecords.push(...firstPage.data);
  totalPages = firstPage.pagination.totalPages;

  // Fetch remaining pages
  while (page < totalPages) {
    page++;
    const result = await fetchAnggotaList({
      ...params,
      page,
      limit: PAGE_LIMIT,
    });
    allRecords.push(...result.data);
  }

  return allRecords;
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
      const json = (await response.json()) as AnggotaMeResponse;
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

      return response.json() as Promise<{
        message: string;
        deletedCount: number;
      }>;
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
          const errorBody = await response
            .json()
            .catch(() => ({ error: 'Unknown error' }));
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

// ─────────────────────────────────────────────────────────────
// Perubahan Data Pribadi (Keanggotaan → Perubahan Data Pribadi)
// ─────────────────────────────────────────────────────────────

export interface PerubahanDataPribadiResponse {
  status: 'tersimpan' | 'menunggu';
  message: string;
  data?: Anggota;
  perubahan?: {
    field: string;
    label: string;
    before: unknown;
    after: unknown;
  }[];
}

/**
 * Simpan perubahan data pribadi anggota.
 *
 * - Admin → tersimpan langsung (`status: 'tersimpan'`).
 * - Non-admin → usulan menunggu persetujuan admin (`status: 'menunggu'`, HTTP 202).
 *
 * Validasi allowlist & alasan dilakukan di server (lihat
 * `app/api/anggota/[id]/perubahan-data/route.ts`).
 */
export function usePerubahanDataPribadi(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      perubahan: UpdateAnggotaInput;
      alasan: string;
    }) => {
      const response = await fetch(`/api/anggota/${id}/perubahan-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json: any = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          Array.isArray(json?.errors) && json.errors.length
            ? json.errors.join('; ')
            : json?.error || 'Gagal menyimpan perubahan data pribadi';
        throw new Error(message);
      }

      return json as PerubahanDataPribadiResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anggota'] });
      queryClient.invalidateQueries({ queryKey: ['anggota', id] });
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Penggantian Rekening (Keanggotaan → Penggantian Rekening)
// ─────────────────────────────────────────────────────────────

export interface PenggantianRekeningResponse {
  status: 'tersimpan' | 'menunggu';
  message: string;
  data?: Anggota;
  perubahan?: {
    field: string;
    label: string;
    before: unknown;
    after: unknown;
  }[];
  peringatan_dakem?: boolean;
}

export interface RekeningInfo {
  anggota: {
    id: string;
    nik: string;
    nama_anggota: string;
    nama_cabang: string;
    nama_bank: string | null;
    norek_bank: string | null;
    nama_pemilik_rekening: string | null;
  };
  riwayat: AnggotaRekeningHistory[];
  has_active_dakem: boolean;
}

/** Rekening aktif + riwayat penggantian + indikasi dakem aktif (GET). */
export function useRekeningInfo(id: string | null) {
  return useQuery<RekeningInfo, Error>({
    queryKey: ['anggota', id, 'rekening'],
    enabled: !!id,
    queryFn: async () => {
      const response = await fetch(`/api/anggota/${id}/penggantian-rekening`);
      const json: any = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.error || 'Gagal memuat informasi rekening');
      }
      return json.data as RekeningInfo;
    },
  });
}

/**
 * Simpan penggantian rekening anggota.
 *
 * - Admin → tersimpan langsung (`status: 'tersimpan'`).
 * - Non-admin → usulan menunggu persetujuan admin (`status: 'menunggu'`, HTTP 202).
 *
 * Validasi allowlist, dokumen, tanggal efektif & alasan dilakukan di server
 * (lihat `app/api/anggota/[id]/penggantian-rekening/route.ts`).
 */
export function usePenggantianRekening(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PenggantianRekeningRequest) => {
      const response = await fetch(`/api/anggota/${id}/penggantian-rekening`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json: any = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          Array.isArray(json?.errors) && json.errors.length
            ? json.errors.join('; ')
            : json?.error || 'Gagal menyimpan penggantian rekening';
        throw new Error(message);
      }

      return json as PenggantianRekeningResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anggota'] });
      queryClient.invalidateQueries({ queryKey: ['anggota', id] });
      queryClient.invalidateQueries({ queryKey: ['anggota', id, 'rekening'] });
    },
  });
}

