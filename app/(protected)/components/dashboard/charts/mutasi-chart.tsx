'use client';

import { ArrowLeftRight } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardOverviewResponse } from '@/lib/hooks/use-dashboard-api';
import { ChartCard, ChartTooltipContent, CHART_COLORS } from './chart-shell';

interface MutasiChartProps {
  data: DashboardOverviewResponse['charts']['mutasiPerBulan'];
  isLoading?: boolean;
}

const SERIES = [
  { key: 'menunggu', name: 'Menunggu', color: CHART_COLORS.slate },
  { key: 'diverifikasi', name: 'Verifikasi PC', color: CHART_COLORS.amber },
  { key: 'selesai', name: 'Disetujui', color: CHART_COLORS.green },
  { key: 'ditolak', name: 'Ditolak', color: CHART_COLORS.red },
] as const;

/** Pengajuan mutasi cabang per bulan, dipecah per status (stacked bar). */
export function MutasiChart({ data, isLoading }: MutasiChartProps) {
  const hasData = data.some((d) => d.menunggu + d.diverifikasi + d.selesai + d.ditolak > 0);

  return (
    <ChartCard
      title="Mutasi Cabang"
      subtitle="Pengajuan per bulan berdasarkan status"
      icon={<ArrowLeftRight className="h-4 w-4 text-amber-500" />}
      isLoading={isLoading}
      isEmpty={!hasData}
      emptyText="Belum ada pengajuan mutasi pada periode ini"
    >
      <div className="w-full" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border, #e2e8f0)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              tick={{ fontSize: 12, fill: 'var(--color-muted-foreground, #64748b)' }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={32}
              tick={{ fontSize: 12, fill: 'var(--color-muted-foreground, #64748b)' }}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-muted, #f1f5f9)', opacity: 0.4 }}
              content={<ChartTooltipContent valueSuffix=" pengajuan" />}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              iconType="circle"
              iconSize={8}
            />
            {SERIES.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                stackId="mutasi"
                fill={s.color}
                radius={s.key === 'ditolak' ? [4, 4, 0, 0] : undefined}
                maxBarSize={34}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
