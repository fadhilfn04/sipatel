'use client';

import { Fragment, useState } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import { Container } from '@/components/common/container';
import { DashboardContent } from '.';
import { PeriodFilter } from './period-filter';
import { DashboardPeriod } from '@/lib/hooks/use-dashboard-api';

export function DashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>('30d');

  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Dasbor"
            description="Ringkasan keanggotaan & aktivitas operasional SIPATEL"
          />
          <ToolbarActions>
            <PeriodFilter value={period} onChange={setPeriod} />
          </ToolbarActions>
        </Toolbar>
      </Container>
      <Container>
        <DashboardContent period={period} />
      </Container>
    </Fragment>
  );
}

