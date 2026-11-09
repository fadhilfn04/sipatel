'use client';

import { Banknote } from 'lucide-react';
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
import {
  ChartCard,
  ChartTooltipContent,
  CHART_COLORS,
  formatCompactCurrency,
} from './chart-shell';

interface CashflowChartProps {
  data: DashboardOverviewResponse['charts']['arusKasPerBulan'];
  isLoading?: boolean;
}

const formatRupiah = (v: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(v);

/** Arus kas masuk vs keluar per bulan (gated permission keuangan). */
export function CashflowChart({ data, isLoading }: CashflowChartProps) {
  const hasData = data.some((d) => d.masuk + d.keluar > 0);

  return (
    <ChartCard
      title="Arus Kas"
      subtitle="Kas masuk vs keluar per bulan"
      icon={<Banknote className="h-4 w-4 text-blue-500" />}
      isLoading={isLoading}
      isEmpty={!hasData}
      emptyText="Belum ada data arus kas pada periode ini"
    >
      <div className="w-full" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border, #e2e8f0)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              tick={{ fontSize: 12, fill: 'var(--color-muted-foreground, #64748b)' }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={64}
              tick={{ fontSize: 11, fill: 'var(--color-muted-foreground, #64748b)' }}
              tickFormatter={(v: number) => formatCompactCurrency(v)}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-muted, #f1f5f9)', opacity: 0.4 }}
              content={<ChartTooltipContent valueFormatter={formatRupiah} />}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
            <Bar dataKey="masuk" name="Masuk" fill={CHART_COLORS.green} radius={[4, 4, 0, 0]} maxBarSize={20} />
            <Bar dataKey="keluar" name="Keluar" fill={CHART_COLORS.red} radius={[4, 4, 0, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
