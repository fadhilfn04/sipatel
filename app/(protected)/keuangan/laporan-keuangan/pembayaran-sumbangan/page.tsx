'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import {
  ArrowLeft,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  Plus,
  Search,
  XCircle,
} from 'lucide-react';
import { usePembayaranSumbanganList } from '@/lib/hooks/use-pembayaran-sumbangan-api';
import { PembayaranSumbangan } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Container } from '@/components/common/container';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const getStatusProps = (status: PembayaranSumbangan['status_pembayaran']) => {
  const statusMap: Record<
    string,
    {
      variant: 'success' | 'destructive' | 'warning' | 'secondary';
      label: string;
      icon: any;
    }
  > = {
    paid: { variant: 'success', label: 'Lunas', icon: CheckCircle },
    pending: { variant: 'warning', label: 'Pending', icon: Clock },
    failed: { variant: 'destructive', label: 'Gagal', icon: XCircle },
  };
  return (
    statusMap[status] || { variant: 'secondary', label: status, icon: FileText }
  );
};

const getTipeLabel = (tipe: PembayaranSumbangan['tipe_sumbangan']) => {
  const tipeMap: Record<string, string> = {
    sumbangan_bulanan: 'Sumbangan Bulanan',
    sumbangan_kematian: 'Sumbangan Kematian',
    sumbangan_khusus: 'Sumbangan Khusus',
    sumbangan_investasi: 'Sumbangan Investasi',
    sumbangan_lainnya: 'Sumbangan Lainnya',
  };
  return tipeMap[tipe] || tipe;
};

export default function PembayaranSumbanganPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch data from API
  const { data: paymentData, isLoading } = usePembayaranSumbanganList({
    search: searchQuery,
    status_pembayaran: selectedStatus as
      | PembayaranSumbangan['status_pembayaran']
      | undefined,
    tipe_sumbangan: selectedType as
      | PembayaranSumbangan['tipe_sumbangan']
      | undefined,
    page: currentPage,
    limit: itemsPerPage,
  });

  const payments = paymentData?.data || [];
  const pagination = paymentData?.pagination;
  const totalCount = pagination?.total || 0;
  const totalPages = pagination?.totalPages || 1;

  // Calculate summary statistics
  const summaryData = {
    totalPaid: payments
      .filter((p) => p.status_pembayaran === 'paid')
      .reduce((sum, p) => sum + p.jumlah_pembayaran, 0),
    totalPending: payments
      .filter((p) => p.status_pembayaran === 'pending')
      .reduce((sum, p) => sum + p.jumlah_pembayaran, 0),
    totalFailed: payments
      .filter((p) => p.status_pembayaran === 'failed')
      .reduce((sum, p) => sum + p.jumlah_pembayaran, 0),
    totalTransactions: totalCount,
    averageAmount:
      payments.length > 0
        ? payments.reduce((sum, p) => sum + p.jumlah_pembayaran, 0) /
          payments.length
        : 0,
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus, selectedType]);

  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Pembayaran Sumbangan"
            description="Pembayaran sumbangan anggota"
          />
          <ToolbarActions>
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Ekspor
            </Button>
          </ToolbarActions>
        </Toolbar>
      </Container>

      <Container>
        <div className="space-y-5 lg:space-y-7.5">
          {/* Back Button */}
          <Link href="/keuangan/laporan-keuangan">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
          </Link>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Terbayar
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summaryData.totalPaid)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {
                    payments.filter((p) => p.status_pembayaran === 'paid')
                      .length
                  }{' '}
                  transaksi
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Tertunda</CardTitle>
                <Clock className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summaryData.totalPending)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Menunggu konfirmasi
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Gagal</CardTitle>
                <XCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summaryData.totalFailed)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Perlu ditangani
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Rata-rata</CardTitle>
                <div className="h-4 w-4 rounded-full bg-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summaryData.averageAmount)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Per transaksi
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Payment Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Daftar Pembayaran</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari nama, NIK, atau referensi..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
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
                <Select
                  value={selectedStatus}
                  onValueChange={setSelectedStatus}
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="paid">Lunas</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Gagal</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Semua Tipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Tipe</SelectItem>
                    <SelectItem value="sumbangan_bulanan">
                      Sumbangan Bulanan
                    </SelectItem>
                    <SelectItem value="sumbangan_kematian">
                      Sumbangan Kematian
                    </SelectItem>
                    <SelectItem value="sumbangan_khusus">
                      Sumbangan Khusus
                    </SelectItem>
                    <SelectItem value="sumbangan_investasi">
                      Sumbangan Investasi
                    </SelectItem>
                    <SelectItem value="sumbangan_lainnya">
                      Sumbangan Lainnya
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tidak</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Nama Anggota</TableHead>
                      <TableHead>NIK</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Jumlah</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Referensi</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center">
                          Memuat data...
                        </TableCell>
                      </TableRow>
                    ) : payments.length > 0 ? (
                      payments.map((payment, index) => {
                        const statusProps = getStatusProps(
                          payment.status_pembayaran,
                        );
                        const StatusIcon = statusProps.icon;
                        return (
                          <TableRow key={payment.id}>
                            <TableCell className="font-medium">
                              {index + 1 + (currentPage - 1) * itemsPerPage}
                            </TableCell>
                            <TableCell>
                              {formatDate(payment.tanggal_transaksi)}
                            </TableCell>
                            <TableCell className="font-medium">
                              {payment.nama_anggota}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {payment.nik || '-'}
                            </TableCell>
                            <TableCell>
                              {getTipeLabel(payment.tipe_sumbangan)}
                            </TableCell>
                            <TableCell className="font-semibold">
                              {formatCurrency(payment.jumlah_pembayaran)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={statusProps.variant}
                                className="gap-1.5"
                              >
                                <StatusIcon className="h-3 w-3" />
                                {statusProps.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {payment.nomor_referensi || '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="h-24 text-center text-muted-foreground"
                        >
                          Tidak ada data pembayaran ditemukan
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Menampilkan {(currentPage - 1) * itemsPerPage + 1} -{' '}
                    {Math.min(currentPage * itemsPerPage, totalCount)} dari{' '}
                    {totalCount} data
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-sm">
                      Halaman {currentPage} dari {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Statistik Pembayaran</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Berhasil</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">
                      {formatCurrency(summaryData.totalPaid)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {summaryData.totalPaid > 0
                        ? (
                            (summaryData.totalPaid /
                              (summaryData.totalPaid +
                                summaryData.totalPending +
                                summaryData.totalFailed)) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium">Pending</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-yellow-600">
                      {formatCurrency(summaryData.totalPending)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {summaryData.totalPending > 0
                        ? (
                            (summaryData.totalPending /
                              (summaryData.totalPaid +
                                summaryData.totalPending +
                                summaryData.totalFailed)) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="font-medium">Gagal</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">
                      {formatCurrency(summaryData.totalFailed)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {summaryData.totalFailed > 0
                        ? (
                            (summaryData.totalFailed /
                              (summaryData.totalPaid +
                                summaryData.totalPending +
                                summaryData.totalFailed)) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Type Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tipe Sumbangan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  'sumbangan_bulanan',
                  'sumbangan_kematian',
                  'sumbangan_khusus',
                  'sumbangan_investasi',
                  'sumbangan_lainnya',
                ].map((tipe) => {
                  const typePayments = payments.filter(
                    (p) => p.tipe_sumbangan === tipe,
                  );
                  const total = typePayments.reduce(
                    (sum, p) => sum + p.jumlah_pembayaran,
                    0,
                  );
                  const percentage =
                    payments.length > 0
                      ? (total /
                          payments.reduce(
                            (sum, p) => sum + p.jumlah_pembayaran,
                            0,
                          )) *
                        100
                      : 0;

                  if (typePayments.length === 0) return null;

                  return (
                    <div key={tipe} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {getTipeLabel(
                            tipe as PembayaranSumbangan['tipe_sumbangan'],
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {typePayments.length} pembayaran
                          </span>
                          <span className="text-muted-foreground">
                            {percentage.toFixed(1)}%
                          </span>
                          <span className="font-semibold">
                            {formatCurrency(total)}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </Container>
    </Fragment>
  );
}
