'use client';

import { DanaKematian } from '@/lib/supabase';
import {
  calculateAllDurations,
  formatDuration,
  getSLAStatus,
} from '@/lib/utils/duration-calculator';
import { DOCUMENT_PHASES } from '@/lib/config/dana-kematian-config';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PhaseProgressBarProps {
  claim: DanaKematian;
  showLabels?: boolean;
  showDurations?: boolean;
  compact?: boolean;
}

export function PhaseProgressBar({
  claim,
  showLabels = true,
  showDurations = false,
  compact = false,
}: PhaseProgressBarProps) {
  const durations = calculateAllDurations(claim);
  const phases = Object.entries(DOCUMENT_PHASES) as Array<
    [string, typeof DOCUMENT_PHASES[keyof typeof DOCUMENT_PHASES]]
  >;

  // Calculate overall progress
  const timelineFields = [
    claim.waktu_0,
    claim.waktu_1,
    claim.waktu_2,
    claim.waktu_3,
    claim.waktu_4,
    claim.waktu_5,
    claim.waktu_6,
    claim.waktu_7,
  ];
  const completedFields = timelineFields.filter((t) => t !== null).length;
  const overallProgress = Math.round((completedFields / timelineFields.length) * 100);

  // Determine phase status
  const getPhaseStatus = (index: number) => {
    const phaseKeys = Object.keys(DOCUMENT_PHASES);
    for (let i = 0; i <= index; i++) {
      const key = phaseKeys[i] as keyof typeof DOCUMENT_PHASES;
      const phase = DOCUMENT_PHASES[key];
      const hasEndTime = claim[phase.to as keyof DanaKematian] !== null;

      if (i === index && !hasEndTime && claim[phase.from as keyof DanaKematian]) {
        return 'current';
      }
      if (hasEndTime) {
        return 'completed';
      }
    }
    return 'pending';
  };

  const getPhaseColor = (status: string, index: number) => {
    if (status === 'completed') return 'bg-blue-500';
    if (status === 'current') return 'bg-yellow-500';
    return 'bg-gray-200';
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Progres</span>
          <span className="text-muted-foreground">{overallProgress}%</span>
        </div>
        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Overall Progress */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Progress Proses</span>
        <span className="text-sm font-semibold text-blue-600">{overallProgress}%</span>
      </div>

      {/* Phase Bar */}
      <div className="relative">
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex">
          {phases.map(([key, phase], index) => {
            const status = getPhaseStatus(index);
            const color = getPhaseColor(status, index);
            const duration = durations[key as keyof typeof durations];
            const slaStatus = getSLAStatus(duration, phase.slaDays);

            return (
              <TooltipProvider key={key}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`${color} hover:opacity-80 transition-opacity cursor-help`}
                      style={{ width: `${100 / phases.length}%` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-medium">{phase.label}</p>
                      <p className="text-xs text-muted-foreground">
                        SLA: {phase.slaDays} hari
                      </p>
                      {duration !== null && (
                        <>
                          <p className="text-xs">
                            Durasi: <span className="font-semibold">{formatDuration(duration)}</span>
                          </p>
                          <p
                            className={`text-xs font-medium ${
                              slaStatus.status === 'overdue'
                                ? 'text-red-600'
                                : slaStatus.status === 'at_risk'
                                ? 'text-yellow-600'
                                : 'text-green-600'
                            }`}
                          >
                            Status:{' '}
                            {slaStatus.status === 'overdue'
                              ? 'Terlambat'
                              : slaStatus.status === 'at_risk'
                              ? 'Risiko Terlambat'
                              : 'Tepat Waktu'}
                          </p>
                        </>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        {/* Phase Indicators */}
        {showLabels && (
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            {phases.map(([key, phase], index) => {
              const status = getPhaseStatus(index);
              const duration = durations[key as keyof typeof durations];

              return (
                <div key={key} className="text-center flex-1">
                  <div className="font-medium">{phase.label}</div>
                  {showDurations && duration !== null && (
                    <div className="text-[10px] mt-0.5">
                      {formatDuration(duration)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500 rounded" />
          <span>Selesai</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-500 rounded" />
          <span>Sedang Proses</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-200 rounded" />
          <span>Belum</span>
        </div>
      </div>
    </div>
  );
}
