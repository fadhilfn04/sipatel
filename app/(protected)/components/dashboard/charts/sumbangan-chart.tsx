'use client';

import { HandCoins } from 'lucide-react';
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

interface SumbanganChartProps {
  data: DashboardOverviewResponse['charts']['sumbanganPerBulan'];
  isLoading?: boolean;
}

const formatRupiah = (v: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(v);

/** Tren sumbangan per bulan: terbayar (disetujui) vs pending verifikasi. */
export function SumbanganChart({ data, isLoading }: SumbanganChartProps) {
  const hasData = data.some((d) => d.terbayar + d.pending > 0);

  return (
    <ChartCard
      title="Sumbangan per Bulan"
      subtitle="Nilai terbayar vs menunggu verifikasi"
      icon={<HandCoins className="h-4 w-4 text-green-500" />}
      isLoading={isLoading}
      isEmpty={!hasData}
      emptyText="Belum ada data pembayaran sumbangan pada periode ini"
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
            <Bar dataKey="terbayar" name="Terbayar" stackId="a" fill={CHART_COLORS.green} maxBarSize={34} />
            <Bar dataKey="pending" name="Pending" stackId="a" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} maxBarSize={34} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
