'use client';

import { TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardOverviewResponse } from '@/lib/hooks/use-dashboard-api';
import { ChartCard, ChartTooltipContent, CHART_COLORS } from './chart-shell';

interface GrowthChartProps {
  data: DashboardOverviewResponse['charts']['pertumbuhanAnggota'];
  isLoading?: boolean;
  periodLabel?: string;
}

/** Grafik pertumbuhan jumlah anggota (pendaftaran baru) berdasarkan bulan. */
export function GrowthChart({ data, isLoading, periodLabel }: GrowthChartProps) {
  const hasData = data.some((d) => d.jumlah > 0);

  return (
    <ChartCard
      title="Pertumbuhan Anggota"
      subtitle={`Pendaftaran anggota baru${periodLabel ? ` · ${periodLabel}` : ''}`}
      icon={<TrendingUp className="h-4 w-4 text-blue-500" />}
      isLoading={isLoading}
      isEmpty={!hasData}
      emptyText="Belum ada pendaftaran anggota pada periode ini"
    >
      <div className="w-full" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border, #e2e8f0)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: 'var(--color-muted-foreground, #64748b)' }}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: 'var(--color-muted-foreground, #64748b)' }}
              width={36}
            />
            <Tooltip
              cursor={{ stroke: CHART_COLORS.blue, strokeWidth: 1, strokeDasharray: '3 3' }}
              content={<ChartTooltipContent valueSuffix=" anggota" />}
            />
            <Area
              type="monotone"
              dataKey="jumlah"
              name="Anggota Baru"
              stroke={CHART_COLORS.blue}
              strokeWidth={2.5}
              fill="url(#growthFill)"
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
