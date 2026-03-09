'use client';

import { Fragment } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import { Container } from '@/components/common/container';

export default function PengelolaanDataPage() {
  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Pengelolaan Data"
            description="Kelola data keanggotaan"
          />
          <ToolbarActions>
            {/* Add action buttons here */}
          </ToolbarActions>
        </Toolbar>
      </Container>
      <Container>
        <div className="bg-card p-6 rounded-lg border border-border">
          <h3 className="text-lg font-semibold mb-4">Pengelolaan Data Anggota</h3>
          <p className="text-muted-foreground">
            Halaman ini akan berisi formulir dan tabel untuk pengelolaan data anggota,
            termasuk tambah, edit, dan hapus data anggota.
          </p>
        </div>
      </Container>
    </Fragment>
  );
}
