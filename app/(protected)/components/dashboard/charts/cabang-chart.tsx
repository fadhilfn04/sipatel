'use client';

import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
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

interface CabangChartProps {
  data: DashboardOverviewResponse['charts']['anggotaPerCabang'];
  isLoading?: boolean;
  scopeLabel?: string;
}

/** Grafik jumlah anggota per cabang/PC (horizontal bar, top 10). Klik batang = filter data anggota. */
export function CabangChart({ data, isLoading, scopeLabel }: CabangChartProps) {
  const router = useRouter();

  const handleSelect = (cabang?: string) => {
    if (!cabang) return;
    router.push(`/keanggotaan/pengelolaan-data?nama_cabang=${encodeURIComponent(cabang)}`);
  };

  return (
    <ChartCard
      title="Anggota per Cabang"
      subtitle={
        scopeLabel
          ? `10 cabang teratas · ${scopeLabel}`
          : '10 cabang teratas · klik batang untuk melihat anggota'
      }
      icon={<Building2 className="h-4 w-4 text-violet-500" />}
      isLoading={isLoading}
      isEmpty={data.length === 0}
      emptyText="Belum ada data cabang"
    >
      <div className="w-full" style={{ height: 280 }}>
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
              dataKey="cabang"
              width={110}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: 'var(--color-muted-foreground, #64748b)' }}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-muted, #f1f5f9)', opacity: 0.4 }}
              content={<ChartTooltipContent valueSuffix=" anggota" />}
            />
            <Bar
              dataKey="jumlah"
              name="Anggota"
              radius={[0, 6, 6, 0]}
              maxBarSize={18}
              className="cursor-pointer"
              onClick={(d: { cabang?: string }) => handleSelect(d?.cabang)}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.cabang}
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
