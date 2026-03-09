'use client';

import { Fragment } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import { Container } from '@/components/common/container';

export default function SuratPage() {
  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Surat Elektronik"
            description="Manajemen Surat Digital"
          />
          <ToolbarActions>
            {/* Add action buttons here */}
          </ToolbarActions>
        </Toolbar>
      </Container>
      <Container>
        <div className="bg-card p-6 rounded-lg border border-border">
          <h3 className="text-lg font-semibold mb-4">Manajemen Surat</h3>
          <p className="text-muted-foreground">
            Halaman ini akan berisi sistem manajemen surat digital, termasuk
            pembuatan surat, pengiriman, penerimaan, tracking status, dan
            arsip surat secara elektronik.
          </p>
        </div>
      </Container>
    </Fragment>
  );
}
