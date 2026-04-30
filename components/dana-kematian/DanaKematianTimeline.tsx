'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';
import { DanaKematian } from '@/lib/supabase';
import { getTimelineEvents, getCurrentStageInfo } from '@/lib/workflow/dana-kematian-state-machine';

interface DanaKematianTimelineProps {
  claim: DanaKematian;
  showLabels?: boolean;
  compact?: boolean;
}

export function DanaKematianTimeline({ claim, showLabels = true, compact = false }: DanaKematianTimelineProps) {
  const timelineEvents = getTimelineEvents(claim);
  const stageInfo = getCurrentStageInfo(claim);

  const formatWaktuDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getWaktuIcon = (completed: boolean, index: number) => {
    if (completed) {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    } else if (index === timelineEvents.findIndex(e => !e.completed)) {
      return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />;
    } else {
      return <Circle className="h-5 w-5 text-gray-300" />;
    }
  };

  const getWaktuStatus = (completed: boolean, date: string | null) => {
    if (completed) return 'completed';
    if (!date) return 'pending';
    return 'current';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {timelineEvents.map((event, index) => (
          <React.Fragment key={event.waktu}>
            <div className="flex items-center gap-1 min-w-fit">
              {getWaktuIcon(event.completed, index)}
              <div className="flex flex-col">
                <span className="text-xs font-medium">{event.waktu}</span>
                <span className="text-xs text-muted-foreground">
                  {formatWaktuDate(event.date)}
                </span>
              </div>
            </div>
            {index < timelineEvents.length - 1 && (
              <div className={`h-0.5 w-8 ${event.completed ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Timeline Proses</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {stageInfo.stage} - {stageInfo.description}
        </p>
        <div className="mt-2">
          <Badge variant={stageInfo.percentComplete === 100 ? 'success' : 'secondary'}>
            {stageInfo.percentComplete}% Complete
          </Badge>
        </div>
      </div>

      <div className="space-y-4">
        {timelineEvents.map((event, index) => {
          const status = getWaktuStatus(event.completed, event.date);
          const isCurrent = status === 'current';

          return (
            <div key={event.waktu} className="flex gap-4">
              {/* Icon and connector line */}
              <div className="flex flex-col items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  status === 'completed' ? 'bg-green-100' :
                  status === 'current' ? 'bg-blue-100' :
                  'bg-gray-100'
                }`}>
                  {getWaktuIcon(event.completed, index)}
                </div>
                {index < timelineEvents.length - 1 && (
                  <div className={`w-0.5 h-full min-h-[60px] mt-2 ${
                    event.completed ? 'bg-green-500' :
                    isCurrent ? 'bg-blue-500' :
                    'bg-gray-200'
                  }`} />
                )}
              </div>

              {/* Content */}
              <div className={`flex-1 pb-6 ${index === timelineEvents.length - 1 ? 'pb-0' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-semibold ${
                        status === 'completed' ? 'text-green-700' :
                        isCurrent ? 'text-blue-700' :
                        'text-gray-700'
                      }`}>
                        {event.label}
                      </h4>
                      {showLabels && (
                        <Badge variant={
                          status === 'completed' ? 'success' :
                          isCurrent ? 'secondary' :
                          'secondary'
                        } className="text-xs">
                          {event.waktu}
                        </Badge>
                      )}
                      {isCurrent && (
                        <Badge variant="secondary" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {event.description}
                    </p>
                    {event.date && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatWaktuDate(event.date)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Next step indicator */}
      {stageInfo.nextStep && stageInfo.percentComplete < 100 && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900">Langkah Selanjutnya</h4>
              <p className="text-sm text-blue-800 mt-1">{stageInfo.nextStep}</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// Export a simpler version for inline use
export function DanaKematianTimelineCompact({ claim }: { claim: DanaKematian }) {
  return <DanaKematianTimeline claim={claim} compact={true} showLabels={false} />;
}

// Export status badge component
export function DanaKematianStatusBadge({ claim }: { claim: DanaKematian }) {
  const stageInfo = getCurrentStageInfo(claim);

  return (
    <div className="flex items-center gap-2">
      <Badge variant={stageInfo.percentComplete === 100 ? 'success' : 'secondary'}>
        {stageInfo.percentComplete}% Complete
      </Badge>
      <span className="text-sm text-muted-foreground">{stageInfo.stage}</span>
    </div>
  );
}

// Export timeline progress bar
export function DanaKematianTimelineProgress({ claim }: { claim: DanaKematian }) {
  const timelineEvents = getTimelineEvents(claim);
  const completedEvents = timelineEvents.filter(e => e.completed).length;
  const progress = (completedEvents / timelineEvents.length) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Progress</span>
        <span className="text-muted-foreground">{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Waktu-0</span>
        <span>Waktu-7</span>
      </div>
    </div>
  );
}