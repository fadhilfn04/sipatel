'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, TrendingUp, Eye, RefreshCw } from 'lucide-react';
import { DanaKematian } from '@/lib/supabase';
import { getTimelineProgress, getClaimDurationInfo, formatDuration } from '@/lib/utils/duration-calculator';

interface ActiveClaim {
  id: string;
  nama_anggota: string;
  status_proses: string;
  created_at: string;
  duration_info: any;
  progress: number;
}

interface DanaKematianProgressTrackerProps {
  onViewDetails?: (claimId: string) => void;
}

export function DanaKematianProgressTracker({ onViewDetails }: DanaKematianProgressTrackerProps) {
  const [claims, setClaims] = useState<ActiveClaim[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActiveClaims = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dana-kematian/active');
      if (response.ok) {
        const data = await response.json();
        setClaims(data);
      }
    } catch (error) {
      console.error('Error fetching active claims:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveClaims();
  }, []);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: any; label: string }> = {
      verifikasi_cabang: { variant: 'warning', label: 'Verifikasi Cabang' },
      pending_dokumen: { variant: 'secondary', label: 'Pending Dokumen' },
      proses_pusat: { variant: 'default', label: 'Proses Pusat' },
      verified: { variant: 'success', label: 'Disetujui' },
      penyaluran: { variant: 'info', label: 'Penyaluran' },
    };

    return statusMap[status] || { variant: 'secondary', label: status };
  };

  if (loading) {
    return <ProgressTrackerSkeleton />;
  }

  if (claims.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Pengajuan Aktif</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Tidak ada pengajuan aktif saat ini</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Pengajuan Aktif</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchActiveClaims}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {claims.map((claim) => {
          const status = getStatusBadge(claim.status_proses);
          const durationInfo = claim.duration_info;
          const isOverdue = durationInfo?.isOverdue;

          return (
            <div
              key={claim.id}
              className="p-4 border rounded-lg hover:bg-gray-50 transition-colors space-y-3"
            >
              {/* Header: Name and Status */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-sm">{claim.nama_anggota}</h4>
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(durationInfo?.totalDays || null)}
                  </p>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progres</span>
                  <span className="font-medium">{claim.progress}%</span>
                </div>
                <Progress value={claim.progress} className="h-2" />
              </div>

              {/* Duration Info */}
              {durationInfo && (
                <div className="flex items-center gap-2 text-xs">
                  {isOverdue ? (
                    <div className="flex items-center gap-1 text-red-600">
                      <TrendingUp className="h-3 w-3" />
                      <span>Terlambat {durationInfo.overdueDays} hari</span>
                    </div>
                  ) : (
                    <span className="text-green-600">
                      ✓ Sesuai jadwal
                    </span>
                  )}
                </div>
              )}

              {/* Action Button */}
              {onViewDetails && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => onViewDetails(claim.id)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Lihat Detail
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ProgressTrackerSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-4 border rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
