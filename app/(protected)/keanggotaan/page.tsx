'use client';

import { Fragment } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import { Container } from '@/components/common/container';

export default function KeanggotaanPage() {
  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Keanggotaan"
            description="Pengelolaan Data Keanggotaan"
          />
          <ToolbarActions>
            {/* Add action buttons here */}
          </ToolbarActions>
        </Toolbar>
      </Container>
      <Container>
        <div className="grid gap-5 lg:gap-7.5">
          <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5">
            <div className="lg:col-span-3">
              <div className="bg-card p-6 rounded-lg border border-border">
                <h3 className="text-lg font-semibold mb-4">Pengelolaan Data Keanggotaan</h3>
                <p className="text-muted-foreground">
                  Modul keanggotaan akan dikembangkan di sini. Halaman ini mencakup pengelolaan
                  data anggota, pendaftaran anggota baru, pembaruan data anggota, dan manajemen
                  status keanggotaan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Fragment>
  );
}
