'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Search,
} from 'lucide-react';
import { useArusKasList } from '@/lib/hooks/use-arus-kas-api';
import { ArusKas } from '@/lib/supabase';
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

const getKategoriLabel = (kategori: ArusKas['kategori_transaksi']) => {
  const kategoriMap: Record<string, string> = {
    sumbangan_anggota: 'Sumbangan Anggota',
    dana_kematian: 'Dana Kematian',
    dana_sosial: 'Dana Sosial',
    iuran_bulanan: 'Iuran Bulanan',
    pendapatan_investasi: 'Pendapatan Investasi',
    pendapatan_jasa: 'Pendapatan Jasa',
    pendapatan_lainnya: 'Pendapatan Lainnya',
    klaim_kematian: 'Klaim Kematian',
    bantuan_sosial: 'Bantuan Sosial',
    operasional: 'Operasional',
    gaji_dan_tunjangan: 'Gaji & Tunjangan',
    biaya_administrasi: 'Biaya Administrasi',
    biaya_pemasaran: 'Biaya Pemasaran',
    penyusutan: 'Penyusutan',
    pengeluaran_lainnya: 'Pengeluaran Lainnya',
  };
  return kategoriMap[kategori] || kategori;
};

export default function ArusKasPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJenis, setSelectedJenis] = useState<string>('all');
  const [selectedKategori, setSelectedKategori] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch data from API
  const { data: arusKasData, isLoading } = useArusKasList({
    search: searchQuery,
    jenis_transaksi: selectedJenis as ArusKas['jenis_transaksi'] | undefined,
    kategori_transaksi: selectedKategori as
      | ArusKas['kategori_transaksi']
      | undefined,
    page: currentPage,
    limit: itemsPerPage,
  });

  const transactions = arusKasData?.data || [];
  const pagination = arusKasData?.pagination;
  const totalCount = pagination?.total || 0;
  const totalPages = pagination?.totalPages || 1;

  // Calculate summary
  const totalInflow = transactions
    .filter((t) => t.jenis_transaksi === 'masuk')
    .reduce((sum, t) => sum + t.jumlah_transaksi, 0);
  const totalOutflow = transactions
    .filter((t) => t.jenis_transaksi === 'keluar')
    .reduce((sum, t) => sum + t.jumlah_transaksi, 0);
  const netCashFlow = totalInflow - totalOutflow;

  const cashInflows = transactions.filter((t) => t.jenis_transaksi === 'masuk');
  const cashOutflows = transactions.filter(
    (t) => t.jenis_transaksi === 'keluar',
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedJenis, selectedKategori]);

  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Arus Kas"
            description="Laporan aliran masuk dan keluarnya uang"
          />
          <ToolbarActions>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
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
                  Total Kas Masuk
                </CardTitle>
                <ArrowDownLeft className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(totalInflow)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {cashInflows.length} transaksi
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Kas Keluar
                </CardTitle>
                <ArrowUpRight className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(totalOutflow)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {cashOutflows.length} transaksi
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Arus Kas Bersih
                </CardTitle>
                <div className="h-4 w-4 rounded-full bg-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(netCashFlow)}
                </div>
                <p className="text-xs text-green-600 mt-1">
                  {netCashFlow >= 0 ? '+' : ''}
                  {((netCashFlow / (totalInflow || 1)) * 100).toFixed(1)}% dari
                  masuk
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Transaksi
                </CardTitle>
                <div className="h-4 w-4 rounded-full bg-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCount}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Periode ini
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filter Transaksi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari deskripsi atau referensi..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                  {searchQuery.length > 0 && (
                    <Button
                      mode="icon"
                      variant="dim"
                      className="absolute inset-e-1.5 top-1/2 -translate-y-1/2 h-6 w-6"
                      onClick={() => setSearchQuery('')}
                    >
                      ×
                    </Button>
                  )}
                </div>
                <Select value={selectedJenis} onValueChange={setSelectedJenis}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Semua Jenis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Jenis</SelectItem>
                    <SelectItem value="masuk">Kas Masuk</SelectItem>
                    <SelectItem value="keluar">Kas Keluar</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={selectedKategori}
                  onValueChange={setSelectedKategori}
                >
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Semua Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kategori</SelectItem>
                    <SelectItem value="sumbangan_anggota">
                      Sumbangan Anggota
                    </SelectItem>
                    <SelectItem value="dana_kematian">Dana Kematian</SelectItem>
                    <SelectItem value="dana_sosial">Dana Sosial</SelectItem>
                    <SelectItem value="pendapatan_investasi">
                      Pendapatan Investasi
                    </SelectItem>
                    <SelectItem value="operasional">Operasional</SelectItem>
                    <SelectItem value="gaji_dan_tunjangan">
                      Gaji & Tunjangan
                    </SelectItem>
                    <SelectItem value="klaim_kematian">
                      Klaim Kematian
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Cash Inflows & Outflows */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
            {/* Cash Inflows */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowDownLeft className="h-5 w-5 text-green-600" />
                  Kas Masuk
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {cashInflows.length > 0 ? (
                    cashInflows.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {transaction.deskripsi}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span>
                              {getKategoriLabel(transaction.kategori_transaksi)}
                            </span>
                            <span>•</span>
                            <span>
                              {formatDate(transaction.tanggal_transaksi)}
                            </span>
                            {transaction.nomor_referensi && (
                              <>
                                <span>•</span>
                                <span className="font-mono">
                                  {transaction.nomor_referensi}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-3">
                          <p className="font-semibold text-green-600">
                            +{formatCurrency(transaction.jumlah_transaksi)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Tidak ada kas masuk
                    </p>
                  )}
                </div>
                {cashInflows.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Total Kas Masuk</span>
                      <span className="font-bold text-lg text-green-600">
                        {formatCurrency(totalInflow)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cash Outflows */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowUpRight className="h-5 w-5 text-red-600" />
                  Kas Keluar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {cashOutflows.length > 0 ? (
                    cashOutflows.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {transaction.deskripsi}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span>
                              {getKategoriLabel(transaction.kategori_transaksi)}
                            </span>
                            <span>•</span>
                            <span>
                              {formatDate(transaction.tanggal_transaksi)}
                            </span>
                            {transaction.nomor_referensi && (
                              <>
                                <span>•</span>
                                <span className="font-mono">
                                  {transaction.nomor_referensi}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-3">
                          <p className="font-semibold text-red-600">
                            -{formatCurrency(transaction.jumlah_transaksi)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Tidak ada kas keluar
                    </p>
                  )}
                </div>
                {cashOutflows.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Total Kas Keluar</span>
                      <span className="font-bold text-lg text-red-600">
                        {formatCurrency(totalOutflow)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* All Transactions Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Semua Transaksi</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-24 flex items-center justify-center">
                  <p className="text-muted-foreground">Memuat data...</p>
                </div>
              ) : (
                <>
                  <div className="rounded-md border border-border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Jenis</TableHead>
                          <TableHead>Kategori</TableHead>
                          <TableHead>Deskripsi</TableHead>
                          <TableHead className="text-right">Jumlah</TableHead>
                          <TableHead>Referensi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.length > 0 ? (
                          transactions.map((transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell>
                                {formatDate(transaction.tanggal_transaksi)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    transaction.jenis_transaksi === 'masuk'
                                      ? 'success'
                                      : 'destructive'
                                  }
                                  className="gap-1.5"
                                >
                                  {transaction.jenis_transaksi === 'masuk' ? (
                                    <ArrowDownLeft className="h-3 w-3" />
                                  ) : (
                                    <ArrowUpRight className="h-3 w-3" />
                                  )}
                                  {transaction.jenis_transaksi === 'masuk'
                                    ? 'Masuk'
                                    : 'Keluar'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {getKategoriLabel(
                                  transaction.kategori_transaksi,
                                )}
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {transaction.deskripsi}
                              </TableCell>
                              <TableCell
                                className={`text-right font-semibold ${transaction.jenis_transaksi === 'masuk' ? 'text-green-600' : 'text-red-600'}`}
                              >
                                {transaction.jenis_transaksi === 'masuk'
                                  ? '+'
                                  : '-'}
                                {formatCurrency(transaction.jumlah_transaksi)}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {transaction.nomor_referensi || '-'}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="h-24 text-center text-muted-foreground"
                            >
                              Tidak ada data transaksi ditemukan
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
                            setCurrentPage((prev) =>
                              Math.min(prev + 1, totalPages),
                            )
                          }
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Cash Flow Statement Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Ringkasan Laporan Arus Kas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-green-500/10">
                  <span className="font-medium">Total Kas Masuk</span>
                  <span className="font-bold text-green-600">
                    +{formatCurrency(totalInflow)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-red-500/10">
                  <span className="font-medium">Total Kas Keluar</span>
                  <span className="font-bold text-red-600">
                    -{formatCurrency(totalOutflow)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-blue-500/10 border-2 border-blue-500/20">
                  <span className="font-bold text-lg">Arus Kas Bersih</span>
                  <span
                    className={`font-bold text-xl ${netCashFlow >= 0 ? 'text-blue-600' : 'text-red-600'}`}
                  >
                    {formatCurrency(netCashFlow)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Container>
    </Fragment>
  );
}
