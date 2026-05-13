'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, BadgeDot } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, FileText, Activity, CheckCircle2, XCircle,
  ArrowRight, RefreshCw, ChevronRight, Clock,
  TrendingUp, AlertTriangle, UserPlus, Heart,
} from 'lucide-react';
import Link from 'next/link';
import { useDashboardStats, useLatestData } from '@/lib/hooks/use-dashboard-api';
import { useHasPermission } from '@/lib/hooks/use-rbac';
import { PERMISSIONS } from '@/lib/rbac';

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

const PIPELINE_STAGES = [
  {
    key: 'dilaporkan',
    label: 'Dilaporkan',
    bgClass: 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600',
    textClass: 'text-slate-700 dark:text-slate-300',
    dotClass: 'bg-slate-500',
    numClass: 'text-slate-800 dark:text-slate-200',
  },
  {
    key: 'verifikasi_cabang',
    label: 'Verifikasi Cabang',
    bgClass: 'bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700',
    textClass: 'text-blue-700 dark:text-blue-300',
    dotClass: 'bg-blue-500',
    numClass: 'text-blue-800 dark:text-blue-200',
  },
  {
    key: 'proses_pusat',
    label: 'Proses Pusat',
    bgClass: 'bg-orange-50 dark:bg-orange-950 border-orange-300 dark:border-orange-700',
    textClass: 'text-orange-700 dark:text-orange-300',
    dotClass: 'bg-orange-500',
    numClass: 'text-orange-800 dark:text-orange-200',
  },
  {
    key: 'selesai',
    label: 'Selesai',
    bgClass: 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700',
    textClass: 'text-green-700 dark:text-green-300',
    dotClass: 'bg-green-500',
    numClass: 'text-green-800 dark:text-green-200',
  },
  {
    key: 'ditolak',
    label: 'Ditolak',
    bgClass: 'bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700',
    textClass: 'text-red-700 dark:text-red-300',
    dotClass: 'bg-red-500',
    numClass: 'text-red-800 dark:text-red-200',
  },
] as const;

const STATUS_CONFIG: Record<string, { label: string; variant: 'secondary' | 'info' | 'warning' | 'success' | 'destructive' }> = {
  dilaporkan: { label: 'Dilaporkan', variant: 'secondary' },
  verifikasi_cabang: { label: 'Verifikasi Cabang', variant: 'info' },
  proses_pusat: { label: 'Proses Pusat', variant: 'warning' },
  selesai: { label: 'Selesai', variant: 'success' },
  ditolak: { label: 'Ditolak', variant: 'destructive' },
};

const formatNumber = (n: number) => new Intl.NumberFormat('id-ID').format(n);
const formatCurrency = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
const formatDate = (s: string) =>
  new Date(s).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

export function DashboardContent() {
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useDashboardStats();
  const { data: latestData, isLoading: latestLoading } = useLatestData('both', 5);
  const canViewKeanggotaan = useHasPermission(PERMISSIONS.VIEW_KEANGGOTAAN);
  const canAccessDanaSosial = useHasPermission(PERMISSIONS.ACCESS_DANA_SOCIAL);

  const klaimByStatus = stats?.klaimByStatus || {};
  const klaimAktif = stats?.klaimAktif ?? 0;

  return (
    <div className="space-y-6 pb-8">

      {/* ── Hero / Greeting ── */}
      <div className="rounded-2xl bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <LiveClock />
          <div className="flex flex-col items-start lg:items-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/20 border-white/30 text-white hover:bg-white/30 gap-2"
              onClick={() => refetchStats()}
            >
              <RefreshCw className="h-4 w-4" />
              Perbarui Data
            </Button>
            {klaimAktif > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-white/20 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-yellow-300 shrink-0" />
                <span className="text-white text-sm font-medium">
                  {formatNumber(klaimAktif)} pengajuan sedang diproses
                </span>
              </div>
            )}
            <p className="text-white/60 text-xs text-right">
              Sistem Informasi Pelayanan Pensiunan Telkom (SIPATEL)
            </p>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Anggota"
          value={statsLoading ? null : formatNumber(stats?.totalAnggota || 0)}
          sub={!statsLoading && stats
            ? `${formatNumber(stats.anggotaAktif)} aktif · ${formatNumber(stats.anggotaMeninggal)} meninggal`
            : undefined}
          icon={<Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />}
          iconBg="bg-blue-50 dark:bg-blue-950"
          valueCls="text-blue-700 dark:text-blue-400"
          borderCls="border-blue-200 dark:border-blue-800"
        />
        <KpiCard
          title="Total Pengajuan Dana Kematian"
          value={statsLoading ? null : formatNumber(stats?.totalKlaim || 0)}
          sub="Semua pengajuan terdaftar"
          icon={<FileText className="h-6 w-6 text-purple-600 dark:text-purple-400" />}
          iconBg="bg-purple-50 dark:bg-purple-950"
          valueCls="text-purple-700 dark:text-purple-400"
          borderCls="border-purple-200 dark:border-purple-800"
        />
        <KpiCard
          title="Dalam Proses"
          value={statsLoading ? null : formatNumber(klaimAktif)}
          sub="Belum selesai / ditolak"
          icon={<Activity className="h-6 w-6 text-orange-600 dark:text-orange-400" />}
          iconBg="bg-orange-50 dark:bg-orange-950"
          valueCls="text-orange-600 dark:text-orange-400"
          borderCls="border-orange-200 dark:border-orange-800"
          highlight={klaimAktif > 0}
        />
        <KpiCard
          title="Selesai"
          value={statsLoading ? null : formatNumber(stats?.klaimSelesai || 0)}
          sub={!statsLoading && stats && stats.totalDicairkan > 0
            ? `${formatCurrency(stats.totalDicairkan)} dicairkan`
            : 'Dana kematian selesai diproses'}
          icon={<CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />}
          iconBg="bg-green-50 dark:bg-green-950"
          valueCls="text-green-700 dark:text-green-400"
          borderCls="border-green-200 dark:border-green-800"
        />
      </div>

      {/* ── Dana Kematian Pipeline ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Alur Proses Dana Kematian
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/pelayanan/dana-kematian" className="gap-1">
                Lihat Semua
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap lg:flex-nowrap items-stretch gap-2">
              {PIPELINE_STAGES.map((stage, idx) => (
                <div key={stage.key} className="flex items-center gap-2 flex-1 min-w-30">
                  <div
                    className={`flex-1 rounded-xl border-2 p-4 text-center ${stage.bgClass}`}
                  >
                    <div className={`h-2.5 w-2.5 rounded-full ${stage.dotClass} mx-auto mb-2`} />
                    <p className={`text-xs font-medium leading-tight mb-2 ${stage.textClass}`}>
                      {stage.label}
                    </p>
                    <p className={`text-3xl font-bold tabular-nums ${stage.numClass}`}>
                      {klaimByStatus[stage.key] || 0}
                    </p>
                    <p className={`text-xs mt-1 ${stage.textClass} opacity-70`}>pengajuan</p>
                  </div>
                  {/* Arrow between stages, except after the last two (selesai/ditolak are parallel outcomes) */}
                  {idx < 2 && (
                    <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 hidden lg:block" />
                  )}
                  {idx === 2 && (
                    <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 hidden lg:block" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Recent Activity + Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Claims — spans 2 columns */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-purple-600" />
                  Pengajuan Terbaru
                </CardTitle>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/pelayanan/dana-kematian">Lihat Semua</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {latestLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : !latestData?.klaim.length ? (
                <p className="text-center text-muted-foreground py-10">
                  Belum ada data pengajuan
                </p>
              ) : (
                <div className="space-y-2">
                  {latestData.klaim.map((claim: any) => {
                    const sc = STATUS_CONFIG[claim.status_proses] || {
                      label: claim.status_proses,
                      variant: 'secondary' as const,
                    };
                    return (
                      <div
                        key={claim.id}
                        className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{claim.nama_anggota}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            AW: {claim.nama_ahli_waris} · {formatDate(claim.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ml-4 shrink-0">
                          <span className="text-sm font-semibold text-green-600 dark:text-green-400 hidden sm:block">
                            {formatCurrency(claim.besaran_dana_kematian || 0)}
                          </span>
                          <Badge variant={sc.variant} appearance="ghost">
                            <BadgeDot />
                            {sc.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Quick Actions + Recent Members */}
        <div className="space-y-4">

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Akses Cepat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start gap-3 h-11" asChild>
                <Link href="/pelayanan/dana-kematian">
                  <FileText className="h-5 w-5" />
                  Dana Kematian
                </Link>
              </Button>
              {canViewKeanggotaan && (
                <Button variant="outline" className="w-full justify-start gap-3 h-11" asChild>
                  <Link href="/keanggotaan/pengelolaan-data">
                    <Users className="h-5 w-5" />
                    Data Anggota
                  </Link>
                </Button>
              )}
              {canAccessDanaSosial && (
                <Button variant="outline" className="w-full justify-start gap-3 h-11" asChild>
                  <Link href="/pelayanan/dana-sosial">
                    <Heart className="h-5 w-5" />
                    Dana Sosial
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Recent Members */}
          {canViewKeanggotaan && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserPlus className="h-4 w-4 text-blue-600" />
                    Anggota Terbaru
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                    <Link href="/keanggotaan/pengelolaan-data">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {latestLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : !latestData?.anggota.length ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Belum ada data
                  </p>
                ) : (
                  <div className="space-y-3">
                    {latestData.anggota.slice(0, 4).map((member: any) => (
                      <div key={member.id} className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight truncate">
                            {member.nama_anggota}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {member.nik}
                          </p>
                        </div>
                        <Badge
                          variant={
                            member.status_anggota === 'aktif' ? 'success' :
                            member.status_anggota === 'meninggal' ? 'destructive' :
                            'secondary'
                          }
                          appearance="ghost"
                          className="ml-2 shrink-0"
                        >
                          {member.status_anggota || 'aktif'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stats Summary */}
          {!statsLoading && stats && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  Ringkasan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Anggota</span>
                  <span className="font-semibold">{formatNumber(stats.totalAnggota)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dana Kematian Selesai</span>
                  <span className="font-semibold text-green-600">{formatNumber(stats.klaimSelesai)}</span>
                </div>
                {stats.klaimDitolak > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ditolak</span>
                    <span className="font-semibold text-red-600">{formatNumber(stats.klaimDitolak)}</span>
                  </div>
                )}
                {stats.totalDanaSosial > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Dana Sosial</span>
                    <span className="font-semibold">{formatNumber(stats.totalDanaSosial)}</span>
                  </div>
                )}
                {stats.totalDicairkan > 0 && (
                  <div className="pt-2 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Dicairkan</span>
                      <span className="font-bold text-green-700 dark:text-green-400">
                        {formatCurrency(stats.totalDicairkan)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

interface KpiCardProps {
  title: string;
  value: string | null;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  valueCls: string;
  borderCls: string;
  highlight?: boolean;
}

function KpiCard({ title, value, sub, icon, iconBg, valueCls, borderCls, highlight }: KpiCardProps) {
  return (
    <Card className={`border-2 ${borderCls} hover:shadow-lg transition-shadow ${highlight ? 'ring-2 ring-orange-400/40' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground leading-snug">{title}</p>
            {value === null ? (
              <Skeleton className="h-10 w-24 mt-2" />
            ) : (
              <p className={`text-3xl font-bold mt-1 tabular-nums ${valueCls}`}>{value}</p>
            )}
            {sub && value !== null && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>
            )}
          </div>
          <div className={`h-12 w-12 rounded-xl ${iconBg} flex items-center justify-center shrink-0 ml-3`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
