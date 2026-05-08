'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { DanaKematianStatsCards } from './DanaKematianStatsCards';
import { DanaKematianProgressTracker } from './DanaKematianProgressTracker';
import { useRouter } from 'next/navigation';

interface DanaKematianMonitoringDashboardProps {
  className?: string;
}

export function DanaKematianMonitoringDashboard({
  className,
}: DanaKematianMonitoringDashboardProps) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const handleFilterClick = (status: string) => {
    if (status === 'all') {
      setSelectedStatus(null);
      router.push('/pelayanan/dana-kematian');
    } else {
      setSelectedStatus(status);
      router.push(`/pelayanan/dana-kematian?status=${status}`);
    }
  };

  const handleViewDetails = (claimId: string) => {
    router.push(`/pelayanan/dana-kematian?id=${claimId}`);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Statistics Cards */}
      <DanaKematianStatsCards onFilterClick={handleFilterClick} />

      {/* Progress Tracker */}
      <DanaKematianProgressTracker onViewDetails={handleViewDetails} />
    </div>
  );
}
