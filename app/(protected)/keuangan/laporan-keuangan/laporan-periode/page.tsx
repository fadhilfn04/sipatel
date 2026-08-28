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
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
} from 'lucide-react';
import { useLaporanPeriodeList } from '@/lib/hooks/use-laporan-periode-api';
import { LaporanPeriode } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
    month: 'long',
    year: 'numeric',
  });
}

const getTipeLabel = (tipe: LaporanPeriode['tipe_laporan']) => {
  const tipeMap: Record<string, string> = {
    harian: 'Harian',
    bulanan: 'Bulanan',
    tahunan: 'Tahunan',
  };
  return tipeMap[tipe] || tipe;
};

const getStatusProps = (status: LaporanPeriode['status_laporan']) => {
  const statusMap: Record<
    string,
    {
      variant: 'success' | 'destructive' | 'warning' | 'secondary';
      label: string;
    }
  > = {
    draft: { variant: 'secondary', label: 'Draft' },
    generated: { variant: 'secondary', label: 'Generated' },
    verified: { variant: 'warning', label: 'Verified' },
    approved: { variant: 'success', label: 'Approved' },
  };
  return statusMap[status] || { variant: 'secondary', label: status };
};

export default function LaporanPeriodePage() {
  const [reportType, setReportType] = useState<
    'harian' | 'bulanan' | 'tahunan'
  >('bulanan');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const itemsPerPage = 10;

  // Fetch data from API
  const { data: laporanData, isLoading } = useLaporanPeriodeList({
    tipe_laporan: reportType,
    year: selectedYear,
    month: selectedMonth !== 'all' ? selectedMonth : undefined,
    status_laporan: selectedStatus as
      | LaporanPeriode['status_laporan']
      | undefined,
    page: currentPage,
    limit: itemsPerPage,
  });

  const reports = laporanData?.data || [];
  const pagination = laporanData?.pagination;
  const totalCount = pagination?.total || 0;
  const totalPages = pagination?.totalPages || 1;

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [reportType, selectedYear, selectedMonth, selectedStatus]);

  // Calculate summary statistics from current page data
  const summaryStats = {
    totalRevenue: reports.reduce((sum, r) => sum + r.total_pendapatan, 0),
    totalExpenses: reports.reduce((sum, r) => sum + r.total_pengeluaran, 0),
    totalProfit: reports.reduce((sum, r) => sum + r.laba_bersih, 0),
    totalTransactions: reports.reduce((sum, r) => sum + r.jumlah_transaksi, 0),
  };

  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Laporan Periode"
            description="Laporan harian, bulanan, dan tahunan"
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

          {/* Report Type Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Pilih Jenis Laporan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <Select
                  value={reportType}
                  onValueChange={(value: any) => setReportType(value)}
                >
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Jenis Laporan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="harian">Laporan Harian</SelectItem>
                    <SelectItem value="bulanan">Laporan Bulanan</SelectItem>
                    <SelectItem value="tahunan">Laporan Tahunan</SelectItem>
                  </SelectContent>
                </Select>

                {reportType === 'tahunan' && (
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Tahun" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2026">2026</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2024">2024</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {reportType === 'bulanan' && (
                  <>
                    <Select
                      value={selectedYear}
                      onValueChange={setSelectedYear}
                    >
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue placeholder="Tahun" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2026">2026</SelectItem>
                        <SelectItem value="2025">2025</SelectItem>
                        <SelectItem value="2024">2024</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={selectedMonth}
                      onValueChange={setSelectedMonth}
                    >
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue placeholder="Bulan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Bulan</SelectItem>
                        <SelectItem value="1">Januari</SelectItem>
                        <SelectItem value="2">Februari</SelectItem>
                        <SelectItem value="3">Maret</SelectItem>
                        <SelectItem value="4">April</SelectItem>
                        <SelectItem value="5">Mei</SelectItem>
                        <SelectItem value="6">Juni</SelectItem>
                        <SelectItem value="7">Juli</SelectItem>
                        <SelectItem value="8">Agustus</SelectItem>
                        <SelectItem value="9">September</SelectItem>
                        <SelectItem value="10">Oktober</SelectItem>
                        <SelectItem value="11">November</SelectItem>
                        <SelectItem value="12">Desember</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                )}

                <Select
                  value={selectedStatus}
                  onValueChange={setSelectedStatus}
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="generated">Generated</SelectItem>
                    <SelectItem value="verified">Terverifikasi</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Report Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Pendapatan
                </CardTitle>
                <div className="h-4 w-4 rounded-full bg-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summaryStats.totalRevenue)}
                </div>
                <p className="text-xs text-green-600 mt-1">
                  Dari {reports.length} laporan
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Pengeluaran
                </CardTitle>
                <div className="h-4 w-4 rounded-full bg-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summaryStats.totalExpenses)}
                </div>
                <p className="text-xs text-red-600 mt-1">
                  Dari {reports.length} laporan
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Laba Bersih
                </CardTitle>
                <div className="h-4 w-4 rounded-full bg-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summaryStats.totalProfit)}
                </div>
                <p className="text-xs text-green-600 mt-1">
                  Marjin:{' '}
                  {summaryStats.totalRevenue > 0
                    ? (
                        (summaryStats.totalProfit / summaryStats.totalRevenue) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Transaksi</CardTitle>
                <FileText className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryStats.totalTransactions}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total transaksi
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Reports List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Laporan {getTipeLabel(reportType)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-24 flex items-center justify-center">
                  <p className="text-muted-foreground">Memuat data...</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {reports.length > 0 ? (
                      reports.map((report) => {
                        const statusProps = getStatusProps(
                          report.status_laporan,
                        );
                        const isExpanded = expandedRows.has(report.id);

                        return (
                          <div
                            key={report.id}
                            className="border border-border rounded-lg overflow-hidden"
                          >
                            {/* Summary Row */}
                            <div
                              className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => toggleRow(report.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                  {isExpanded ? (
                                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                  )}
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="font-semibold">
                                        {formatDate(report.tanggal_mulai)} -{' '}
                                        {formatDate(report.tanggal_selesai)}
                                      </p>
                                      <Badge
                                        variant={statusProps.variant}
                                        className="text-xs"
                                      >
                                        {statusProps.label}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {report.jumlah_transaksi} transaksi
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-6">
                                  <div className="text-right">
                                    <p className="text-sm text-muted-foreground">
                                      Pendapatan
                                    </p>
                                    <p className="font-semibold text-green-600">
                                      {formatCurrency(report.total_pendapatan)}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm text-muted-foreground">
                                      Pengeluaran
                                    </p>
                                    <p className="font-semibold text-red-600">
                                      {formatCurrency(report.total_pengeluaran)}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm text-muted-foreground">
                                      Laba
                                    </p>
                                    <p className="font-bold text-blue-600">
                                      {formatCurrency(report.laba_bersih)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="border-t border-border p-4 bg-muted/30">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                  <div className="space-y-2">
                                    <p className="text-sm font-medium">
                                      Rincian Pendapatan
                                    </p>
                                    <div className="space-y-1 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Sumbangan Anggota
                                        </span>
                                        <span>
                                          {formatCurrency(
                                            report.sumbangan_anggota,
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Dana Kematian
                                        </span>
                                        <span>
                                          {formatCurrency(report.dana_kematian)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Dana Sosial
                                        </span>
                                        <span>
                                          {formatCurrency(report.dana_sosial)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Pendapatan Investasi
                                        </span>
                                        <span>
                                          {formatCurrency(
                                            report.pendapatan_investasi,
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Pendapatan Jasa
                                        </span>
                                        <span>
                                          {formatCurrency(
                                            report.pendapatan_jasa,
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Pendapatan Lainnya
                                        </span>
                                        <span>
                                          {formatCurrency(
                                            report.pendapatan_lainnya,
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <p className="text-sm font-medium">
                                      Rincian Pengeluaran
                                    </p>
                                    <div className="space-y-1 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Klaim Kematian
                                        </span>
                                        <span>
                                          {formatCurrency(
                                            report.klaim_kematian,
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Bantuan Sosial
                                        </span>
                                        <span>
                                          {formatCurrency(
                                            report.bantuan_sosial,
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Operasional
                                        </span>
                                        <span>
                                          {formatCurrency(report.operasional)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Gaji & Tunjangan
                                        </span>
                                        <span>
                                          {formatCurrency(
                                            report.gaji_dan_tunjangan,
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Biaya Administrasi
                                        </span>
                                        <span>
                                          {formatCurrency(
                                            report.biaya_administrasi,
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Pengeluaran Lainnya
                                        </span>
                                        <span>
                                          {formatCurrency(
                                            report.pengeluaran_lainnya,
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <p className="text-sm font-medium">
                                      Arus Kas
                                    </p>
                                    <div className="space-y-1 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Kas Masuk
                                        </span>
                                        <span className="text-green-600">
                                          {formatCurrency(report.kas_masuk)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Kas Keluar
                                        </span>
                                        <span className="text-red-600">
                                          {formatCurrency(report.kas_keluar)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Arus Kas Bersih
                                        </span>
                                        <span className="font-semibold">
                                          {formatCurrency(
                                            report.arus_kas_bersih,
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <p className="text-sm font-medium">Aksi</p>
                                    <div className="flex flex-col gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                      >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download PDF
                                      </Button>
                                      {report.file_laporan && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="w-full"
                                          asChild
                                        >
                                          <a
                                            href={report.file_laporan}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                          >
                                            <FileText className="h-4 w-4 mr-2" />
                                            Lihat File
                                          </a>
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Neraca Summary if available */}
                                {report.total_aset > 0 && (
                                  <div className="mt-4 pt-4 border-t border-border">
                                    <p className="text-sm font-medium mb-2">
                                      Neraca
                                    </p>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Total Aset
                                        </span>
                                        <span className="font-semibold">
                                          {formatCurrency(report.total_aset)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Total Kewajiban
                                        </span>
                                        <span className="font-semibold">
                                          {formatCurrency(
                                            report.total_kewajiban,
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Total Ekuitas
                                        </span>
                                        <span className="font-semibold">
                                          {formatCurrency(report.total_ekuitas)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        Tidak ada laporan ditemukan untuk filter yang dipilih
                      </p>
                    )}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                      <div className="text-sm text-muted-foreground">
                        Menampilkan {(currentPage - 1) * itemsPerPage + 1} -{' '}
                        {Math.min(currentPage * itemsPerPage, totalCount)} dari{' '}
                        {totalCount} laporan
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
                          ←
                        </Button>
                        <span className="text-sm">
                          Halaman {currentPage} dari {totalPages}
                        </span>
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
                          →
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Available Reports Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Laporan Tersedia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-lg border border-border">
                  <div className="p-2 rounded-lg bg-green-500/10 text-green-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Laporan Harian</p>
                    <p className="text-sm text-muted-foreground">
                      Dibuat otomatis setiap hari
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg border border-border">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Laporan Bulanan</p>
                    <p className="text-sm text-muted-foreground">
                      Dibuat otomatis setiap bulan
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg border border-border">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Laporan Tahunan</p>
                    <p className="text-sm text-muted-foreground">
                      Dibuat otomatis setiap tahun
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Report Schedule Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Jadwal Pembuatan Laporan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Laporan Harian</p>
                      <p className="text-sm text-muted-foreground">
                        Dibuat otomatis setiap hari pukul 23:59
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">Otomatis</Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Laporan Bulanan</p>
                      <p className="text-sm text-muted-foreground">
                        Dibuat otomatis pada akhir setiap bulan
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">Otomatis</Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="font-medium">Laporan Tahunan</p>
                      <p className="text-sm text-muted-foreground">
                        Dibuat otomatis pada akhir setiap tahun
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">Otomatis</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Container>
    </Fragment>
  );
}
