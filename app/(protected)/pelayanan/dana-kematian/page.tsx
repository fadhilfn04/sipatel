'use client';

import { Fragment, useMemo, useState } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import { Container } from '@/components/common/container';
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
  User,
  FileText,
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
import {
  useDanaKematianList,
  useCreateDanaKematian,
  useDeleteDanaKematian,
  useUpdateDanaKematian,
  useDanaKematian,
} from '@/lib/hooks/use-dana-kematian-api';
import { DanaKematian, CreateDanaKematianInput } from '@/lib/supabase';
import { DanaKematianDetailModal } from '@/components/dana-kematian/DanaKematianDetailModal';
import { DanaKematianFormModal } from '@/components/dana-kematian/DanaKematianFormModal';
import { DeleteConfirmDialog } from '@/components/dana-kematian/DeleteConfirmDialog';
import { ToastNotification } from '@/components/anggota/ToastNotification';
import { useAnggotaList } from '@/lib/hooks/use-anggota-api';

export default function DanaKematianPage() {
  // State
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Modal states
  const [selectedClaim, setSelectedClaim] = useState<DanaKematian | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editClaimId, setEditClaimId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [claimToDelete, setClaimToDelete] = useState<DanaKematian | null>(null);

  // Toast state
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ show: false, message: '', type: 'success' });

  // API hooks
  const { data: danaKematianData, isLoading, refetch } = useDanaKematianList({
    search: searchQuery,
    status_proses: selectedStatus,
    tanggal_meninggal_from: dateFrom,
    tanggal_meninggal_to: dateTo,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  });

  // Fetch members for dropdown (only for create mode)
  const { data: membersData } = useAnggotaList({
    search: '',
    status_anggota: 'meninggal',
    page: 1,
    limit: 1000,
  });

  const { data: editClaimData } = useDanaKematian(editClaimId || '');
  const createMutation = useCreateDanaKematian();
  const updateMutation = useUpdateDanaKematian(editClaimId || '');
  const deleteMutation = useDeleteDanaKematian();

  // Helper functions
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const hideToast = () => {
    setToast({ show: false, message: '', type: 'success' });
  };

  const getStatusProps = (status: DanaKematian['status_proses']) => {
    switch (status) {
      case 'dilaporkan':
        return { variant: 'secondary' as const, label: 'Dilaporkan' };
      case 'verifikasi_cabang':
        return { variant: 'warning' as const, label: 'Verifikasi Cabang' };
      case 'proses_pusat':
        return { variant: 'warning' as const, label: 'Proses Pusat' };
      case 'selesai':
        return { variant: 'success' as const, label: 'Selesai' };
      default:
        return { variant: 'secondary' as const, label: status };
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Event handlers
  const handleCreate = async (data: CreateDanaKematianInput) => {
    try {
      await createMutation.mutateAsync(data);
      showToast('Pengajuan dana kematian berhasil diajukan', 'success');
      setAddModalOpen(false);
    } catch (error) {
      console.error('Error creating claim:', error);
      showToast('Gagal mengajukan dana kematian', 'error');
      throw error;
    }
  };

  const handleUpdate = async (data: CreateDanaKematianInput) => {
    try {
      await updateMutation.mutateAsync(data);
      showToast('Data dana kematian berhasil diperbarui', 'success');
      setEditModalOpen(false);
      setEditClaimId(null);
    } catch (error) {
      console.error('Error updating claim:', error);
      showToast('Gagal memperbarui data dana kematian', 'error');
      throw error;
    }
  };

  const handleDelete = async () => {
    if (claimToDelete) {
      try {
        await deleteMutation.mutateAsync(claimToDelete.id);
        showToast('Pengajuan dana kematian berhasil dihapus', 'success');
        setDeleteConfirmOpen(false);
        setClaimToDelete(null);
      } catch (error) {
        console.error('Error deleting claim:', error);
        showToast('Gagal menghapus data dana kematian', 'error');
      }
    }
  };

  // Table columns
  const columns = useMemo<ColumnDef<DanaKematian>[]>(
    () => [
      {
        accessorKey: 'no',
        header: 'NO',
        cell: ({ row }) => row.index + 1 + pagination.pageIndex * pagination.pageSize,
      },
      {
        accessorKey: 'tanggal_meninggal',
        header: 'TANGGAL MENINGGAL',
        cell: ({ row }) => <span className="text-xs sm:text-sm">{formatDate(row.original.tanggal_meninggal)}</span>,
      },
      {
        accessorKey: 'nama_anggota',
        header: 'NAMA',
        cell: ({ row }) => <div className="font-medium text-xs sm:text-sm">{row.original.nama_anggota}</div>,
      },
      // {
      //   accessorKey: 'status_mps',
      //   header: 'MPS',
      //   cell: ({ row }) => <span className="font-mono text-xs sm:text-sm">{row.original.status_mps}</span>,
      // },
      {
        accessorKey: 'nama_ahli_waris',
        header: 'AHLI WARIS',
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-xs sm:text-sm">{row.original.nama_ahli_waris}</div>
            <div className="text-xs text-muted-foreground">{row.original.status_ahli_waris}</div>
          </div>
        ),
      },
      {
        accessorKey: 'besaran_dana_kematian',
        header: 'JUMLAH',
        cell: ({ row }) => (
          <span className="font-semibold text-green-600 text-xs sm:text-sm">
            {formatCurrency(row.original.besaran_dana_kematian)}
          </span>
        ),
      },
      {
        accessorKey: 'status_proses',
        header: 'STATUS',
        cell: ({ row }) => {
          const props = getStatusProps(row.original.status_proses);
          return (
            <Badge variant={props.variant} appearance="ghost" className="text-xs">
              <BadgeDot />
              {props.label}
            </Badge>
          );
        },
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
              onClick={() => {
                setSelectedClaim(row.original);
                setDetailModalOpen(true);
              }}
            >
              <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>

            <Button
              mode="icon"
              variant="dim"
              size="sm"
              className="h-6 w-6 sm:h-7 sm:w-7"
              title="Edit"
              onClick={() => {
                setEditClaimId(row.original.id);
                setEditModalOpen(true);
              }}
              disabled={!row.original.id || row.original.status_proses === 'selesai'}
            >
              <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button
              mode="icon"
              variant="destructive"
              size="sm"
              className="h-6 w-6 sm:h-7 sm:w-7"
              title="Hapus"
              onClick={() => {
                setClaimToDelete(row.original);
                setDeleteConfirmOpen(true);
              }}
              disabled={row.original.status_proses === 'selesai'}
            >
              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [pagination.pageIndex, pagination.pageSize]
  );

  const table = useReactTable({
    columns,
    data: danaKematianData?.data || [],
    pageCount: danaKematianData?.pagination?.totalPages || 1,
    getRowId: (row: DanaKematian) => row.id,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
  });

  const filteredData = danaKematianData?.data || [];
  const totalCount = danaKematianData?.pagination?.total || 0;

  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading title="Dana Kematian" description="Kelola dana kematian anggota" />
          <ToolbarActions />
        </Toolbar>
      </Container>

      <Container>
        <Card>
          <CardHeader className="flex-col flex-wrap sm:flex-row items-stretch sm:items-center py-5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 w-full">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                {/* Search */}
                <div className="relative">
                  <Search className="size-4 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Cari nama, NIKAP, atau ahli waris..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="ps-9 w-full sm:w-64"
                  />
                  {searchQuery.length > 0 && (
                    <Button
                      mode="icon"
                      variant="dim"
                      className="absolute end-1.5 top-1/2 -translate-y-1/2 h-6 w-6"
                      onClick={() => setSearchQuery('')}
                    >
                      ×
                    </Button>
                  )}
                </div>

                {/* Status Filter */}
                <Select
                  onValueChange={(value) => {
                    setSelectedStatus(value);
                    setPagination({ ...pagination, pageIndex: 0 });
                  }}
                  value={selectedStatus}
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="dilaporkan">Dilaporkan</SelectItem>
                    <SelectItem value="verifikasi_cabang">Verifikasi Cabang</SelectItem>
                    <SelectItem value="proses_pusat">Proses Pusat</SelectItem>
                    <SelectItem value="selesai">Selesai</SelectItem>
                  </SelectContent>
                </Select>

                {/* Date Range Filter */}
                {/* <Input
                  type="date"
                  placeholder="Dari tanggal"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPagination({ ...pagination, pageIndex: 0 });
                  }}
                  className="w-full sm:w-auto"
                />
                <Input
                  type="date"
                  placeholder="Sampai tanggal"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPagination({ ...pagination, pageIndex: 0 });
                  }}
                  className="w-full sm:w-auto"
                /> */}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button onClick={() => setAddModalOpen(true)}>
                  <Plus />
                  Ajukan Dana
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* Table */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const columnId = header.column.id;
                      const accessorKey = (header.column.columnDef as any).accessorKey as string;
                      const hideOnMobile = columnId === 'no' || accessorKey === 'tanggal_meninggal' || accessorKey === 'nama_ahli_waris';
                      return (
                        <TableHead
                          key={header.id}
                          className={`${hideOnMobile ? 'hidden sm:table-cell' : ''} px-3 py-3 text-xs sm:px-4 sm:py-3 sm:text-sm`}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
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
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                      {row.getVisibleCells().map((cell) => {
                        const columnId = cell.column.id;
                        const accessorKey = (cell.column.columnDef as any).accessorKey as string;
                        const hideOnMobile = columnId === 'no' || accessorKey === 'tanggal_meninggal' || accessorKey === 'nama_ahli_waris';
                        return (
                          <TableCell
                            key={cell.id}
                            className={`${hideOnMobile ? 'hidden sm:table-cell' : ''} px-3 py-3 text-xs sm:px-4 sm:py-3 sm:text-sm`}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
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

          {/* Pagination */}
          <CardFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 py-4">
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
              <Button
                mode="icon"
                variant="dim"
                size="sm"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="h-8 w-8 sm:h-9 sm:w-9"
              >
                <ChevronsLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              <Button
                mode="icon"
                variant="dim"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="h-8 w-8 sm:h-9 sm:w-9"
              >
                <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>

              <div className="text-xs sm:text-sm text-muted-foreground px-2">
                <span className="hidden sm:inline">Halaman </span>{table.getState().pagination.pageIndex + 1}<span className="hidden sm:inline"> dari {table.getPageCount()}</span>
              </div>

              <Button
                mode="icon"
                variant="dim"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="h-8 w-8 sm:h-9 sm:w-9"
              >
                <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              <Button
                mode="icon"
                variant="dim"
                size="sm"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                className="h-8 w-8 sm:h-9 sm:w-9"
              >
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
      <DanaKematianDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        claim={selectedClaim}
        onRefresh={() => refetch()}
      />
      <DanaKematianFormModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={handleCreate}
        mode="create"
        isPending={createMutation.isPending}
        members={membersData?.data || []}
      />
      <DanaKematianFormModal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditClaimId(null);
        }}
        onSubmit={handleUpdate}
        claim={editClaimData as any}
        mode="edit"
        isPending={updateMutation.isPending}
        members={[]}
      />
      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setClaimToDelete(null);
        }}
        onConfirm={handleDelete}
        claim={claimToDelete}
        isPending={deleteMutation.isPending}
      />

      {/* Toast Notification */}
      <ToastNotification show={toast.show} message={toast.message} type={toast.type} onClose={hideToast} />
    </Fragment>
  );
}
