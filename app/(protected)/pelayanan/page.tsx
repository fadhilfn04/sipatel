'use client';

import { Fragment } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import { Container } from '@/components/common/container';

export default function PelayananPage() {
  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Pelayanan"
            description="Layanan Kematian dan Sosial"
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
              <h3 className="text-lg font-semibold mb-4">Dana Kematian</h3>
              <p className="text-muted-foreground mb-4">
                Pengelolaan dana kematian untuk anggota yang meninggal dunia.
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
                <li>Pengajuan klaim dana kematian</li>
                <li>Verifikasi dokumen persyaratan</li>
                <li>Proses pencairan dana</li>
                <li>Riwayat klaim kematian</li>
              </ul>
            </div>
            <div className="bg-card p-6 rounded-lg border border-border">
              <h3 className="text-lg font-semibold mb-4">Dana Sosial</h3>
              <p className="text-muted-foreground mb-4">
                Program bantuan sosial untuk anggota yang membutuhkan.
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
                <li>Pengajuan bantuan sosial</li>
                <li>Kriteria dan syarat penerimaan</li>
                <li>Monitoring penyaluran dana</li>
                <li>Laporan program sosial</li>
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </Fragment>
  );
}
