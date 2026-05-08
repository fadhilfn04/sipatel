import { StatisticsCards } from './StatisticsCards';
import { LatestMembers } from './LatestMembers';
import { LatestClaims } from './LatestClaims';
import { LatestSocial } from './LatestSocial';
import { DanaKematianMonitoringDashboard } from './DanaKematianMonitoringDashboard';
import { useDashboardStats, useLatestData } from '@/lib/hooks/use-dashboard-api';

export function DashboardContent() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: latestData, isLoading: latestLoading } = useLatestData('both', 5);

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <StatisticsCards
        stats={stats || {
          totalAnggota: 0,
          anggotaAktif: 0,
          anggotaMeninggal: 0,
          totalKlaim: 0,
          klaimPending: 0,
          totalDicairkan: 0,
          totalDanaSosial: 0,
          danaSosialPending: 0,
          totalDanaSosialDicairkan: 0,
        }}
        isLoading={statsLoading}
      />

      {/* Dana Kematian Monitoring Dashboard */}
      <DanaKematianMonitoringDashboard />

      {/* Latest Data Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest Members - Full width on mobile, 1 column on desktop */}
        <div className="lg:col-span-1">
          <LatestMembers
            members={latestData?.anggota || []}
            isLoading={latestLoading}
          />
        </div>

        {/* Latest Claims - Full width on mobile, 1 column on desktop */}
        <div className="lg:col-span-1">
          <LatestClaims
            claims={latestData?.klaim || []}
            isLoading={latestLoading}
          />
        </div>

        {/* Latest Social - Full width on mobile, 1 column on desktop */}
        <div className="lg:col-span-1">
          <LatestSocial
            social={latestData?.sosial || []}
            isLoading={latestLoading}
          />
        </div>
      </div>
    </div>
  );
}
