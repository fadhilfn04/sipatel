'use client';

import { Fragment } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import { Container } from '@/components/common/container';

export default function AgendaSuratPage() {
  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Agenda Surat"
            description="Agenda dan Disposisi Surat"
          />
          <ToolbarActions>
            {/* Add action buttons here */}
          </ToolbarActions>
        </Toolbar>
      </Container>
      <Container>
        <div className="bg-card p-6 rounded-lg border border-border">
          <h3 className="text-lg font-semibold mb-4">Agenda Surat</h3>
          <p className="text-muted-foreground">
            Halaman ini akan beraci agenda surat harian, sistem disposisi,
            monitoring tindak lanjut surat, dan laporan agenda surat
            secara digital.
          </p>
        </div>
      </Container>
    </Fragment>
  );
}
