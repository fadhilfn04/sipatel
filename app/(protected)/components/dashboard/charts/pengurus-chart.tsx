'use client';

import { UsersRound } from 'lucide-react';
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

interface PengurusChartProps {
  data: DashboardOverviewResponse['charts']['pengurusPerJabatan'];
  isLoading?: boolean;
}

const JABATAN_COLORS = [
  '#0D0773',
  '#1E2A8A',
  '#2C3EA8',
  '#0057B8',
  '#0077CC',
  '#00AEEF',
  '#3EC8FF',
  '#7FDBFF',
];

/** Distribusi pengurus aktif berdasarkan jabatan/posisi saat ini. */
export function PengurusChart({ data, isLoading }: PengurusChartProps) {
  // Batasi agar label sumbu tetap terbaca.
  const shown = data.slice(0, 8);

  return (
    <ChartCard
      title="Pengurus per Jabatan"
      subtitle="Posisi kepengurusan saat ini"
      icon={<UsersRound className="h-4 w-4 text-cyan-500" />}
      isLoading={isLoading}
      isEmpty={shown.length === 0}
      emptyText="Belum ada data jabatan pengurus"
    >
      <div className="w-full" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={shown} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border, #e2e8f0)" />
            <XAxis
              dataKey="jabatan"
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={{ fontSize: 11, fill: 'var(--color-muted-foreground, #64748b)' }}
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
              content={<ChartTooltipContent valueSuffix=" orang" />}
            />
            <Bar dataKey="jumlah" name="Pengurus" radius={[6, 6, 0, 0]} maxBarSize={34}>
              {shown.map((entry, index) => (
                <Cell key={entry.jabatan} fill={JABATAN_COLORS[index % JABATAN_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
