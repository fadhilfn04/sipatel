'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CountingNumber } from '@/components/ui/counting-number';
import {
  Users,
  UserCheck,
  UserX,
  Heart,
  UsersRound,
  UserPlus,
  ArrowLeftRight,
  FileText,
  Wallet,
  HandCoins,
  Timer,
} from 'lucide-react';
import { DashboardOverviewResponse } from '@/lib/hooks/use-dashboard-api';

const formatNumber = (n: number) => new Intl.NumberFormat('id-ID').format(n);

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

type SummaryTone = 'keanggotaan' | 'pelayanan' | 'keuangan' | 'danger';

const TONES: Record<SummaryTone, string> = {
  keanggotaan: 'bg-cyan-50 text-[#0077B6] dark:bg-cyan-950 dark:text-cyan-300',
  pelayanan: 'bg-indigo-50 text-[#0D0773] dark:bg-indigo-950 dark:text-indigo-300',
  keuangan: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  danger: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300',
};

interface SummaryCardDef {
  title: string;
  value: number | null;
  sub?: string;
  icon: ReactNode;
  tone: SummaryTone;
  href?: string;
  trend?: { current: number; previous: number } | null;
  /** Format tampilan angka (default: angka Indonesia). */
  format?: (n: number) => string;
}

const formatCompactCurrency = (n: number) => {
  if (Math.abs(n) >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`;
  if (Math.abs(n) >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)} jt`;
  if (Math.abs(n) >= 1_000) return `Rp ${(n / 1_000).toFixed(0)} rb`;
  return `Rp ${formatNumber(n)}`;
};

interface SummaryCardsProps {
  data: DashboardOverviewResponse | undefined;
  isLoading: boolean;
  periodLabel?: string;
}

/** Badge tren vs periode sebelumnya (hanya bila ada data pembanding). */
function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    if (current === 0) return null;
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-600 dark:text-green-400">
        baru muncul
      </span>
    );
  }
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct * 10) / 10;
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
      }`}
    >
      {up ? '▲' : '▼'} {Math.abs(rounded)}% vs periode lalu
    </span>
  );
}

/**
 * Delapan summary cards dashboard. Kartu dirender berdasarkan seksi yang
 * diizinkan server (data null ⇒ seksi tanpa permission ⇒ kartu disembunyikan),
 * seluruh kartu dapat diklik menuju halaman terkait.
 */
export function SummaryCards({ data, isLoading, periodLabel }: SummaryCardsProps) {
  const k = data?.summary.keanggotaan ?? null;

  const iuranData = data?.summary.iuran ?? null;
  const totalIuran = iuranData ? iuranData.iuran + iuranData.tidakIuran : 0;
  const patuhIuran =
    iuranData && totalIuran > 0 ? (iuranData.iuran / totalIuran) * 100 : null;

  const sumbanganData = data?.summary.sumbangan ?? null;
  const dakemKpi = data?.summary.dakemKpi ?? null;

  const cards: SummaryCardDef[] = [
    {
      title: 'Total Anggota',
      value: k ? k.totalAnggota : null,
      sub: k ? `${formatNumber(k.anggotaAktif)} aktif` : undefined,
      icon: <Users className="h-5 w-5" />,
      tone: 'keanggotaan',
      href: '/keanggotaan/pengelolaan-data',
    },
    {
      title: 'Anggota Aktif',
      value: k ? k.anggotaAktif : null,
      sub: k && k.totalAnggota > 0
        ? `${((k.anggotaAktif / k.totalAnggota) * 100).toFixed(1)}% dari total`
        : undefined,
      icon: <UserCheck className="h-5 w-5" />,
      tone: 'keanggotaan',
      href: '/keanggotaan/pengelolaan-data',
    },
    {
      title: 'Nonaktif / Berhenti',
      value: k ? k.anggotaNonAktif + k.anggotaBerhenti : null,
      sub: k
        ? `${formatNumber(k.anggotaNonAktif)} nonaktif · ${formatNumber(k.anggotaBerhenti)} berhenti`
        : undefined,
      icon: <UserX className="h-5 w-5" />,
      tone: 'keanggotaan',
      href: '/keanggotaan/pengakhiran-keanggotaan',
    },
    {
      title: 'Meninggal Dunia',
      value: k ? k.anggotaMeninggal : null,
      sub: 'Terdata dalam modul kematian',
      icon: <Heart className="h-5 w-5" />,
      tone: 'danger',
      href: '/keanggotaan/entry-meninggal-dunia',
    },
    {
      title: 'Pengurus Aktif',
      value: k ? k.pengurusAktif : null,
      sub: 'Memegang jabatan saat ini',
      icon: <UsersRound className="h-5 w-5" />,
      tone: 'keanggotaan',
      href: '/keanggotaan/perubahan-kepengurusan',
    },
    {
      title: 'Kepatuhan Iuran',
      value: patuhIuran,
      sub: iuranData
        ? `${formatNumber(iuranData.iuran)} membayar · ${formatNumber(iuranData.tidakIuran)} tidak`
        : undefined,
      format: (v) => `${v.toFixed(1)}%`,
      icon: <Wallet className="h-5 w-5" />,
      tone: 'keanggotaan',
      href: '/keanggotaan/pengelolaan-data',
    },
    {
      title: 'Pendaftaran Baru',
      value: data?.summary.pendaftaranBaru ?? null,
      sub: periodLabel ? `Periode ${periodLabel.toLowerCase()}` : undefined,
      trend: data?.trends?.pendaftaranBaru ?? null,
      icon: <UserPlus className="h-5 w-5" />,
      tone: 'keanggotaan',
      href: '/keanggotaan/pendaftaran-anggota-baru',
    },
    {
      title: 'Mutasi Menunggu',
      value: data?.summary.mutasiPending ?? null,
      sub: 'Perlu verifikasi / keputusan',
      icon: <ArrowLeftRight className="h-5 w-5" />,
      tone: 'pelayanan',
      href: '/mutasi-cabang',
    },
    {
      title: 'Dana Kematian Diproses',
      value: data?.summary.dakemPending ?? null,
      sub:
        data?.summary.totalDicairkan != null && data.summary.totalDicairkan > 0
          ? `${formatCurrency(data.summary.totalDicairkan)} dicairkan`
          : 'Pengajuan belum selesai',
      icon: <FileText className="h-5 w-5" />,
      tone: 'pelayanan',
      href: '/pelayanan/dana-kematian',
    },
    {
      title: 'Rata-rata Durasi Dakem',
      value: dakemKpi?.rataRataDurasiHari ?? null,
      sub: dakemKpi?.tertuaMenungguHari
        ? `Tertua menunggu ${dakemKpi.tertuaMenungguHari} hari`
        : 'Durasi proses klaim selesai',
      format: (v) => `${Math.round(v)} hari`,
      icon: <Timer className="h-5 w-5" />,
      tone: 'pelayanan',
      href: '/pelayanan/dana-kematian',
    },
    {
      title: 'Sumbangan Terkumpul',
      value: sumbanganData?.totalPeriode ?? null,
      sub: sumbanganData
        ? sumbanganData.pendingVerifikasi > 0
          ? `${formatNumber(sumbanganData.pendingVerifikasi)} menunggu verifikasi`
          : periodLabel
            ? `Periode ${periodLabel.toLowerCase()}`
            : undefined
        : undefined,
      format: formatCompactCurrency,
      icon: <HandCoins className="h-5 w-5" />,
      tone: 'keuangan',
      href: '/keuangan/laporan-keuangan/pembayaran-sumbangan',
    },
  ];

  const visible = cards.filter((c) => c.value !== null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5 space-y-3">
              <div className="flex justify-between items-start">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-10 rounded-xl" />
              </div>
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {visible.map((card) => {
        const content = (
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-medium text-foreground leading-snug">
                  {card.title}
                </p>
                <p className="text-3xl font-bold mt-1 tabular-nums text-foreground">
                  <CountingNumber
                    to={card.value ?? 0}
                    duration={1}
                    format={card.format || formatNumber}
                    className="tabular-nums"
                  />
                </p>
                {card.sub && (
                  <p className="text-[13px] text-muted-foreground mt-1 truncate">{card.sub}</p>
                )}
                {card.trend && (
                  <div className="mt-1">
                    <TrendBadge current={card.trend.current} previous={card.trend.previous} />
                  </div>
                )}
              </div>
              <div
                className={`h-11 w-11 rounded-xl ${TONES[card.tone]} flex items-center justify-center shrink-0`}
              >
                {card.icon}
              </div>
            </div>
          </CardContent>
        );

        return card.href ? (
          <Link
            key={card.title}
            href={card.href}
            className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 h-full">
              {content}
            </Card>
          </Link>
        ) : (
          <Card key={card.title}>{content}</Card>
        );
      })}
    </div>
  );
}

