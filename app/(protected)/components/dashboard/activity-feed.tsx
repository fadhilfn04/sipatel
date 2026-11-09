'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge, BadgeDot } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { History, ChevronRight } from 'lucide-react';
import { DashboardActivity } from '@/lib/hooks/use-dashboard-api';

interface ActivityFeedProps {
  activities: DashboardActivity[] | undefined;
  isLoading: boolean;
  auditEnabled: boolean;
}

/** Pemetaan tabel audit → deskripsi aktivitas yang mudah dibaca. */
function describeActivity(item: DashboardActivity): string {
  const t = item.table_name;
  switch (t) {
    case 'anggota':
      return item.action === 'CREATE'
        ? 'mendaftarkan anggota baru'
        : 'mengubah data anggota';
    case 'anggota_kematian':
      return 'mencatat data meninggal dunia';
    case 'anggota_kepengurusan':
      return 'mengubah kepengurusan / jabatan';
    case 'anggota_rekening':
      return 'mengganti rekening bank anggota';
    case 'pengajuan_mutasi_cabang':
      return 'mengajukan mutasi cabang';
    case 'pengakhiran_keanggotaan':
      return 'memproses pengakhiran keanggotaan';
    case 'dana_kematian':
      return 'memproses pengajuan Dana Kematian';
    case 'dana_sosial':
      return 'memproses Dana Sosial';
    case 'pembayaran_sumbangan':
      return 'mencatat pembayaran sumbangan';
    default:
      return `aktivitas pada ${item.module.replace(/_/g, ' ')}`;
  }
}

const ACTION_VARIANT: Record<string, { variant: 'secondary' | 'success' | 'warning' | 'destructive' | 'info'; label: string }> = {
  CREATE: { variant: 'success', label: 'Baru' },
  UPDATE: { variant: 'info', label: 'Ubah' },
  DELETE: { variant: 'destructive', label: 'Hapus' },
  RESTORE: { variant: 'warning', label: 'Pulihkan' },
  APPROVE: { variant: 'success', label: 'Setujui' },
  REJECT: { variant: 'destructive', label: 'Tolak' },
  VERIFY: { variant: 'info', label: 'Verifikasi' },
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const diffMin = Math.floor((now - d.getTime()) / 60000);
  if (diffMin < 1) return 'baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)} jam lalu`;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Feed aktivitas administratif terbaru dari seluruh modul (sumber: audit_log). */
export function ActivityFeed({ activities, isLoading, auditEnabled }: ActivityFeedProps) {
  const items = activities || [];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between w-full">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-blue-500" />
            Aktivitas Terbaru
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <Link href="/audit-trail" title="Lihat semua aktivitas">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : !auditEnabled ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            Audit trail belum aktif. Jalankan migration{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">036_create_audit_trail.sql</code>{' '}
            untuk mengaktifkan riwayat aktivitas.
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Belum ada aktivitas tercatat
          </p>
        ) : (
          <div className="space-y-1">
            {items.map((item) => {
              const action = ACTION_VARIANT[item.action] || { variant: 'secondary' as const, label: item.action };
              const subject = item.anggota?.nama_anggota ?? undefined;
              return (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm leading-snug">
                      <span className="font-semibold">{item.actor_name || 'Sistem'}</span>{' '}
                      <span className="text-muted-foreground">{describeActivity(item)}</span>
                      {subject && <span className="font-medium"> · {subject}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatTime(item.occurred_at)}
                      {item.actor_role_slug ? ` · ${item.actor_role_slug}` : ''}
                    </p>
                  </div>
                  <Badge variant={action.variant} appearance="ghost" size="sm" className="shrink-0">
                    <BadgeDot />
                    {action.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
