'use client';

import { Fragment } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import { Container } from '@/components/common/container';

export default function DanaSosialPage() {
  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Dana Sosial"
            description="Program Bantuan Sosial"
          />
          <ToolbarActions>
            {/* Add action buttons here */}
          </ToolbarActions>
        </Toolbar>
      </Container>
      <Container>
        <div className="bg-card p-6 rounded-lg border border-border">
          <h3 className="text-lg font-semibold mb-4">Program Dana Sosial</h3>
          <p className="text-muted-foreground">
            Halaman ini akan berisi formulir pengajuan bantuan sosial,
            verifikasi penerima, monitoring penyaluran, dan laporan program.
          </p>
        </div>
      </Container>
    </Fragment>
  );
}
