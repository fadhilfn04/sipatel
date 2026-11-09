'use client';

import Link from 'next/link';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartTooltipContent, CHART_COLORS } from './chart-shell';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
  /** Bila diisi, item legenda menjadi link (mis. filter status di modul). */
  href?: string;
}

interface StatusDonutChartProps {
  slices: DonutSlice[];
  /** Label ringkas di tengah donut (mis. total) */
  centerLabel?: string;
  centerValue?: string;
}

/** Donut chart generik untuk distribusi status (anggota / dana kematian). */
export function StatusDonutChart({ slices, centerLabel, centerValue }: StatusDonutChartProps) {
  const hasData = slices.some((s) => s.value > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: 240 }}>
        Belum ada data
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<ChartTooltipContent />} />
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            innerRadius="62%"
            outerRadius="85%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {slices.map((slice) => (
              <Cell key={slice.label} fill={slice.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {centerValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold tabular-nums">{centerValue}</span>
          {centerLabel && (
            <span className="text-[13px] text-muted-foreground">{centerLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Legenda manual donut dengan nilai + persentase; item dengan href menjadi link. */
export function DonutLegend({ slices, total }: { slices: DonutSlice[]; total: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      {slices.map((slice) => {
        const pct = total > 0 ? ((slice.value / total) * 100).toFixed(1) : '0.0';
        const body = (
          <>
            <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground min-w-0">
              <span className="h-2 w-2 rounded-[2px] shrink-0" style={{ backgroundColor: slice.color }} />
              <span className="truncate">{slice.label}</span>
            </span>
            <span className="text-[13px] font-medium tabular-nums shrink-0">
              {new Intl.NumberFormat('id-ID').format(slice.value)}
              <span className="text-muted-foreground"> ({pct}%)</span>
            </span>
          </>
        );
        return slice.href ? (
          <Link
            key={slice.label}
            href={slice.href}
            title={`Lihat pengajuan berstatus ${slice.label}`}
            className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 -mx-1.5 hover:bg-muted/60 transition-colors"
          >
            {body}
          </Link>
        ) : (
          <div key={slice.label} className="flex items-center justify-between gap-2">
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** Warna bawaan per status keanggotaan. */
export const STATUS_COLORS = {
  aktif: CHART_COLORS.green,
  non_aktif: CHART_COLORS.amber,
  berhenti: CHART_COLORS.slate,
  meninggal: CHART_COLORS.red,
} as const;
