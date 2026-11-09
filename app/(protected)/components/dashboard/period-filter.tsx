'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DASHBOARD_PERIODS,
  DashboardPeriod,
} from '@/lib/hooks/use-dashboard-api';

interface PeriodFilterProps {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
}

/** Filter periode global dashboard: 7 hari / 30 hari / 3 bulan / 6 bulan / 1 tahun. */
export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as DashboardPeriod)}>
      <TabsList variant="default" size="sm" className="flex-wrap">
        {DASHBOARD_PERIODS.map((period) => (
          <TabsTrigger key={period.value} value={period.value} className="whitespace-nowrap">
            {period.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
