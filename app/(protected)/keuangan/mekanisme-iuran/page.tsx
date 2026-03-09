'use client';

import { Fragment } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import { Container } from '@/components/common/container';

export default function MekanismeIuranPage() {
  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Mekanisme Iuran"
            description="Sistem Pengelolaan Iuran"
          />
          <ToolbarActions>
            {/* Add action buttons here */}
          </ToolbarActions>
        </Toolbar>
      </Container>
      <Container>
        <div className="bg-card p-6 rounded-lg border border-border">
          <h3 className="text-lg font-semibold mb-4">Mekanisme Iuran Anggota</h3>
          <p className="text-muted-foreground">
            Halaman ini akan berisi pengaturan jenis dan besaran iuran,
            monitoring pembayaran iuran anggota, sistem reminder otomatis,
            dan manajemen denda keterlambatan.
          </p>
        </div>
      </Container>
    </Fragment>
  );
}
