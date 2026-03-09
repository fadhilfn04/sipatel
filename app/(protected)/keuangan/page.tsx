'use client';

import { Fragment } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import { Container } from '@/components/common/container';

export default function KeuanganPage() {
  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Keuangan"
            description="Laporan dan Mekanisme Keuangan"
          />
          <ToolbarActions>
            {/* Add action buttons here */}
          </ToolbarActions>
        </Toolbar>
      </Container>
      <Container>
        <div className="grid gap-5 lg:gap-7.5">
          <div className="grid lg:grid-cols-2 gap-5 lg:gap-7.5">
            <div className="bg-card p-6 rounded-lg border border-border">
              <h3 className="text-lg font-semibold mb-4">Laporan Keuangan</h3>
              <p className="text-muted-foreground mb-4">
                Laporan keuangan organisasi secara transparan dan akuntabel.
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
                <li>Laporan bulanan dan tahunan</li>
                <li>Arus kas masuk dan keluar</li>
                <li>Balance sheet dan neraca</li>
                <li>Laporan laba rugi</li>
              </ul>
            </div>
            <div className="bg-card p-6 rounded-lg border border-border">
              <h3 className="text-lg font-semibold mb-4">Mekanisme Iuran</h3>
              <p className="text-muted-foreground mb-4">
                Sistem pengelolaan iuran anggota secara efektif dan efisien.
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
                <li>Jenis dan besaran iuran</li>
                <li>Jadwal pembayaran iuran</li>
                <li>Monitoring pembayaran</li>
                <li>Reminder dan denda keterlambatan</li>
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </Fragment>
  );
}
