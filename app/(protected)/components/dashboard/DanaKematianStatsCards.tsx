'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, CheckCircle, Clock, XCircle, DollarSign, TrendingUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DanaKematian } from '@/lib/supabase';

interface StatsData {
  total: number;
  verifikasi_cabang: number;
  proses_pusat: number;
  verified: number;
  ditolak: number;
  selesai: number;
  total_dana: number;
  avg_duration: number | null;
}

interface DanaKematianStatsCardsProps {
  onFilterClick?: (status: string) => void;
}

export function DanaKematianStatsCards({ onFilterClick }: DanaKematianStatsCardsProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dana-kematian/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading || !stats) {
    return <StatsCardsSkeleton />;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const cards = [
    {
      title: 'Total Pengajuan',
      value: stats.total,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      onClick: () => onFilterClick?.('all'),
    },
    {
      title: 'Verifikasi Cabang',
      value: stats.verifikasi_cabang,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      onClick: () => onFilterClick?.('verifikasi_cabang'),
    },
    {
      title: 'Proses Pusat',
      value: stats.proses_pusat,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      onClick: () => onFilterClick?.('proses_pusat'),
    },
    {
      title: 'Disetujui',
      value: stats.verified,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      onClick: () => onFilterClick?.('verified'),
    },
    {
      title: 'Ditolak',
      value: stats.ditolak,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      onClick: () => onFilterClick?.('ditolak'),
    },
    {
      title: 'Selesai',
      value: stats.selesai,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      onClick: () => onFilterClick?.('selesai'),
    },
    {
      title: 'Total Dana Dicairkan',
      value: formatCurrency(stats.total_dana),
      icon: DollarSign,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      isCurrency: true,
      onClick: () => onFilterClick?.('selesai'),
    },
    {
      title: 'Rata-rata Durasi',
      value: stats.avg_duration ? `${stats.avg_duration} hari` : '-',
      icon: TrendingUp,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      isDuration: true,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Ringkasan Dana Kematian</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStats}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card
              key={index}
              className={`cursor-pointer hover:shadow-md transition-shadow ${card.onClick ? 'hover:bg-gray-50' : ''}`}
              onClick={card.onClick}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                {card.title === 'Total Pengajuan' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Semua status pengajuan
                  </p>
                )}
                {card.isCurrency && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Dana yang sudah cair
                  </p>
                )}
                {card.isDuration && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Rata-rata waktu proses
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-right">
        Terakhir update: {lastUpdated.toLocaleString('id-ID')}
      </p>
    </div>
  );
}

function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-10 rounded-lg" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-24 mb-2" />
            <Skeleton className="h-3 w-40" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
