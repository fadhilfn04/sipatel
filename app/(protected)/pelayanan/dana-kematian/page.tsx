'use client';

import { Fragment } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import { Container } from '@/components/common/container';

export default function DanaKematianPage() {
  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Dana Kematian"
            description="Pengelolaan Dana Kematian"
          />
          <ToolbarActions>
            {/* Add action buttons here */}
          </ToolbarActions>
        </Toolbar>
      </Container>
      <Container>
        <div className="bg-card p-6 rounded-lg border border-border">
          <h3 className="text-lg font-semibold mb-4">Formulir Dana Kematian</h3>
          <p className="text-muted-foreground">
            Halaman ini akan berisi formulir pengajuan dan manajemen dana kematian,
            termasuk verifikasi dokumen, proses approval, dan pencairan dana.
          </p>
        </div>
      </Container>
    </Fragment>
  );
}
