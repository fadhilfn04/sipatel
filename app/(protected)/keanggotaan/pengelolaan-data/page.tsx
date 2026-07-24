'use client';

import { Fragment, useMemo, useState } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import { Container } from '@/components/common/container';
import { ProtectedRoute } from '@/components/rbac/protected-route';
import { PERMISSIONS } from '@/lib/rbac';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  PaginationState,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Eye,
  ChevronsLeft,
  ChevronsRight,
  FileSpreadsheet,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from 'lucide-react';
import { Card, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, BadgeDot } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useAnggotaList,
  useCreateAnggota,
  useDeleteAnggota,
  useUpdateAnggota,
  useBulkDeleteAnggota,
  useBatchImportAnggota,
  useAnggota,
} from '@/lib/hooks/use-anggota-api';
import { Anggota, CreateAnggotaInput } from '@/lib/supabase';
import { MemberFormModal } from '@/components/anggota/MemberFormModal';
import { DetailModal } from '@/components/anggota/DetailModal';
import { DeleteConfirmDialog } from '@/components/anggota/DeleteConfirmDialog';
import { ImportExcelModal } from '@/components/anggota/ImportExcelModal';
import { ExportExcelModal } from '@/components/anggota/ExportExcelModal';
import { ToastNotification } from '@/components/anggota/ToastNotification';
import { ExpandableRow } from '@/components/anggota/ExpandableRow';
import { DocumentStatusBadge } from '@/components/anggota/DocumentStatusBadge';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function PengelolaanDataPage() {
  // State
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKategori, setSelectedKategori] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedMps, setSelectedMps] = useState<string>('all');
  const [selectedIuran, setSelectedIuran] = useState<string>('all');
  const [selectedCabang, setSelectedCabang] = useState<string>('all');

  // Selection state
  // rowSelection tracks per-page checkbox (managed by tanstack table)
  // selectAllFiltered = true means "across all pages, select everything matching current filters"
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [selectAllFiltered, setSelectAllFiltered] = useState(false);

  // Bulk delete state
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkDeleteMode, setBulkDeleteMode] = useState<'selected' | 'all'>('selected');

  // Modal states
  const [selectedMember, setSelectedMember] = useState<Anggota | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editMemberId, setEditMemberId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Anggota | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ show: false, message: '', type: 'success' });

  // API hooks
  const sortColumn = sorting[0]?.id || 'created_at';
  const sortDirection = sorting[0]?.desc ? 'desc' : 'asc';

  const { data: anggotaData, isLoading } = useAnggotaList({
    search: searchQuery,
    kategori_anggota: selectedKategori,
    status_anggota: selectedStatus,
    status_mps: selectedMps,
    status_iuran: selectedIuran,
    nama_cabang: selectedCabang,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    sortColumn,
    sortDirection,
  });

  const { data: editMemberData } = useAnggota(editMemberId || '');
  const createMutation = useCreateAnggota();
  const updateMutation = useUpdateAnggota(editMemberId || '');
  const deleteMutation = useDeleteAnggota();
  const bulkDeleteMutation = useBulkDeleteAnggota();
  const batchImportMutation = useBatchImportAnggota();

  // Helper functions
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const hideToast = () => {
    setToast({ show: false, message: '', type: 'success' });
  };

  const getStatusAnggotaProps = (status: Anggota['status_anggota']) => {
    const statusMap: Record<string, { variant: 'success' | 'destructive' | 'warning' | 'secondary'; label: string }> = {
      pegawai: { variant: 'success', label: 'Pegawai' },
      suami: { variant: 'warning', label: 'Suami' },
      istri: { variant: 'secondary', label: 'Istri' },
      anak: { variant: 'secondary', label: 'Anak' },
      meninggal: { variant: 'destructive', label: 'Meninggal' },
    };
    return statusMap[status] || { variant: 'secondary', label: status };
  };

  const getKategoriAnggotaProps = (kategori: Anggota['kategori_anggota']) => {
    const kategoriMap: Record<string, { variant: 'success' | 'destructive' | 'warning' | 'secondary'; label: string }> = {
      biasa: { variant: 'success', label: 'Biasa' },
      luar_biasa: { variant: 'warning', label: 'Luar Biasa' },
      kehormatan: { variant: 'warning', label: 'Kehormatan' },
      bukan_anggota: { variant: 'secondary', label: 'Bukan Anggota' },
    };
    return kategoriMap[kategori] || { variant: 'secondary', label: kategori };
  };

  const getStatusMpsProps = (status: Anggota['status_mps']) => {
    return status === 'mps'
      ? { variant: 'success' as const, label: 'MPS' }
      : { variant: 'secondary' as const, label: 'Non-MPS' };
  };

  const getStatusIuranProps = (status: Anggota['status_iuran']) => {
    const statusMap: Record<string, { variant: 'success' | 'destructive' | 'warning' | 'secondary'; label: string }> = {
      iuran: { variant: 'success', label: 'Sudah Iuran' },
      tidak_iuran: { variant: 'secondary', label: 'Tidak Iuran' },
    };
    return statusMap[status] || { variant: 'secondary', label: status };
  };

  const getSkPensiunProps = (sk: string | null | undefined) => {
    if (!sk) return { variant: 'secondary' as const, label: '-' };
    const skMap: Record<string, { variant: 'success' | 'destructive' | 'warning' | 'secondary'; label: string }> = {
      ada: { variant: 'success', label: 'ADA' },
      tidak_ada: { variant: 'secondary', label: 'TIDAK ADA' },
    };
    return skMap[sk] || { variant: 'secondary', label: sk };
  };

  const getPosisiKepengurusanProps = (posisi: string | null | undefined) => {
    if (!posisi) return { variant: 'secondary' as const, label: '-' };
    const posisiMap: Record<string, { variant: 'success' | 'destructive' | 'warning' | 'secondary'; label: string }> = {
      'Ketua': { variant: 'success', label: 'Ketua' },
      'Wakil Ketua': { variant: 'warning', label: 'Wakil Ketua' },
      'Sekretaris': { variant: 'warning', label: 'Sekretaris' },
      'Bendahara': { variant: 'warning', label: 'Bendahara' },
      'Anggota': { variant: 'secondary', label: 'Anggota' },
    };
    return posisiMap[posisi] || { variant: 'secondary', label: posisi };
  };

  const formatDisplayValue = (value: string | null | undefined, formatMap?: Record<string, string>) => {
    if (!value) return '-';
    if (formatMap && formatMap[value]) {
      return formatMap[value];
    }
    return value
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getErrorMessage = (error: any) => {
    return (
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      'Terjadi kesalahan'
    );
  };

  // Event handlers
  const handleCreate = async (data: CreateAnggotaInput) => {
    try {
      await createMutation.mutateAsync(data);
      showToast('Anggota baru berhasil ditambahkan', 'success');
      setAddModalOpen(false);
    } catch (error: any) {
      console.error('Error creating member:', error);
      setAddModalOpen(false);
      showToast(`Gagal menambahkan anggota: ${getErrorMessage(error)}`, 'error');
      throw error;
    }
  };

  const handleUpdate = async (data: CreateAnggotaInput) => {
    try {
      await updateMutation.mutateAsync(data);
      showToast('Data anggota berhasil diperbarui', 'success');
      setEditModalOpen(false);
      setEditMemberId(null);
    } catch (error: any) {
      console.error('Error updating member:', error);
      setEditModalOpen(false);
      setEditMemberId(null);
      showToast(`Gagal update anggota: ${getErrorMessage(error)}`, 'error');
      throw error;
    }
  };

  const handleDelete = async () => {
    if (memberToDelete) {
      try {
        await deleteMutation.mutateAsync(memberToDelete.id);
        showToast('Data anggota berhasil dihapus', 'success');
        setDeleteConfirmOpen(false);
        setMemberToDelete(null);
      } catch (error) {
        console.error('Error deleting member:', error);
        showToast('Gagal menghapus data anggota', 'error');
      }
    }
  };

  const handleBulkDelete = async () => {
    try {
      if (selectAllFiltered) {
        // Delete ALL data matching current filters (across all pages)
        const result = await bulkDeleteMutation.mutateAsync({
          deleteAll: true,
          filters: {
            search: searchQuery,
            kategori_anggota: selectedKategori,
            status_anggota: selectedStatus,
            status_mps: selectedMps,
            status_iuran: selectedIuran,
            nama_cabang: selectedCabang,
          },
        });
        showToast(result.message || 'Semua data anggota berhasil dihapus', 'success');
        setSelectAllFiltered(false);
      } else if (bulkDeleteMode === 'all') {
        // Legacy "Hapus Semua" button
        const result = await bulkDeleteMutation.mutateAsync({
          deleteAll: true,
          filters: {
            search: searchQuery,
            kategori_anggota: selectedKategori,
            status_anggota: selectedStatus,
            status_mps: selectedMps,
            status_iuran: selectedIuran,
            nama_cabang: selectedCabang,
          },
        });
        showToast(result.message || 'Semua data anggota berhasil dihapus', 'success');
      } else {
        // Delete only selected IDs (current page selection)
        const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
        if (selectedIds.length === 0) {
          showToast('Tidak ada data yang dipilih', 'info');
          return;
        }
        const result = await bulkDeleteMutation.mutateAsync({
          ids: selectedIds,
        });
        showToast(result.message || `${selectedIds.length} data anggota berhasil dihapus`, 'success');
      }

      setBulkDeleteConfirmOpen(false);
      setRowSelection({});
    } catch (error: any) {
      console.error('Error bulk deleting:', error);
      showToast(`Gagal menghapus data: ${getErrorMessage(error)}`, 'error');
    }
  };

  const handleImport = async (data: any[], onProgress?: (imported: number, total: number) => void) => {
    try {
      const result = await batchImportMutation.mutateAsync({
        records: data as CreateAnggotaInput[],
        onProgress,
      });
      return {
        success: result.successCount,
        error: result.errorCount,
        errors: result.errors,
        stopped: result.stopped,
      };
    } catch (error: any) {
      console.error('Error batch importing:', error);
      showToast(`Gagal mengimpor data: ${getErrorMessage(error)}`, 'error');
      return {
        success: 0,
        error: data.length,
        errors: [{ row: 0, error: getErrorMessage(error) }],
        stopped: true,
      };
    }
  };

  const handleFetchAllData = async (limit?: number) => {
    try {
      const { fetchAnggotaList } = await import('@/lib/hooks/use-anggota-api');
      const result = await fetchAnggotaList({
        search: searchQuery,
        kategori_anggota: selectedKategori,
        status_anggota: selectedStatus,
        status_mps: selectedMps,
        status_iuran: selectedIuran,
        nama_cabang: selectedCabang,
        page: 1,
        limit: limit || 10000,
        sortColumn,
        sortDirection,
      });
      return result.data || [];
    } catch (error) {
      console.error('Error fetching all data:', error);
      showToast('Gagal mengambil data untuk export. Silakan coba lagi.', 'error');
      return [];
    }
  };

  // Determine if current page has all rows selected
  const currentPageData = anggotaData?.data || [];
  const allCurrentPageSelected =
    currentPageData.length > 0 &&
    currentPageData.every((row) => rowSelection[row.id]);

  const handleHeaderCheckboxChange = (value: boolean) => {
    if (value) {
      // Check all rows on current page
      const newSelection: Record<string, boolean> = {};
      currentPageData.forEach((row) => {
        newSelection[row.id] = true;
      });
      setRowSelection(newSelection);
      // Don't activate selectAllFiltered yet — user needs to actively click the banner
    } else {
      setRowSelection({});
      setSelectAllFiltered(false);
    }
  };

  const handleSelectAllFiltered = () => {
    // Select all rows on current page + activate "select all across pages"
    const newSelection: Record<string, boolean> = {};
    currentPageData.forEach((row) => {
      newSelection[row.id] = true;
    });
    setRowSelection(newSelection);
    setSelectAllFiltered(true);
  };

  const handleClearSelection = () => {
    setRowSelection({});
    setSelectAllFiltered(false);
  };

  // Table columns
  const columns = useMemo<ColumnDef<Anggota>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              selectAllFiltered ||
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(value) => {
              handleHeaderCheckboxChange(!!value);
            }}
            aria-label="Select all"
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectAllFiltered || row.getIsSelected()}
            onCheckedChange={(value) => {
              row.toggleSelected(!!value);
            }}
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'no',
        header: 'NO',
        cell: ({ row }) => row.index + 1 + pagination.pageIndex * pagination.pageSize,
        enableSorting: false,
      },
      {
        accessorKey: 'nik',
        header: 'NIK',
        cell: ({ row }) => <span className="font-mono text-xs sm:text-sm">{row.original.nik}</span>,
        enableSorting: true,
      },
      {
        accessorKey: 'nama_anggota',
        header: 'NAMA',
        cell: ({ row }) => <div className="font-medium text-xs sm:text-sm">{row.original.nama_anggota}</div>,
        enableSorting: true,
      },
      {
        accessorKey: 'kategori_anggota',
        header: 'KATEGORI',
        cell: ({ row }) => {
          const props = getKategoriAnggotaProps(row.original.kategori_anggota);
          return (
            <Badge variant={props.variant} appearance="ghost" className="text-xs">
              <BadgeDot />
              {props.label}
            </Badge>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'status_anggota',
        header: 'STATUS',
        cell: ({ row }) => {
          const props = getStatusAnggotaProps(row.original.status_anggota);
          return (
            <Badge variant={props.variant} appearance="ghost" className="text-xs">
              <BadgeDot />
              {props.label}
            </Badge>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'nama_cabang',
        header: 'CABANG',
        cell: ({ row }) => <span className="text-xs sm:text-sm">{row.original.nama_cabang}</span>,
        enableSorting: true,
      },
      {
        accessorKey: 'kode_cabang',
        header: 'KODE CABANG',
        cell: ({ row }) => <span className="text-xs sm:text-sm font-mono">{row.original.kode_cabang || '-'}</span>,
        enableSorting: true,
      },
      {
        accessorKey: 'status_iuran',
        header: 'IURAN',
        cell: ({ row }) => {
          const props = getStatusIuranProps(row.original.status_iuran);
          return (
            <Badge variant={props.variant} appearance="ghost" className="text-xs">
              <BadgeDot />
              {props.label}
            </Badge>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'posisi_kepengurusan',
        header: 'POSISI KEPENGURUSAN',
        cell: ({ row }) => {
          const props = getPosisiKepengurusanProps(row.original.posisi_kepengurusan);
          return (
            <Badge variant={props.variant} appearance="ghost" className="text-xs">
              <BadgeDot />
              {props.label}
            </Badge>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'sk_pensiun',
        header: 'SK PENSIUN',
        cell: ({ row }) => {
          const props = getSkPensiunProps(row.original.sk_pensiun);
          return (
            <Badge variant={props.variant} appearance="ghost" className="text-xs">
              {props.label}
            </Badge>
          );
        },
        enableSorting: false,
      },
      {
        id: 'actions',
        header: 'AKSI',
        cell: ({ row }) => (
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              mode="icon"
              variant="dim"
              size="sm"
              className="h-6 w-6 sm:h-7 sm:w-7"
              title="Lihat Detail"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMember(row.original);
                setDetailModalOpen(true);
              }}
            >
              <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button
              mode="icon"
              variant="dim"
              size="sm"
              className="h-6 w-6 sm:h-7 sm:w-7"
              title="Edit"
              onClick={(e) => {
                e.stopPropagation();
                setEditMemberId(row.original.id);
                setEditModalOpen(true);
              }}
              disabled={!row.original.id}
            >
              <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button
              mode="icon"
              variant="destructive"
              size="sm"
              className="h-6 w-6 sm:h-7 sm:w-7"
              title="Hapus"
              onClick={(e) => {
                e.stopPropagation();
                setMemberToDelete(row.original);
                setDeleteConfirmOpen(true);
              }}
            >
              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        ),
        enableSorting: false,
      },
    ],
    [pagination.pageIndex, pagination.pageSize, selectAllFiltered, currentPageData, rowSelection]
  );

  const table = useReactTable({
    columns,
    data: anggotaData?.data || [],
    pageCount: anggotaData?.pagination?.totalPages || 1,
    getRowId: (row: Anggota) => row.id,
    state: {
      pagination,
      sorting,
      rowSelection,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onRowSelectionChange: (updater) => {
      setRowSelection(updater);
      // If user manually deselects something, turn off selectAllFiltered
      setSelectAllFiltered(false);
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: true,
  });

  const totalCount = anggotaData?.pagination?.total || 0;
  const selectedCount = Object.keys(rowSelection).filter((id) => rowSelection[id]).length;
  const effectiveSelectedCount = selectAllFiltered ? totalCount : selectedCount;
  const hasSelection = effectiveSelectedCount > 0;

  return (
    <ProtectedRoute permission={PERMISSIONS.VIEW_KEANGGOTAAN}>
      <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading title="Pengelolaan Data" description="Kelola data keanggotaan" />
          <ToolbarActions />
        </Toolbar>
      </Container>

      <Container className="flex flex-col max-h-[calc(100vh-200px)]">
        <Card className="flex flex-col overflow-hidden">
          {/* Sticky Header Section */}
          <div className="shrink-0 border-b">
            <CardHeader className="flex-col flex-wrap sm:flex-row items-stretch sm:items-center py-5 gap-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full">
                {/* Search */}
                <div className="relative flex-1 max-w-2xl">
                  <Search className="size-5 text-muted-foreground absolute start-4 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Cari nama, NIK, cabang, atau lainnya..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="ps-12 h-12 text-base"
                  />
                  {searchQuery.length > 0 && (
                    <Button
                      mode="icon"
                      variant="dim"
                      className="absolute inset-e-1.5 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setSearchQuery('')}
                    >
                      ×
                    </Button>
                  )}
                </div>

                <Button
                  variant="outline"
                  onClick={() => setExportModalOpen(true)}
                  className="w-full sm:w-auto"
                  disabled={!anggotaData?.data || anggotaData.data.length === 0}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Export</span>
                  <span className="sm:hidden">Export Excel</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setImportModalOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Import</span>
                  <span className="sm:hidden">Import Excel</span>
                </Button>
                <Button
                  onClick={() => setAddModalOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  <span>Tambah Anggota</span>
                </Button>

                {/* Delete Button — appears when there is any selection */}
                {hasSelection && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setBulkDeleteMode('selected');
                      setBulkDeleteConfirmOpen(true);
                    }}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {selectAllFiltered
                      ? `Hapus ${totalCount} Data (Semua Halaman)`
                      : `Hapus ${selectedCount} Terpilih`}
                  </Button>
                )}
              </div>
            </CardHeader>
          </div>

          {/* Selection Info Bar + "Select all across pages" banner */}
          {hasSelection && (
            <div className="shrink-0 bg-muted/30 px-6 py-2 border-b">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectAllFiltered
                    ? `Semua ${totalCount} data terpilih di semua halaman`
                    : `${selectedCount} data terpilih (halaman ini)`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelection}
                  className="h-7 text-xs"
                >
                  Hapus pilihan
                </Button>
              </div>

              {/* "Select all across all pages" banner — shown when all current page rows are checked but not yet in "all pages" mode */}
              {allCurrentPageSelected && !selectAllFiltered && totalCount > currentPageData.length && (
                <div className="mt-2 pt-2 border-t border-muted-foreground/20">
                  <p className="text-xs text-muted-foreground">
                    Semua {currentPageData.length} data di halaman ini telah dipilih.{' '}
                    <button
                      type="button"
                      className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                      onClick={handleSelectAllFiltered}
                    >
                      Pilih semua {totalCount} data
                    </button>
                    {' '}yang sesuai dengan filter saat ini.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-auto min-h-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="hover:bg-transparent">
                      {headerGroup.headers.map((header) => {
                        const columnId = header.column.id;
                        const accessorKey = (header.column.columnDef as any).accessorKey as string;
                        const isSelectColumn = columnId === 'select';
                        const hideOnMobile = !isSelectColumn && (columnId === 'no' || accessorKey === 'jenis_anggota' || accessorKey === 'status_iuran' || accessorKey === 'cabang_domisili');
                        const canSort = header.column.getCanSort();
                        const isSorted = header.column.getIsSorted();

                        return (
                          <TableHead
                            key={header.id}
                            className={`${hideOnMobile ? 'hidden sm:table-cell' : ''} bg-background px-3 py-3 text-xs sm:px-4 sm:py-3 sm:text-sm ${canSort ? 'cursor-pointer select-none hover:bg-muted/50' : ''} ${isSelectColumn ? 'w-10' : ''}`}
                            onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                          >
                            {header.isPlaceholder ? null : (
                              <div className="flex items-center gap-1">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                {canSort && (
                                  <span className="ml-1">
                                    {isSorted === 'asc' ? (
                                      <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4" />
                                    ) : isSorted === 'desc' ? (
                                      <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
                                    ) : (
                                      <ChevronsUpDown className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground opacity-50" />
                                    )}
                                  </span>
                                )}
                              </div>
                            )}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        Memuat data...
                      </TableCell>
                    </TableRow>
                  ) : table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => {
                      const anggota = row.original;
                      return (
                        <ExpandableRow
                          key={row.id}
                          anggota={anggota}
                          columns={columns}
                          index={row.index}
                          pageSize={pagination.pageSize}
                          pageIndex={pagination.pageIndex}
                        >
                          {row.getVisibleCells().map((cell) => {
                            const columnId = cell.column.id;
                            const accessorKey = (cell.column.columnDef as any).accessorKey as string;
                            const isSelectColumn = columnId === 'select';
                            const hideOnMobile = !isSelectColumn && (columnId === 'no' || accessorKey === 'jenis_anggota' || accessorKey === 'status_iuran' || accessorKey === 'cabang_domisili');
                            return (
                              <TableCell
                                key={cell.id}
                                className={`${hideOnMobile ? 'hidden sm:table-cell' : ''} px-3 py-3 text-xs sm:px-4 sm:py-3 sm:text-sm`}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            );
                          })}
                        </ExpandableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        Tidak ada data ditemukan.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination */}
          <CardFooter className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 py-4 border-t">
            <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
              <div className="sm:hidden">
                {pagination.pageIndex * pagination.pageSize + 1}-{Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalCount)} dari {totalCount}
              </div>
              <div className="hidden sm:block">
                Menampilkan {pagination.pageIndex * pagination.pageSize + 1} -{' '}
                {Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalCount)} dari {totalCount}{' '}
                data
              </div>
            </div>

            <div className="flex items-center justify-center gap-1 sm:gap-2">
              <Button mode="icon" variant="dim" size="sm" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} className="h-8 w-8 sm:h-9 sm:w-9">
                <ChevronsLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              <Button mode="icon" variant="dim" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="h-8 w-8 sm:h-9 sm:w-9">
                <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>

              <div className="text-xs sm:text-sm text-muted-foreground px-2">
                <span className="hidden sm:inline">Halaman </span>{table.getState().pagination.pageIndex + 1}<span className="hidden sm:inline"> dari {table.getPageCount()}</span>
              </div>

              <Button mode="icon" variant="dim" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="h-8 w-8 sm:h-9 sm:w-9">
                <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              <Button mode="icon" variant="dim" size="sm" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} className="h-8 w-8 sm:h-9 sm:w-9">
                <ChevronsRight className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>

              <Select
                value={String(pagination.pageSize)}
                onValueChange={(value) => setPagination({ ...pagination, pageSize: Number(value) })}
              >
                <SelectTrigger className="w-14 sm:w-16 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardFooter>
        </Card>
      </Container>

      {/* Modals */}
      <DetailModal open={detailModalOpen} onClose={() => setDetailModalOpen(false)} member={selectedMember} />
      <MemberFormModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={handleCreate}
        mode="create"
        isPending={createMutation.isPending}
      />
      <MemberFormModal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditMemberId(null);
        }}
        onSubmit={handleUpdate}
        member={editMemberData}
        mode="edit"
        isPending={updateMutation.isPending}
      />
      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setMemberToDelete(null);
        }}
        onConfirm={handleDelete}
        member={memberToDelete}
        isPending={deleteMutation.isPending}
      />
      <ImportExcelModal open={importModalOpen} onClose={() => setImportModalOpen(false)} onImport={handleImport} />
      <ExportExcelModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        data={anggotaData?.data || []}
        totalCount={anggotaData?.pagination?.total}
        onFetchAllData={handleFetchAllData}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteConfirmOpen} onOpenChange={(open) => {
        if (!open) setBulkDeleteConfirmOpen(false);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Konfirmasi Hapus Massal
            </DialogTitle>
            <DialogDescription>
              {selectAllFiltered
                ? `Apakah Anda yakin ingin menghapus semua ${totalCount} data anggota yang sesuai dengan filter saat ini?`
                : `Apakah Anda yakin ingin menghapus ${selectedCount} data anggota yang dipilih?`}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              {selectAllFiltered ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total data</span>
                    <span className="font-medium">{totalCount} anggota</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Filter aktif</span>
                    <span className="text-sm">
                      {searchQuery ? `Pencarian: "${searchQuery}"` : 'Tidak ada filter'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Data yang akan dihapus</span>
                  <span className="font-medium">{selectedCount} anggota</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Tindakan ini tidak dapat dibatalkan. Data akan dihapus secara permanen dari sistem.
            </p>
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Batal</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? (
                <>
                  <span className="h-4 w-4 mr-2 animate-spin border-2 border-current border-t-transparent rounded-full inline-block" />
                  Menghapus...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {selectAllFiltered ? `Hapus ${totalCount} Data` : `Hapus ${selectedCount} Data`}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast Notification */}
      <ToastNotification show={toast.show} message={toast.message} type={toast.type} onClose={hideToast} />
    </Fragment>
    </ProtectedRoute>
  );
}