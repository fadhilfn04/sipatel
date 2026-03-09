'use client';

import { Fragment } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import { Container } from '@/components/common/container';

export default function LaporanKeuanganPage() {
  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Laporan Keuangan"
            description="Laporan Keuangan Organisasi"
          />
          <ToolbarActions>
            {/* Add action buttons here */}
          </ToolbarActions>
        </Toolbar>
      </Container>
      <Container>
        <div className="bg-card p-6 rounded-lg border border-border">
          <h3 className="text-lg font-semibold mb-4">Laporan Keuangan</h3>
          <p className="text-muted-foreground">
            Halaman ini akan berisi laporan keuangan organisasi, termasuk
            laporan bulanan, tahunan, arus kas, neraca, dan laba rugi.
            Data akan ditampilkan dalam bentuk tabel dan grafik.
          </p>
        </div>
      </Container>
    </Fragment>
  );
}
