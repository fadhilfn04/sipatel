'use client';

import { FileText, Search, CheckCircle, DollarSign, Send, Flag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DanaKematian } from '@/lib/supabase';
import { getTimelineEvents } from '@/lib/workflow/dana-kematian-state-machine';
import { formatDuration, getClaimDurationInfo } from '@/lib/utils/duration-calculator';

interface WorkflowStage {
  id: number;
  name: string;
  icon: any;
  description: string;
  waktuKey: keyof DanaKematian;
  order: number;
}

const WORKFLOW_STAGES: WorkflowStage[] = [
  {
    id: 1,
    name: 'Lapor',
    icon: FileText,
    description: 'Laporan kematian diterima',
    waktuKey: 'waktu_0',
    order: 1,
  },
  {
    id: 2,
    name: 'Verifikasi Cabang',
    icon: Search,
    description: 'PC melakukan verifikasi dokumen',
    waktuKey: 'waktu_1',
    order: 2,
  },
  {
    id: 3,
    name: 'Dokumen Lengkap',
    icon: CheckCircle,
    description: 'Semua dokumen lengkap dikirim',
    waktuKey: 'waktu_2',
    order: 3,
  },
  {
    id: 4,
    name: 'Pembayaran',
    icon: DollarSign,
    description: 'Persetujuan dan proses pembayaran',
    waktuKey: 'waktu_4',
    order: 4,
  },
  {
    id: 5,
    name: 'Transfer',
    icon: Send,
    description: 'Dana ditransfer ke PC',
    waktuKey: 'waktu_5',
    order: 5,
  },
  {
    id: 6,
    name: 'Selesai',
    icon: Flag,
    description: 'Dana diserahkan ke ahli waris',
    waktuKey: 'waktu_7',
    order: 6,
  },
];

interface WorkflowTimelineProps {
  claim: DanaKematian;
  vertical?: boolean;
  compact?: boolean;
  showDurations?: boolean;
}

export function WorkflowTimeline({
  claim,
  vertical = false,
  compact = false,
  showDurations = false,
}: WorkflowTimelineProps) {
  const durationInfo = getClaimDurationInfo(claim);
  const timelineEvents = getTimelineEvents(claim);

  // Calculate current stage
  const getCurrentStageIndex = () => {
    for (let i = WORKFLOW_STAGES.length - 1; i >= 0; i--) {
      const stage = WORKFLOW_STAGES[i];
      if (claim[stage.waktuKey]) {
        return i;
      }
    }
    return -1; // No stages completed yet
  };

  const currentStageIndex = getCurrentStageIndex();

  // Calculate overall progress
  const progressPercentage = ((currentStageIndex + 1) / WORKFLOW_STAGES.length) * 100;

  const getStageStatus = (stage: WorkflowStage) => {
    const hasCompleted = claim[stage.waktuKey] !== null;
    const isCurrent = !hasCompleted && stage.order === currentStageIndex + 2;
    const isPending = !hasCompleted && !isCurrent;

    return { hasCompleted, isCurrent, isPending };
  };

  const calculateStageDuration = (stageIndex: number) => {
    const currentStage = WORKFLOW_STAGES[stageIndex];
    const prevStage = WORKFLOW_STAGES[stageIndex - 1];

    if (!claim[currentStage.waktuKey]) return null;

    const startDate = prevStage?.waktuKey ? claim[prevStage.waktuKey] : claim.waktu_0;
    const endDate = claim[currentStage.waktuKey];

    if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') return null;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    return diffDays;
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Progress Pengajuan</span>
          <Badge variant={progressPercentage === 100 ? 'success' : 'secondary'}>
            {Math.round(progressPercentage)}%
          </Badge>
        </div>
        <Progress value={progressPercentage} className="h-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Tahap {currentStageIndex + 1} dari {WORKFLOW_STAGES.length}</span>
          {durationInfo.totalDays > 0 && (
            <span>{formatDuration(durationInfo.totalDays)}</span>
          )}
        </div>
      </div>
    );
  }

  if (vertical) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progress Pengajuan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {WORKFLOW_STAGES.map((stage, index) => {
              const { hasCompleted, isCurrent, isPending } = getStageStatus(stage);
              const Icon = stage.icon;
              const duration = showDurations ? calculateStageDuration(index) : null;

              return (
                <div key={stage.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                        hasCompleted
                          ? 'bg-green-100 border-green-500 text-green-600'
                          : isCurrent
                          ? 'bg-blue-100 border-blue-500 text-blue-600'
                          : 'bg-gray-100 border-gray-300 text-gray-400'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    {index < WORKFLOW_STAGES.length - 1 && (
                      <div
                        className={`w-0.5 flex-1 my-1 ${
                          hasCompleted ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      />
                    )}
                  </div>

                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className={`font-medium ${isCurrent ? 'text-blue-600' : ''}`}>
                          {stage.name}
                        </h4>
                        <p className="text-xs text-muted-foreground">{stage.description}</p>
                      </div>
                      {hasCompleted && (
                        <Badge variant="success" size="xs">
                          Selesai
                        </Badge>
                      )}
                    </div>

                    {claim[stage.waktuKey] && typeof claim[stage.waktuKey] === 'string' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(claim[stage.waktuKey] as string).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    )}

                    {duration !== null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Durasi: {formatDuration(duration)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Horizontal timeline
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Progress Pengajuan</CardTitle>
          <Badge variant={progressPercentage === 100 ? 'success' : 'secondary'}>
            {Math.round(progressPercentage)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <Progress value={progressPercentage} className="h-2" />

        {/* Timeline Stages */}
        <div className="relative">
          {/* Connecting Line */}
          <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-200 -z-10" />

          <div className="flex justify-between">
            {WORKFLOW_STAGES.map((stage, index) => {
              const { hasCompleted, isCurrent, isPending } = getStageStatus(stage);
              const Icon = stage.icon;
              const duration = showDurations ? calculateStageDuration(index) : null;

              return (
                <div key={stage.id} className="flex flex-col items-center gap-2 flex-1">
                  {/* Stage Icon */}
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                      hasCompleted
                        ? 'bg-green-100 border-green-500 text-green-600'
                        : isCurrent
                        ? 'bg-blue-100 border-blue-500 text-blue-600'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}
                    title={stage.description}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Stage Name */}
                  <div className="text-center">
                    <p
                      className={`text-xs font-medium ${
                        isCurrent ? 'text-blue-600' : hasCompleted ? 'text-green-600' : 'text-gray-500'
                      }`}
                    >
                      {stage.name}
                    </p>
                    {claim[stage.waktuKey] && typeof claim[stage.waktuKey] === 'string' && (
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(claim[stage.waktuKey] as string).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    )}
                    {duration !== null && (
                      <p className="text-[10px] text-muted-foreground">
                        {duration} hari
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Duration Info */}
        {durationInfo.totalDays > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>Total Durasi</span>
            <span className={durationInfo.isOverdue ? 'text-red-600 font-medium' : ''}>
              {formatDuration(durationInfo.totalDays)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface WorkflowTimelineSimpleProps {
  claim: DanaKematian;
}

/**
 * Simplified version for compact display
 */
export function WorkflowTimelineSimple({ claim }: WorkflowTimelineSimpleProps) {
  const timelineEvents = getTimelineEvents(claim);
  const completedCount = timelineEvents.filter((e) => e.completed).length;
  const progressPercentage = (completedCount / timelineEvents.length) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Progress</span>
        <span className="text-muted-foreground">{completedCount}/{timelineEvents.length}</span>
      </div>
      <Progress value={progressPercentage} className="h-1.5" />
    </div>
  );
}
