'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  AlertToolbar,
} from '@/components/ui/alert';
import {
  Users,
  UsersRound,
  PieChart,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import {
  useDashboardOverview,
  DashboardPeriod,
  DashboardOverviewResponse,
  DASHBOARD_PERIODS,
} from '@/lib/hooks/use-dashboard-api';
import { getDakemStatus } from '@/lib/workflow/dana-kematian-status';
import { SummaryCards } from './summary-cards';
import { ActivityFeed } from './activity-feed';
import { MonitoringWidget } from './monitoring-widget';
import { ChartCard, CHART_COLORS } from './charts/chart-shell';
import {
  StatusDonutChart,
  DonutLegend,
  STATUS_COLORS,
  DonutSlice,
} from './charts/status-donut';

// Chart dimuat lazy agar bundle awal dashboard tetap ringan (recharts cukup besar).
const ChartLoading = ({ h = 'h-72' }: { h?: string }) => (
  <div className={`${h} w-full animate-pulse rounded-xl bg-accent`} />
);

const GrowthChart = dynamic(
  () => import('./charts/growth-chart').then((m) => m.GrowthChart),
  { ssr: false, loading: () => <ChartLoading /> },
);
const CabangChart = dynamic(
  () => import('./charts/cabang-chart').then((m) => m.CabangChart),
  { ssr: false, loading: () => <ChartLoading /> },
);
const MutasiChart = dynamic(
  () => import('./charts/mutasi-chart').then((m) => m.MutasiChart),
  { ssr: false, loading: () => <ChartLoading h="h-64" /> },
);
const PengurusChart = dynamic(
  () => import('./charts/pengurus-chart').then((m) => m.PengurusChart),
  { ssr: false, loading: () => <ChartLoading h="h-64" /> },
);
const AgeChart = dynamic(
  () => import('./charts/age-chart').then((m) => m.AgeChart),
  { ssr: false, loading: () => <ChartLoading /> },
);
const RegionalChart = dynamic(
  () => import('./charts/regional-chart').then((m) => m.RegionalChart),
  { ssr: false, loading: () => <ChartLoading /> },
);
const SumbanganChart = dynamic(
  () => import('./charts/sumbangan-chart').then((m) => m.SumbanganChart),
  { ssr: false, loading: () => <ChartLoading h="h-64" /> },
);
const CashflowChart = dynamic(
  () => import('./charts/cashflow-chart').then((m) => m.CashflowChart),
  { ssr: false, loading: () => <ChartLoading h="h-64" /> },
);

const formatNumber = (n: number) => new Intl.NumberFormat('id-ID').format(n);

const STATUS_LABELS: Record<string, string> = {
  aktif: 'Aktif',
  non_aktif: 'Nonaktif',
  berhenti: 'Berhenti',
  meninggal: 'Meninggal',
};

const STATUS_COLOR_MAP: Record<string, string> = {
  aktif: STATUS_COLORS.aktif,
  non_aktif: STATUS_COLORS.non_aktif,
  berhenti: STATUS_COLORS.berhenti,
  meninggal: STATUS_COLORS.meninggal,
};

const KATEGORI_LABELS: Record<string, string> = {
  biasa: 'Biasa',
  luar_biasa: 'Luar Biasa',
  kehormatan: 'Kehormatan',
  tidak_diketahui: 'Tidak diketahui',
};

const PERAN_LABELS: Record<string, string> = {
  pegawai: 'Pensiunan',
  istri: 'Istri',
  suami: 'Suami',
  anak: 'Anak',
  meninggal: 'Meninggal',
  tidak_diketahui: 'Tidak diketahui',
};

const DEMOGRAFI_COLORS = [
  '#0D0773',
  '#1E2A8A',
  '#0057B8',
  '#0077CC',
  '#00AEEF',
  '#3EC8FF',
  '#94A3B8',
];

function LiveClock() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!time) return null;

  const hour = time.getHours();
  const greeting =
    hour < 11 ? 'Selamat Pagi' :
    hour < 15 ? 'Selamat Siang' :
    hour < 18 ? 'Selamat Sore' :
    'Selamat Malam';

  return (
    <div>
      <p className="text-2xl font-bold text-white">{greeting}!</p>
      <p className="text-white/80 text-base mt-0.5">
        {time.toLocaleDateString('id-ID', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        })}
      </p>
      <p className="text-white/95 text-4xl font-mono font-semibold mt-1 tabular-nums">
        {time.toLocaleTimeString('id-ID', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        })}
      </p>
    </div>
  );
}

/** Bangun slice donut distribusi status keanggotaan. */
function buildStatusSlices(
  data: DashboardOverviewResponse['charts']['distribusiStatus'],
): { slices: DonutSlice[]; total: number } {
  const total = data.reduce((sum, d) => sum + d.jumlah, 0);
  const slices: DonutSlice[] = data.map((d) => ({
    label: STATUS_LABELS[d.status] || d.status,
    value: d.jumlah,
    color: STATUS_COLOR_MAP[d.status] || CHART_COLORS.slate,
  }));
  return { slices, total };
}

/** Bangun slice donut generik untuk distribusi demografi. */
function buildLabeledSlices(
  data: { status: string; jumlah: number }[],
  labels: Record<string, string>,
): { slices: DonutSlice[]; total: number } {
  const total = data.reduce((sum, d) => sum + d.jumlah, 0);
  const slices: DonutSlice[] = data.map((d, i) => ({
    label: labels[d.status] || d.status.replace(/_/g, ' '),
    value: d.jumlah,
    color: DEMOGRAFI_COLORS[i % DEMOGRAFI_COLORS.length],
  }));
  return { slices, total };
}

/** Bangun slice donut dana kematian per status. */
function buildDakemSlices(
  data: DashboardOverviewResponse['charts']['dakemPerStatus'],
): { slices: DonutSlice[]; total: number } {
  const total = data.reduce((sum, d) => sum + d.jumlah, 0);
  const colorFor = (status: string) => {
    if (status === 'selesai') return CHART_COLORS.green;
    if (status === 'ditolak') return CHART_COLORS.red;
    if (status === 'batal') return CHART_COLORS.slate;
    if (['proses_pusat', 'pending_dokumen', 'revisi_pusat'].includes(status)) return CHART_COLORS.amber;
    if (status === 'verified') return CHART_COLORS.blue;
    if (['penyaluran', 'terima_ahli_waris', 'laporan'].includes(status)) return CHART_COLORS.cyan;
    return CHART_COLORS.slate;
  };
  const slices: DonutSlice[] = data.map((d) => {
    const cfg = getDakemStatus(d.status);
    return {
      label: cfg.label,
      value: d.jumlah,
      color: colorFor(d.status),
      // Status legacy tidak ada di dropdown filter modul → tanpa link.
      href: cfg.legacy
        ? undefined
        : `/pelayanan/dana-kematian?status_proses=${encodeURIComponent(d.status)}`,
    };
  });
  return { slices, total };
}

interface DashboardContentProps {
  period: DashboardPeriod;
}

export function DashboardContent({ period }: DashboardContentProps) {
  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    dataUpdatedAt,
  } = useDashboardOverview(period);

  const perms = data?.permissions;
  const periodLabel = DASHBOARD_PERIODS.find((p) => p.value === period)?.label;

  const status = buildStatusSlices(data?.charts.distribusiStatus || []);
  const dakem = buildDakemSlices(data?.charts.dakemPerStatus || []);
  const kategori = buildLabeledSlices(data?.charts.kategori || [], KATEGORI_LABELS);
  const peran = buildLabeledSlices(data?.charts.peranKeluarga || [], PERAN_LABELS);

  const pendingTotal =
    (data?.summary.mutasiPending || 0) +
    (data?.summary.dakemPending || 0);

  const showRowA = perms?.keanggotaan;
  const showRowB = perms?.keanggotaan || perms?.danaKematian;
  const showRowC = perms?.mutasi || perms?.keanggotaan;
  const showDemografi = perms?.keanggotaan;
  const showKeuangan = perms?.keuangan;

  return (
    <div className="space-y-6 pb-8">
      {/* ── Hero / Greeting ── */}
      <div className="rounded-2xl bg-linear-to-br from-[#0D0773] via-[#14308F] to-[#0069C0] p-6 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <LiveClock />
          <div className="flex flex-col items-start lg:items-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-[#00AEEF]/20 border-[#7FDBFF]/40 text-white hover:bg-[#00AEEF]/30 gap-2"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
              Perbarui Data
            </Button>
            <p className="text-white/60 text-xs text-right tabular-nums">
              Terakhir diperbarui:{' '}
              {dataUpdatedAt
                ? new Date(dataUpdatedAt).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}
            </p>
            {pendingTotal > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-white/20 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-yellow-300 shrink-0" />
                <span className="text-white text-sm font-medium">
                  {formatNumber(pendingTotal)} pengajuan menunggu proses
                </span>
              </div>
            )}
            {data?.scope.isScoped && data.scope.cabang && (
              <p className="text-white/70 text-xs text-right">
                Cakupan: <span className="font-medium text-white">{data.scope.cabang}</span>
              </p>
            )}
            <p className="text-white/60 text-xs text-right">
              Sistem Informasi Pelayanan Pensiunan Telkom (SIPATEL)
            </p>
          </div>
        </div>
      </div>

      {/* ── Error state ── */}
      {isError && (
        <Alert variant="destructive">
          <AlertIcon>
            <AlertTriangle className="h-4 w-4" />
          </AlertIcon>
          <AlertContent>
            <AlertTitle>Gagal memuat data dashboard</AlertTitle>
            <AlertDescription>
              Terjadi kesalahan saat mengambil data dari server. Periksa koneksi
              Anda, lalu coba lagi.
            </AlertDescription>
          </AlertContent>
          <AlertToolbar>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
              Coba Lagi
            </Button>
          </AlertToolbar>
        </Alert>
      )}

      {/* ── Summary Cards ── */}
      <SummaryCards data={data} isLoading={isLoading} periodLabel={periodLabel} />

      {/* ── Row A: Pertumbuhan + Distribusi status ── */}
      {showRowA && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <GrowthChart
              data={data?.charts.pertumbuhanAnggota || []}
              isLoading={isLoading}
              periodLabel={periodLabel}
            />
          </div>
          <div>
            <ChartCard
              title="Status Keanggotaan"
              subtitle="Distribusi anggota saat ini"
              icon={<PieChart className="h-4 w-4 text-green-500" />}
              isLoading={isLoading}
              isEmpty={status.total === 0}
              height={240}
              action={
                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                  <Link href="/keanggotaan/pengelolaan-data">
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              }
            >
              <div className="space-y-4">
                <StatusDonutChart
                  slices={status.slices}
                  centerValue={formatNumber(status.total)}
                  centerLabel="anggota"
                />
                <DonutLegend slices={status.slices} total={status.total} />
              </div>
            </ChartCard>
          </div>
        </div>
      )}


      {/* ── Row B: Cabang + Dana Kematian per status ── */}
      {showRowB && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {perms?.keanggotaan ? (
              <CabangChart
                data={data?.charts.anggotaPerCabang || []}
                isLoading={isLoading}
                scopeLabel={data?.scope.isScoped ? (data.scope.cabang ?? undefined) : undefined}
              />
            ) : (
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base">Anggota per Cabang</CardTitle>
                </CardHeader>
                <CardContent
                  className="flex items-center justify-center text-sm text-muted-foreground"
                  style={{ height: 280 }}
                >
                  Tidak ada akses
                </CardContent>
              </Card>
            )}
          </div>
          <div>
            <ChartCard
              title="Dana Kematian per Status"
              subtitle="Seluruh pengajuan tercatat"
              icon={<Users className="h-4 w-4 text-purple-500" />}
              isLoading={isLoading}
              isEmpty={dakem.total === 0}
              height={240}
              action={
                perms?.danaKematian ? (
                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                    <Link href="/pelayanan/dana-kematian">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : undefined
              }
            >
              {perms?.danaKematian ? (
                <div className="space-y-4">
                  <StatusDonutChart
                    slices={dakem.slices}
                    centerValue={formatNumber(dakem.total)}
                    centerLabel="pengajuan"
                  />
                  <DonutLegend slices={dakem.slices} total={dakem.total} />
                </div>
              ) : (
                <div
                  className="flex items-center justify-center text-sm text-muted-foreground"
                  style={{ height: 240 }}
                >
                  Tidak ada akses
                </div>
              )}
            </ChartCard>
          </div>
        </div>
      )}

      {/* ── Row Demografi: Usia + Kategori ── */}
      {showDemografi && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AgeChart data={data?.charts.usia || []} isLoading={isLoading} />
          </div>
          <div>
            <ChartCard
              title="Kategori Keanggotaan"
              subtitle="Tier keanggotaan saat ini"
              icon={<Users className="h-4 w-4 text-violet-500" />}
              isLoading={isLoading}
              isEmpty={kategori.total === 0}
              height={240}
            >
              <div className="space-y-4">
                <StatusDonutChart
                  slices={kategori.slices}
                  centerValue={formatNumber(kategori.total)}
                  centerLabel="anggota"
                />
                <DonutLegend slices={kategori.slices} total={kategori.total} />
              </div>
            </ChartCard>
          </div>
        </div>
      )}

      {/* ── Row Demografi 2: Regional + Peran Keluarga ── */}
      {showDemografi && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RegionalChart data={data?.charts.regional || []} isLoading={isLoading} />
          </div>
          <div>
            <ChartCard
              title="Peran Keluarga"
              subtitle="Pegawai / istri / suami / anak"
              icon={<UsersRound className="h-4 w-4 text-cyan-500" />}
              isLoading={isLoading}
              isEmpty={peran.total === 0}
              height={240}
            >
              <div className="space-y-4">
                <StatusDonutChart
                  slices={peran.slices}
                  centerValue={formatNumber(peran.total)}
                  centerLabel="anggota"
                />
                <DonutLegend slices={peran.slices} total={peran.total} />
              </div>
            </ChartCard>
          </div>
        </div>
      )}

      {/* ── Row C: Mutasi + Pengurus ── */}
      {showRowC && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {perms?.mutasi && (
            <MutasiChart data={data?.charts.mutasiPerBulan || []} isLoading={isLoading} />
          )}
          {perms?.keanggotaan && (
            <PengurusChart data={data?.charts.pengurusPerJabatan || []} isLoading={isLoading} />
          )}
        </div>
      )}

      {/* ── Row Keuangan: Sumbangan + Arus Kas ── */}
      {showKeuangan && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SumbanganChart data={data?.charts.sumbanganPerBulan || []} isLoading={isLoading} />
          </div>
          <CashflowChart data={data?.charts.arusKasPerBulan || []} isLoading={isLoading} />
        </div>
      )}

      {/* ── Row D: Aktivitas + Monitoring ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityFeed
            activities={data?.activity}
            isLoading={isLoading}
            auditEnabled={data?.auditEnabled ?? false}
          />
        </div>
        <MonitoringWidget monitoring={data?.monitoring} isLoading={isLoading} />
      </div>
    </div>
  );
}

