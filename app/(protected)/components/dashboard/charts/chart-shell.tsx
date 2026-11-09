'use client';

import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Palet warna dashboard SIPATEL — diturunkan dari logo P2Tel asli
 * (ekstraksi piksel: cyan #00CCFF + navy #0D0773).
 *
 * Prinsip (audiens 50+):
 *  - Maksimal satu gradasi brand (navy → cyan) + warna semantik status.
 *  - Cyan brand diredam ke #00AEEF agar kontras cukup di latar terang.
 */
export const CHART_COLORS = {
  // ── Brand P2Tel ──
  navy: '#0D0773',
  navyMid: '#1E2A8A',
  cyan: '#00AEEF',
  cyanLight: '#3EC8FF',
  // ── Semantik status ──
  green: '#16A34A',
  amber: '#D97706',
  red: '#DC2626',
  slate: '#94A3B8',
  // ── Alias kunci lama (dipetakan ke keluarga brand) ──
  blue: '#0077CC',
  violet: '#0D0773',
  emerald: '#0077CC',
  orange: '#EA580C',
} as const;

/** Gradasi satu hue navy → cyan untuk chart kategori (cabang/regional/jabatan/usia). */
export const BRAND_SCALE = [
  '#0D0773',
  '#1E2A8A',
  '#2C3EA8',
  '#0057B8',
  '#0077CC',
  '#00AEEF',
  '#3EC8FF',
  '#7FDBFF',
] as const;

interface ChartCardProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyText?: string;
  height?: number;
  className?: string;
  children: ReactNode;
}

/** Kartu pembungkus chart dengan state loading & empty yang konsisten. */
export function ChartCard({
  title,
  subtitle,
  icon,
  action,
  isLoading,
  isEmpty,
  emptyText = 'Belum ada data',
  height = 280,
  className,
  children,
}: ChartCardProps) {
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3 w-full">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              {icon}
              {title}
            </CardTitle>
            {subtitle && (
              <p className="text-[13px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="w-full" style={{ height }} />
        ) : isEmpty ? (
          <div
            className="flex items-center justify-center text-sm text-muted-foreground"
            style={{ height }}
          >
            {emptyText}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Tooltip custom untuk seluruh chart (gaya kartu, mendukung format angka
 * Indonesia).
 */
export function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
  valueSuffix = '',
}: {
  active?: boolean;
  payload?: {
    name?: string;
    value?: number | string;
    color?: string;
    fill?: string;
    payload?: { fill?: string };
  }[];
  label?: string;
  labelFormatter?: (label: string) => string;
  valueFormatter?: (value: number) => string;
  valueSuffix?: string;
}) {
  if (!active || !payload?.length) return null;

  const heading = labelFormatter ? labelFormatter(String(label ?? '')) : label;
  const format = valueFormatter || ((v: number) => new Intl.NumberFormat('id-ID').format(v));

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md text-popover-foreground min-w-[140px]">
      {heading && (
        <p className="text-xs font-medium text-muted-foreground mb-1.5">{heading}</p>
      )}
      <div className="space-y-1">
        {payload.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-[2px] shrink-0"
                style={{ backgroundColor: item.color || item.fill || item.payload?.fill }}
              />
              <span className="text-muted-foreground">{item.name}</span>
            </span>
            <span className="font-semibold tabular-nums">
              {format(Number(item.value) || 0)}
              {valueSuffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Format angka Indonesia (short). */
export const formatNumber = (n: number) => new Intl.NumberFormat('id-ID').format(n);

/** Format mata uang Rupiah ringkas untuk sumbu chart. */
export const formatCompactCurrency = (n: number) => {
  if (Math.abs(n) >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`;
  if (Math.abs(n) >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)} jt`;
  if (Math.abs(n) >= 1_000) return `Rp ${(n / 1_000).toFixed(0)} rb`;
  return `Rp ${formatNumber(n)}`;
};
