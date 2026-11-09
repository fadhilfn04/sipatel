'use client';

import { MapPin } from 'lucide-react';
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
import { ChartCard, ChartTooltipContent, BRAND_SCALE } from './chart-shell';

interface RegionalChartProps {
  data: DashboardOverviewResponse['charts']['regional'];
  isLoading?: boolean;
}

/** Distribusi anggota per area regional (pandangan makro untuk pusat). */
export function RegionalChart({ data, isLoading }: RegionalChartProps) {
  return (
    <ChartCard
      title="Anggota per Regional"
      subtitle="10 area regional teratas"
      icon={<MapPin className="h-4 w-4 text-emerald-500" />}
      isLoading={isLoading}
      isEmpty={data.length === 0}
      emptyText="Belum ada data area regional"
    >
      <div className="w-full" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
            barCategoryGap={6}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border, #e2e8f0)" />
            <XAxis
              type="number"
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: 'var(--color-muted-foreground, #64748b)' }}
            />
            <YAxis
              type="category"
              dataKey="regional"
              width={110}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: 'var(--color-muted-foreground, #64748b)' }}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-muted, #f1f5f9)', opacity: 0.4 }}
              content={<ChartTooltipContent valueSuffix=" anggota" />}
            />
            <Bar dataKey="jumlah" name="Anggota" radius={[0, 6, 6, 0]} maxBarSize={18}>
              {data.map((entry, index) => (
                <Cell
                  key={entry.regional}
                  fill={BRAND_SCALE[index % BRAND_SCALE.length]}
                  fillOpacity={index === 0 ? 1 : 0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
