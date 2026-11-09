'use client';

import { CalendarRange } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardOverviewResponse } from '@/lib/hooks/use-dashboard-api';
import { ChartCard, ChartTooltipContent } from './chart-shell';

interface AgeChartProps {
  data: DashboardOverviewResponse['charts']['usia'];
  isLoading?: boolean;
}

// Gradasi usia muda (cyan muda) → tua (navy), + slate untuk "tidak diketahui".
const AGE_COLORS = [
  '#7FDBFF',
  '#3EC8FF',
  '#00AEEF',
  '#0077CC',
  '#0057B8',
  '#94A3B8',
];

/** Distribusi usia anggota (kelompok umur) — profil demografi pensiunan. */
export function AgeChart({ data, isLoading }: AgeChartProps) {
  const hasData = data.some((d) => d.jumlah > 0);

  return (
    <ChartCard
      title="Distribusi Usia Anggota"
      subtitle="Profil demografi berdasarkan tanggal lahir"
      icon={<CalendarRange className="h-4 w-4 text-cyan-500" />}
      isLoading={isLoading}
      isEmpty={!hasData}
      emptyText="Belum ada data tanggal lahir anggota"
    >
      <div className="w-full" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border, #e2e8f0)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={{ fontSize: 11, fill: 'var(--color-muted-foreground, #64748b)' }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={36}
              tick={{ fontSize: 12, fill: 'var(--color-muted-foreground, #64748b)' }}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-muted, #f1f5f9)', opacity: 0.4 }}
              content={<ChartTooltipContent valueSuffix=" anggota" />}
            />
            <Bar dataKey="jumlah" name="Anggota" radius={[6, 6, 0, 0]} maxBarSize={40}>
              {data.map((entry, index) => (
                <Cell key={entry.label} fill={AGE_COLORS[index % AGE_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
