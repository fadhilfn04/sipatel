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
  FileSpreadsheet,
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
  useAnggotaList,
  useCreateAnggota,
  useDeleteAnggota,
  useUpdateAnggota,
  useAnggota,
} from '@/lib/hooks/use-anggota-api';
import { Anggota, CreateAnggotaInput } from '@/lib/supabase';
import { MemberFormModal } from '@/components/anggota/MemberFormModal';
import { DetailModal } from '@/components/anggota/DetailModal';
import { DeleteConfirmDialog } from '@/components/anggota/DeleteConfirmDialog';
import { ImportExcelModal } from '@/components/anggota/ImportExcelModal';
import { ToastNotification } from '@/components/anggota/ToastNotification';
import { ExpandableRow } from '@/components/anggota/ExpandableRow';

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

  // Modal states
  const [selectedMember, setSelectedMember] = useState<Anggota | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editMemberId, setEditMemberId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Anggota | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ show: false, message: '', type: 'success' });

  // API hooks
  const { data: anggotaData, isLoading } = useAnggotaList({
    search: searchQuery,
    kategori_anggota: selectedKategori,
    status_anggota: selectedStatus,
    status_mps: selectedMps,
    status_iuran: selectedIuran,
    nama_cabang: selectedCabang,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  });

  const { data: editMemberData } = useAnggota(editMemberId || '');
  const createMutation = useCreateAnggota();
  const updateMutation = useUpdateAnggota(editMemberId || '');
  const deleteMutation = useDeleteAnggota();

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
      sudah_ttd: { variant: 'success', label: 'Sudah TTD' },
      belum_ttd: { variant: 'warning', label: 'Belum TTD' },
      tidak_iuran: { variant: 'secondary', label: 'Tidak Iuran' },
    };
    return statusMap[status] || { variant: 'secondary', label: status };
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

      // Close modal first so toast is visible
      setAddModalOpen(false);

      // Show error with actual message from backend
      showToast(
        `Gagal menambahkan anggota: ${getErrorMessage(error)}`,
        'error'
      );

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

      // Close modal first so toast is visible
      setEditModalOpen(false);
      setEditMemberId(null);

      // Show error with actual message from backend
      showToast(
        `Gagal update anggota: ${getErrorMessage(error)}`,
        'error'
      );

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

  const handleImport = async (data: any[]) => {
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < data.length; i++) {
      try {
        const member = data[i];
        await createMutation.mutateAsync(member as CreateAnggotaInput);
        successCount++;
      } catch (error) {
        console.error(`Error importing row ${i + 1}:`, error);
        errorCount++;
      }
    }

    return { success: successCount, error: errorCount };
  };

  // Table columns
  const columns = useMemo<ColumnDef<Anggota>[]>(
    () => [
      {
        accessorKey: 'no',
        header: 'NO',
        cell: ({ row }) => row.index + 1 + pagination.pageIndex * pagination.pageSize,
      },
      {
        accessorKey: 'nik',
        header: 'NIK',
        cell: ({ row }) => <span className="font-mono text-xs sm:text-sm">{row.original.nik}</span>,
      },
      {
        accessorKey: 'nama_anggota',
        header: 'NAMA',
        cell: ({ row }) => <div className="font-medium text-xs sm:text-sm">{row.original.nama_anggota}</div>,
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
      },
      {
        accessorKey: 'status_mps',
        header: 'MPS',
        cell: ({ row }) => {
          const props = getStatusMpsProps(row.original.status_mps);
          return (
            <Badge variant={props.variant} appearance="ghost" className="text-xs">
              <BadgeDot />
              {props.label}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'nama_cabang',
        header: 'CABANG',
        cell: ({ row }) => <span className="text-xs sm:text-sm">{row.original.nama_cabang}</span>,
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
      },
      {
        accessorKey: 'posisi_kepengurusan',
        header: 'POSISI KEPENGURUSAN',
        cell: ({ row }) => <span className="text-xs sm:text-sm">{row.original.posisi_kepengurusan}</span>,
      },
      {
        accessorKey: 'sk_pensiun',
        header: 'SK PENSIUN',
        cell: ({ row }) => <span className="text-xs sm:text-sm">{row.original.sk_pensiun}</span>,
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
            {/* <Button
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
            </Button> */}
          </div>
        ),
      },
    ],
    [pagination.pageIndex, pagination.pageSize]
  );

  const table = useReactTable({
    columns,
    data: anggotaData?.data || [],
    pageCount: anggotaData?.pagination?.totalPages || 1,
    getRowId: (row: Anggota) => row.id,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
  });

  const filteredData = anggotaData?.data || [];
  const totalCount = anggotaData?.pagination?.total || 0;

  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading title="Pengelolaan Data" description="Kelola data keanggotaan" />
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
                    placeholder="Cari nama, NIK, atau cabang..."
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

                {/* Filters */}
                <Select
                  onValueChange={(value) => {
                    setSelectedKategori(value);
                    setPagination({ ...pagination, pageIndex: 0 });
                  }}
                  value={selectedKategori}
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kategori</SelectItem>
                    <SelectItem value="biasa">Biasa</SelectItem>
                    <SelectItem value="luar_biasa">Luar Biasa</SelectItem>
                    <SelectItem value="kehormatan">Kehormatan</SelectItem>
                    <SelectItem value="bukan_anggota">Bukan Anggota</SelectItem>
                  </SelectContent>
                </Select>

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
                    <SelectItem value="pegawai">Pegawai</SelectItem>
                    <SelectItem value="istri">Istri</SelectItem>
                    <SelectItem value="suami">Suami</SelectItem>
                    <SelectItem value="anak">Anak</SelectItem>
                    <SelectItem value="meninggal">Meninggal</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  onValueChange={(value) => {
                    setSelectedMps(value);
                    setPagination({ ...pagination, pageIndex: 0 });
                  }}
                  value={selectedMps}
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Status MPS" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua MPS</SelectItem>
                    <SelectItem value="mps">MPS</SelectItem>
                    <SelectItem value="non_mps">Non-MPS</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  onValueChange={(value) => {
                    setSelectedIuran(value);
                    setPagination({ ...pagination, pageIndex: 0 });
                  }}
                  value={selectedIuran}
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Status Iuran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Iuran</SelectItem>
                    <SelectItem value="sudah_ttd">Sudah TTD</SelectItem>
                    <SelectItem value="belum_ttd">Belum TTD</SelectItem>
                    <SelectItem value="tidak_iuran">Tidak Iuran</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={() => setImportModalOpen(true)} className="flex-1 sm:flex-none">
                  <FileSpreadsheet className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Import Excel</span>
                  <span className="sm:hidden">Import</span>
                </Button>
                <Button onClick={() => setAddModalOpen(true)} className="flex-1 sm:flex-none">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">Tambah Anggota</span>
                  <span className="sm:hidden ml-1">Tambah</span>
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
                      const hideOnMobile = columnId === 'no' || accessorKey === 'jenis_anggota' || accessorKey === 'status_iuran' || accessorKey === 'cabang_domisili';
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
                          const hideOnMobile = columnId === 'no' || accessorKey === 'jenis_anggota' || accessorKey === 'status_iuran' || accessorKey === 'cabang_domisili';
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

      {/* Toast Notification */}
      <ToastNotification show={toast.show} message={toast.message} type={toast.type} onClose={hideToast} />
    </Fragment>
  );
}