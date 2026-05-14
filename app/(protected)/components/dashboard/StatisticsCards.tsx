import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Users, UserCheck, UserX, FileText, Clock, DollarSign, Heart, HelpCircle } from 'lucide-react';
import { Badge, BadgeDot } from '@/components/ui/badge';
import { DashboardStats } from '@/lib/hooks/use-dashboard-api';

interface StatisticsCardsProps {
  stats: DashboardStats;
  isLoading: boolean;
}

export function StatisticsCards({ stats, isLoading }: StatisticsCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const cards = [
    {
      title: 'Total Anggota',
      value: formatNumber(stats.totalAnggota),
      icon: Users,
      color: 'blue',
      description: 'Semua anggota terdaftar',
    },
    {
      title: 'Anggota Aktif',
      value: formatNumber(stats.anggotaAktif),
      icon: UserCheck,
      color: 'green',
      description: 'Anggota status aktif',
      percentage: stats.totalAnggota > 0 ? ((stats.anggotaAktif / stats.totalAnggota) * 100).toFixed(1) : '0',
    },
    {
      title: 'Anggota Meninggal',
      value: formatNumber(stats.anggotaMeninggal),
      icon: UserX,
      color: 'red',
      description: 'Anggota telah meninggal',
    },
    {
      title: 'Total Klaim Dana Kematian',
      value: formatNumber(stats.totalKlaim),
      icon: FileText,
      color: 'purple',
      description: 'Semua klaim yang diajukan',
    },
    {
      title: 'Klaim Pending',
      value: formatNumber(stats.klaimPending ?? 0),
      icon: Clock,
      color: 'yellow',
      description: 'Menunggu proses',
      showBadge: (stats.klaimPending ?? 0) > 0,
    },
    {
      title: 'Total Dana Kematian Dicairkan',
      value: formatCurrency(stats.totalDicairkan),
      icon: DollarSign,
      color: 'emerald',
      description: 'Total yang sudah dibayar',
    },
    {
      title: 'Total Dana Sosial',
      value: formatNumber(stats.totalDanaSosial),
      icon: Heart,
      color: 'pink',
      description: 'Semua bantuan sosial',
    },
    {
      title: 'Dana Sosial Dicairkan',
      value: formatCurrency(stats.totalDanaSosialDicairkan),
      icon: DollarSign,
      color: 'cyan',
      description: 'Total bantuan disalurkan',
    },
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: {
        bg: 'bg-blue-50 dark:bg-blue-950',
        icon: 'text-blue-600 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-800',
      },
      green: {
        bg: 'bg-green-50 dark:bg-green-950',
        icon: 'text-green-600 dark:text-green-400',
        border: 'border-green-200 dark:border-green-800',
      },
      red: {
        bg: 'bg-red-50 dark:bg-red-950',
        icon: 'text-red-600 dark:text-red-400',
        border: 'border-red-200 dark:border-red-800',
      },
      purple: {
        bg: 'bg-purple-50 dark:bg-purple-950',
        icon: 'text-purple-600 dark:text-purple-400',
        border: 'border-purple-200 dark:border-purple-800',
      },
      yellow: {
        bg: 'bg-yellow-50 dark:bg-yellow-950',
        icon: 'text-yellow-600 dark:text-yellow-400',
        border: 'border-yellow-200 dark:border-yellow-800',
      },
      emerald: {
        bg: 'bg-emerald-50 dark:bg-emerald-950',
        icon: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-800',
      },
      pink: {
        bg: 'bg-pink-50 dark:bg-pink-950',
        icon: 'text-pink-600 dark:text-pink-400',
        border: 'border-pink-200 dark:border-pink-800',
      },
      cyan: {
        bg: 'bg-cyan-50 dark:bg-cyan-950',
        icon: 'text-cyan-600 dark:text-cyan-400',
        border: 'border-cyan-200 dark:border-cyan-800',
      },
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const colorClasses = getColorClasses(card.color);

        return (
          <Card
            key={index}
            className={`hover:shadow-lg transition-shadow duration-200 ${colorClasses.border} border-2`}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${colorClasses.bg}`}>
                  <Icon className={`h-5 w-5 ${colorClasses.icon}`} />
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </span>
              </div>
              {card.showBadge && (
                <Badge variant="warning" appearance="ghost">
                  <BadgeDot />
                  Pending
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="text-2xl font-bold">{card.value}</div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{card.description}</p>
                  {card.percentage && (
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">
                      {card.percentage}%
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
