'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardList, ChevronRight } from 'lucide-react';
import { DashboardOverviewResponse } from '@/lib/hooks/use-dashboard-api';

interface MonitoringWidgetProps {
  monitoring: DashboardOverviewResponse['monitoring'] | undefined;
  isLoading: boolean;
}

interface MonitoringRow {
  key: string;
  label: string;
  data: Record<string, number> | null;
  href: string;
}

const formatNumber = (n: number) => new Intl.NumberFormat('id-ID').format(n);

/**
 * Monitoring pengajuan lintas modul: menunggu / selesai / ditolak.
 * Hanya modul yang diizinkan server yang ditampilkan.
 */
export function MonitoringWidget({ monitoring, isLoading }: MonitoringWidgetProps) {
  const rows: MonitoringRow[] = [
    { key: 'mutasi', label: 'Mutasi Cabang', data: monitoring?.mutasi ?? null, href: '/mutasi-cabang' },
    {
      key: 'pengakhiran',
      label: 'Pengakhiran Keanggotaan',
      data: monitoring?.pengakhiran ?? null,
      href: '/keanggotaan/pengakhiran-keanggotaan',
    },
    {
      key: 'kepengurusan',
      label: 'Perubahan Kepengurusan',
      data: monitoring?.kepengurusan ?? null,
      href: '/keanggotaan/perubahan-kepengurusan',
    },
    {
      key: 'danaKematian',
      label: 'Dana Kematian',
      data: monitoring?.danaKematian ?? null,
      href: '/pelayanan/dana-kematian',
    },
  ].filter((r) => r.data !== null);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4 text-orange-500" />
          Monitoring Pengajuan
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Tidak ada modul pengajuan yang dapat dipantau
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => {
              const d = row.data || {};
              const menunggu = (d.menunggu || 0) + (d.diverifikasi || 0);
              return (
                <Link
                  key={row.key}
                  href={row.href}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{row.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(menunggu)} menunggu · {formatNumber(d.selesai || 0)} selesai ·{' '}
                      {formatNumber(d.ditolak || 0)} ditolak
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {menunggu > 0 ? (
                      <Badge variant="warning" appearance="light" size="sm">
                        {formatNumber(menunggu)} pending
                      </Badge>
                    ) : (
                      <Badge variant="success" appearance="ghost" size="sm">
                        Bersih
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
            <Button variant="outline" size="sm" className="w-full mt-1" asChild>
              <Link href="/audit-trail">Lihat Riwayat Aktivitas</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
