'use client';

import { Fragment, useState } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import { Container } from '@/components/common/container';
import Link from 'next/link';
import {
  TrendingUp, DollarSign, FileText, PiggyBank, Heart, Users,
  Calendar, BarChart3, RefreshCw, ChevronRight, ArrowRight,
  CheckCircle2, Clock, XCircle, Activity, Banknote, Wallet,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, BadgeDot } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardKeuangan } from '@/lib/hooks/use-dashboard-keuangan-api';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);

const formatNumber = (n: number) => new Intl.NumberFormat('id-ID').format(n);

const PERIOD_OPTIONS = [
  { key: 'today' as const, label: 'Hari Ini' },
  { key: 'week' as const, label: 'Minggu Ini' },
  { key: 'month' as const, label: 'Bulan Ini' },
  { key: 'year' as const, label: 'Tahun Ini' },
];

const STATUS_MAP = [
  { key: 'dilaporkan', label: 'Dilaporkan', color: 'bg-slate-500', light: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  { key: 'verifikasi_cabang', label: 'Verifikasi Cabang', color: 'bg-blue-500', light: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  { key: 'proses_pusat', label: 'Proses Pusat', color: 'bg-orange-500', light: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  { key: 'selesai', label: 'Selesai', color: 'bg-green-500', light: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  { key: 'ditolak', label: 'Ditolak', color: 'bg-red-500', light: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
];

export default function LaporanKeuanganPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');

  const { data, isLoading, refetch } = useDashboardKeuangan({ period: selectedPeriod });
  const ov = data?.overview;
  const klaimByStatus = data?.klaimByStatus || {};
  const totalKlaimAll = ov?.totalKlaim || 0;

  // Report categories — use real data where available
  const reportCategories = [
    {
      title: 'Ringkasan Keuangan',
      description: 'Ikhtisar kondisi keuangan organisasi secara real-time',
      icon: BarChart3,
      href: '/keuangan/laporan-keuangan/ringkasan',
      colorBorder: 'border-l-blue-500',
      colorIcon: 'text-blue-600 dark:text-blue-400',
      colorIconBg: 'bg-blue-50 dark:bg-blue-950',
      stats: ov ? [
        { label: 'Kas Masuk', value: formatCurrency(ov.kasMasuk) },
        { label: 'Kas Keluar', value: formatCurrency(ov.kasKeluar) },
        { label: 'Saldo', value: formatCurrency(ov.cashBalance) },
      ] : null,
    },
    {
      title: 'Arus Kas',
      description: 'Laporan aliran masuk dan keluarnya uang',
      icon: TrendingUp,
      href: '/keuangan/laporan-keuangan/arus-kas',
      colorBorder: 'border-l-green-500',
      colorIcon: 'text-green-600 dark:text-green-400',
      colorIconBg: 'bg-green-50 dark:bg-green-950',
      stats: ov ? [
        { label: 'Kas Masuk', value: formatCurrency(ov.kasMasuk) },
        { label: 'Kas Keluar', value: formatCurrency(ov.kasKeluar) },
        { label: 'Arus Kas Bersih', value: formatCurrency(ov.kasMasuk - ov.kasKeluar) },
      ] : null,
    },
    {
      title: 'Laba Rugi',
      description: 'Laporan pendapatan dan beban operasional',
      icon: FileText,
      href: '/keuangan/laporan-keuangan/laba-rugi',
      colorBorder: 'border-l-purple-500',
      colorIcon: 'text-purple-600 dark:text-purple-400',
      colorIconBg: 'bg-purple-50 dark:bg-purple-950',
      stats: ov ? [
        { label: 'Pendapatan', value: formatCurrency(ov.kasMasuk) },
        { label: 'Beban', value: formatCurrency(ov.kasKeluar) },
        { label: 'Laba Bersih', value: formatCurrency(ov.kasMasuk - ov.kasKeluar) },
      ] : null,
    },
    {
      title: 'Neraca',
      description: 'Laporan posisi keuangan dan ekuitas',
      icon: Wallet,
      href: '/keuangan/laporan-keuangan/neraca',
      colorBorder: 'border-l-yellow-500',
      colorIcon: 'text-yellow-600 dark:text-yellow-400',
      colorIconBg: 'bg-yellow-50 dark:bg-yellow-950',
      stats: data ? [
        { label: 'Total Aset', value: formatCurrency(data.neraca.totalAset) },
        { label: 'Kewajiban', value: formatCurrency(data.neraca.totalKewajiban) },
        { label: 'Ekuitas', value: formatCurrency(data.neraca.totalEkuitas) },
      ] : null,
    },
    {
      title: 'Dana Kematian',
      description: 'Laporan dana kematian anggota berdasarkan data real',
      icon: PiggyBank,
      href: '/keuangan/laporan-keuangan/dana-kematian',
      colorBorder: 'border-l-rose-500',
      colorIcon: 'text-rose-600 dark:text-rose-400',
      colorIconBg: 'bg-rose-50 dark:bg-rose-950',
      stats: ov ? [
        { label: 'Total Nilai', value: formatCurrency(ov.totalNilaiKlaim) },
        { label: 'Sudah Selesai', value: formatCurrency(ov.nilaiSelesai) },
        { label: 'Total Klaim', value: formatNumber(ov.totalKlaim) },
      ] : null,
      badge: ov && ov.klaimAktif > 0 ? `${ov.klaimAktif} aktif` : undefined,
    },
    {
      title: 'Dana Sosial',
      description: 'Laporan dana sosial dan bantuan anggota',
      icon: Heart,
      href: '/keuangan/laporan-keuangan/dana-sosial',
      colorBorder: 'border-l-pink-500',
      colorIcon: 'text-pink-600 dark:text-pink-400',
      colorIconBg: 'bg-pink-50 dark:bg-pink-950',
      stats: data ? [
        { label: 'Total Dana', value: formatCurrency(data.danaSosial.totalDana) },
        { label: 'Disalurkan', value: formatCurrency(data.danaSosial.bantuanDiberikan) },
        { label: 'Sisa', value: formatCurrency(data.danaSosial.sisaDana) },
      ] : null,
    },
    {
      title: 'Pembayaran Sumbangan',
      description: 'Laporan pembayaran sumbangan anggota',
      icon: Banknote,
      href: '/keuangan/laporan-keuangan/pembayaran-sumbangan',
      colorBorder: 'border-l-emerald-500',
      colorIcon: 'text-emerald-600 dark:text-emerald-400',
      colorIconBg: 'bg-emerald-50 dark:bg-emerald-950',
      stats: data ? [
        { label: 'Terbayar', value: formatCurrency(data.pembayaranSumbangan.totalTerbayar) },
        { label: 'Tertunda', value: formatCurrency(data.pembayaranSumbangan.totalTertunda) },
        { label: 'Transaksi', value: formatNumber(data.pembayaranSumbangan.jumlahTransaksi) },
      ] : null,
    },
    {
      title: 'Laporan Periode',
      description: 'Laporan harian, bulanan, dan tahunan',
      icon: Calendar,
      href: '/keuangan/laporan-keuangan/laporan-periode',
      colorBorder: 'border-l-indigo-500',
      colorIcon: 'text-indigo-600 dark:text-indigo-400',
      colorIconBg: 'bg-indigo-50 dark:bg-indigo-950',
      stats: data ? [
        { label: 'Total Laporan', value: formatNumber(data.laporanPeriode.totalReports) },
        { label: 'Pending', value: formatNumber(data.laporanPeriode.pendingReports) },
        { label: 'Status', value: data.laporanPeriode.pendingReports > 0 ? 'Ada Pending' : 'Selesai' },
      ] : null,
    },
  ];

  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Laporan Keuangan"
            description="Pusat laporan dan analisis keuangan organisasi P2Tel"
          />
          <ToolbarActions>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Perbarui
            </Button>
          </ToolbarActions>
        </Toolbar>
      </Container>

      <Container>
        <div className="space-y-6 pb-8">

          {/* ── Hero Banner ── */}
          <div className="rounded-2xl bg-linear-to-br from-emerald-700 via-teal-600 to-cyan-700 p-6 shadow-lg text-white">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <p className="text-white/70 text-sm font-medium uppercase tracking-wide mb-1">
                  Laporan Keuangan
                </p>
                <h2 className="text-2xl font-bold">Pusat Data Keuangan Organisasi</h2>
                <p className="text-white/70 text-sm mt-1">
                  Data real-time dari sistem SIPATEL · Dana Kematian & Dana Sosial P2Tel
                </p>
              </div>

              {/* Period Selector */}
              <div className="flex flex-wrap gap-2">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setSelectedPeriod(opt.key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedPeriod === opt.key
                        ? 'bg-white text-teal-700 shadow-md'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Inline KPI row in the banner */}
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white/20 rounded-xl p-3 h-16 animate-pulse" />
                ))}
              </div>
            ) : ov && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                <div className="bg-white/15 rounded-xl p-3 border border-white/20">
                  <p className="text-white/70 text-xs">Anggota Aktif</p>
                  <p className="text-white text-2xl font-bold tabular-nums">{formatNumber(ov.anggotaAktif)}</p>
                  <p className="text-white/60 text-xs">dari {formatNumber(ov.totalAnggota)} total</p>
                </div>
                <div className="bg-white/15 rounded-xl p-3 border border-white/20">
                  <p className="text-white/70 text-xs">Total Klaim DK</p>
                  <p className="text-white text-2xl font-bold tabular-nums">{formatNumber(ov.totalKlaim)}</p>
                  <p className="text-white/60 text-xs">{formatNumber(ov.klaimAktif)} sedang proses</p>
                </div>
                <div className="bg-white/15 rounded-xl p-3 border border-white/20">
                  <p className="text-white/70 text-xs">Nilai DK Selesai</p>
                  <p className="text-white text-xl font-bold leading-tight">{formatCurrency(ov.nilaiSelesai)}</p>
                  <p className="text-white/60 text-xs">{formatNumber(ov.klaimSelesai)} klaim selesai</p>
                </div>
                <div className={`rounded-xl p-3 border ${ov.klaimAktif > 0 ? 'bg-yellow-400/20 border-yellow-300/40' : 'bg-white/15 border-white/20'}`}>
                  <p className="text-white/70 text-xs">Periode Ini</p>
                  <p className="text-white text-2xl font-bold tabular-nums">{formatNumber(ov.klaimPeriod)}</p>
                  <p className="text-white/60 text-xs">
                    {PERIOD_OPTIONS.find(p => p.key === selectedPeriod)?.label}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Dana Kematian Status Distribution ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PiggyBank className="h-5 w-5 text-rose-600" />
                  Distribusi Status Dana Kematian
                </CardTitle>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/pelayanan/dana-kematian" className="gap-1">
                    Kelola Pengajuan
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <div className="space-y-3">
                  {STATUS_MAP.map((s) => {
                    const count = klaimByStatus[s.key] || 0;
                    const pct = totalKlaimAll > 0 ? (count / totalKlaimAll) * 100 : 0;
                    return (
                      <div key={s.key} className="flex items-center gap-3">
                        <div className={`text-xs font-medium px-2 py-1 rounded-md w-36 text-center shrink-0 ${s.light}`}>
                          {s.label}
                        </div>
                        <div className="flex-1 h-7 bg-muted rounded-lg overflow-hidden relative">
                          <div
                            className={`h-full ${s.color} rounded-lg transition-all duration-700 flex items-center justify-end pr-2`}
                            style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
                          >
                            {pct >= 8 && (
                              <span className="text-xs font-semibold text-white">{pct.toFixed(0)}%</span>
                            )}
                          </div>
                          {pct > 0 && pct < 8 && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-foreground">
                              {pct.toFixed(0)}%
                            </span>
                          )}
                        </div>
                        <div className="text-right w-16 shrink-0">
                          <span className="text-lg font-bold tabular-nums">{count}</span>
                          <span className="text-xs text-muted-foreground ml-1">klaim</span>
                        </div>
                      </div>
                    );
                  })}

                  {totalKlaimAll === 0 && (
                    <p className="text-center text-muted-foreground py-6">
                      Belum ada data pengajuan dana kematian
                    </p>
                  )}

                  {totalKlaimAll > 0 && (
                    <div className="pt-3 border-t flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total semua pengajuan</span>
                      <div className="flex items-center gap-4">
                        <span className="font-semibold">{formatNumber(totalKlaimAll)} klaim</span>
                        {ov && (
                          <span className="font-bold text-rose-600">
                            {formatCurrency(ov.totalNilaiKlaim)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Active Claims Alert ── */}
          {!isLoading && ov && ov.klaimAktif > 0 && (
            <div className="flex items-center gap-3 rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950 p-4">
              <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-orange-800 dark:text-orange-200">
                  {formatNumber(ov.klaimAktif)} pengajuan dana kematian sedang dalam proses
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  Pastikan proses verifikasi dan persetujuan berjalan tepat waktu
                </p>
              </div>
              <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100 shrink-0" asChild>
                <Link href="/pelayanan/dana-kematian">Tinjau</Link>
              </Button>
            </div>
          )}

          {/* ── Quick Stats Row ── */}
          {!isLoading && ov && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="border-2 border-green-200 dark:border-green-800">
                <CardContent className="p-4 text-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400 tabular-nums">
                    {formatNumber(ov.klaimSelesai)}
                  </p>
                  <p className="text-xs text-muted-foreground">Selesai</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-orange-200 dark:border-orange-800">
                <CardContent className="p-4 text-center">
                  <Clock className="h-6 w-6 text-orange-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                    {formatNumber(ov.klaimAktif)}
                  </p>
                  <p className="text-xs text-muted-foreground">Dalam Proses</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-red-200 dark:border-red-800">
                <CardContent className="p-4 text-center">
                  <XCircle className="h-6 w-6 text-red-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">
                    {formatNumber(ov.klaimDitolak)}
                  </p>
                  <p className="text-xs text-muted-foreground">Ditolak</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-blue-200 dark:border-blue-800">
                <CardContent className="p-4 text-center">
                  <Users className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                    {formatNumber(ov.anggotaAktif)}
                  </p>
                  <p className="text-xs text-muted-foreground">Anggota Aktif</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Report Categories Grid ── */}
          <div>
            <h2 className="text-base font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Laporan Tersedia
            </h2>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <Skeleton key={i} className="h-44 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {reportCategories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <Link key={cat.href} href={cat.href} className="group">
                      <Card className={`h-full transition-all border-l-4 ${cat.colorBorder} hover:shadow-lg hover:-translate-y-0.5 duration-200`}>
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className={`h-10 w-10 rounded-xl ${cat.colorIconBg} flex items-center justify-center`}>
                              <Icon className={`h-5 w-5 ${cat.colorIcon}`} />
                            </div>
                            <div className="flex items-center gap-1">
                              {cat.badge && (
                                <Badge variant="warning" appearance="ghost" className="text-xs">
                                  {cat.badge}
                                </Badge>
                              )}
                              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                          </div>

                          <h3 className="font-semibold text-sm group-hover:text-primary transition-colors mb-1">
                            {cat.title}
                          </h3>
                          <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
                            {cat.description}
                          </p>

                          <div className="space-y-1.5 border-t pt-3">
                            {cat.stats ? (
                              cat.stats.map((stat, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">{stat.label}</span>
                                  <span className="font-semibold tabular-nums">{stat.value}</span>
                                </div>
                              ))
                            ) : (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Activity className="h-3 w-3" />
                                <span>Memuat data...</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Bottom: Dana Kematian + Dana Sosial side by side ── */}
          {!isLoading && data && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Dana Kematian Deep Dive */}
              <Card className="border-2 border-rose-200 dark:border-rose-800">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PiggyBank className="h-5 w-5 text-rose-600" />
                    Ikhtisar Dana Kematian
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 p-4">
                    <p className="text-xs text-muted-foreground mb-1">Total Nilai Semua Pengajuan</p>
                    <p className="text-3xl font-bold text-rose-700 dark:text-rose-400 tabular-nums">
                      {formatCurrency(data.danaKematian.totalDana)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-green-50 dark:bg-green-950 p-3">
                      <p className="text-xs text-muted-foreground">Sudah Dicairkan</p>
                      <p className="text-lg font-bold text-green-700 dark:text-green-400 tabular-nums">
                        {formatCurrency(data.danaKematian.klaimDibayar)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatNumber(ov?.klaimSelesai || 0)} klaim selesai
                      </p>
                    </div>
                    <div className="rounded-xl bg-orange-50 dark:bg-orange-950 p-3">
                      <p className="text-xs text-muted-foreground">Dalam Proses</p>
                      <p className="text-lg font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                        {formatNumber(ov?.klaimAktif || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">pengajuan aktif</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/keuangan/laporan-keuangan/dana-kematian" className="gap-1">
                        Lihat Laporan Lengkap
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Dana Sosial */}
              <Card className="border-2 border-pink-200 dark:border-pink-800">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Heart className="h-5 w-5 text-pink-600" />
                    Ikhtisar Dana Sosial
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl bg-pink-50 dark:bg-pink-950 border border-pink-200 dark:border-pink-800 p-4">
                    <p className="text-xs text-muted-foreground mb-1">Total Dana Diajukan</p>
                    <p className="text-3xl font-bold text-pink-700 dark:text-pink-400 tabular-nums">
                      {formatCurrency(data.danaSosial.totalDana)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-green-50 dark:bg-green-950 p-3">
                      <p className="text-xs text-muted-foreground">Sudah Disalurkan</p>
                      <p className="text-lg font-bold text-green-700 dark:text-green-400 tabular-nums">
                        {formatCurrency(data.danaSosial.bantuanDiberikan)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-purple-50 dark:bg-purple-950 p-3">
                      <p className="text-xs text-muted-foreground">Sisa / Pending</p>
                      <p className="text-lg font-bold text-purple-700 dark:text-purple-400 tabular-nums">
                        {formatCurrency(data.danaSosial.sisaDana)}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/keuangan/laporan-keuangan/dana-sosial" className="gap-1">
                        Lihat Laporan Lengkap
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </Container>
    </Fragment>
  );
}
