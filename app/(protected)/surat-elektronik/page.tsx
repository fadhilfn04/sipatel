'use client';

import { Fragment } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import { Container } from '@/components/common/container';

export default function SuratElektronikPage() {
  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Surat Elektronik"
            description="Manajemen Surat dan Agenda"
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
              <h3 className="text-lg font-semibold mb-4">Surat Elektronik</h3>
              <p className="text-muted-foreground mb-4">
                Manajemen surat masuk dan keluar secara digital.
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
                <li>Buat dan kirim surat baru</li>
                <li>Surat masuk dan keluar</li>
                <li>Tracking status surat</li>
                <li>Arsip surat digital</li>
              </ul>
            </div>
            <div className="bg-card p-6 rounded-lg border border-border">
              <h3 className="text-lg font-semibold mb-4">Agenda Surat</h3>
              <p className="text-muted-foreground mb-4">
                Pengelolaan agenda dan disposisi surat.
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
                <li>Agenda surat harian</li>
                <li>Disposisi surat</li>
                <li>Monitoring tindak lanjut</li>
                <li>Laporan agenda surat</li>
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </Fragment>
  );
}
