'use client';

import { Fragment, useState, useMemo } from 'react';
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
  Search,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Eye,
  ChevronsLeft,
  ChevronsRight,
  Users,
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
import { useNikMasterList, useNikKepemilikanList } from '@/lib/hooks/use-nik-inheritance-api';
import { toast } from 'sonner';

export default function PewarasanNikPage() {
  // State
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // API hooks
  const { data: nikMasterData, isLoading } = useNikMasterList({
    search: searchQuery,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  });

  // Helper functions
  const getStatusProps = (status: string) => {
    const statusMap: Record<string, { variant: 'success' | 'destructive' | 'warning' | 'secondary'; label: string }> = {
      aktif: { variant: 'success', label: 'Aktif' },
      non_aktif: { variant: 'secondary', label: 'Non-Aktif' },
      meninggal: { variant: 'destructive', label: 'Meninggal' },
      dicabut: { variant: 'warning', label: 'Dicabut' },
    };
    return statusMap[status] || { variant: 'secondary', label: status };
  };

  const getHubunganLabel = (hubungan: string | null) => {
    if (!hubungan) return '-';
    const hubunganMap: Record<string, string> = {
      istri: 'Istri',
      suami: 'Suami',
      anak_1: 'Anak 1',
      anak_2: 'Anak 2',
      anak_3: 'Anak 3',
    };
    return hubunganMap[hubungan] || hubungan;
  };

  // Table columns
  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        accessorKey: 'no',
        header: 'NO',
        cell: ({ row }) => row.index + 1 + pagination.pageIndex * pagination.pageSize,
      },
      {
        accessorKey: 'nik',
        header: 'NIK',
        cell: ({ row }) => (
          <span className="font-mono text-xs sm:text-sm">{row.original.nik_master?.nik || row.original.nik}</span>
        ),
      },
      {
        accessorKey: 'nama_anggota',
        header: 'NAMA AHLI WARIS',
        cell: ({ row }) => (
          <div className="font-medium text-xs sm:text-sm">
            {row.original.anggota_id || '-'}
          </div>
        ),
      },
      {
        accessorKey: 'hubungan',
        header: 'HUBUNGAN',
        cell: ({ row }) => (
          <span className="text-xs sm:text-sm capitalize">
            {getHubunganLabel(row.original.hubungan)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'STATUS',
        cell: ({ row }) => {
          const props = getStatusProps(row.original.status);
          return (
            <Badge variant={props.variant} appearance="ghost" className="text-xs">
              <BadgeDot />
              {props.label}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'is_current',
        header: 'CURRENT',
        cell: ({ row }) => (
          row.original.is_current ? (
            <Badge variant="success" appearance="ghost" className="text-xs">
              Yes
            </Badge>
          ) : (
            <Badge variant="secondary" appearance="ghost" className="text-xs">
              No
            </Badge>
          )
        ),
      },
      {
        accessorKey: 'tanggal_mulai',
        header: 'TANGGAL MULAI',
        cell: ({ row }) => (
          <span className="text-xs sm:text-sm">
            {row.original.tanggal_mulai
              ? new Date(row.original.tanggal_mulai).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : '-'}
          </span>
        ),
      },
      {
        accessorKey: 'tanggal_selesai',
        header: 'TANGGAL SELESAI',
        cell: ({ row }) => (
          <span className="text-xs sm:text-sm">
            {row.original.tanggal_selesai
              ? new Date(row.original.tanggal_selesai).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : 'Sekarang'}
          </span>
        ),
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
            >
              <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button
              mode="icon"
              variant="dim"
              size="sm"
              className="h-6 w-6 sm:h-7 sm:w-7"
              title="Edit"
            >
              <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [pagination.pageIndex, pagination.pageSize]
  );

  const table = useReactTable({
    columns,
    data: nikMasterData?.data || [],
    pageCount: nikMasterData?.pagination?.totalPages || 1,
    getRowId: (row: any) => row.id,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
  });

  const totalCount = nikMasterData?.pagination?.total || 0;

  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading title="Pewarasan NIK" description="Kelola pewarisan NIK pensiunan" />
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
                    placeholder="Cari NIK atau nama..."
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
                    setStatusFilter(value);
                    setPagination({ ...pagination, pageIndex: 0 });
                  }}
                  value={statusFilter}
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="aktif">Aktif</SelectItem>
                    <SelectItem value="non_aktif">Non-Aktif</SelectItem>
                    <SelectItem value="meninggal">Meninggal</SelectItem>
                    <SelectItem value="dicabut">Dicabut</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button variant="outline" className="flex-1 sm:flex-none">
                  <FileText className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Export Data</span>
                  <span className="sm:hidden">Export</span>
                </Button>
                <Button className="flex-1 sm:flex-none">
                  <Users className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline ml-1">Tambah Pewarisan</span>
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
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="px-3 py-3 text-xs sm:px-4 sm:py-3 sm:text-sm"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
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
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className="px-3 py-3 text-xs sm:px-4 sm:py-3 sm:text-sm"
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
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
    </Fragment>
  );
}
