/**
 * Duration Calculator Utility
 * Calculates duration for Dana Kematian processing phases
 */

import { differenceInBusinessDays, differenceInDays, parseISO } from 'date-fns';
import { DanaKematian } from '@/lib/supabase';
import { DOCUMENT_PHASES, PhaseKey, DurationInfo, SLAStatus } from '@/lib/config/dana-kematian-config';

/**
 * Calculate duration in days between two dates
 */
export function calculatePhaseDuration(startDate: string | null, endDate: string | null): number | null {
  if (!startDate || !endDate) return null;

  try {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    return differenceInDays(end, start);
  } catch (error) {
    console.error('Error calculating phase duration:', error);
    return null;
  }
}

/**
 * Calculate duration for all phases
 */
export function calculateAllDurations(claim: DanaKematian): Record<PhaseKey, number | null> {
  return {
    lapor_to_lengkap: calculatePhaseDuration(claim.waktu_0, claim.waktu_1),
    lengkap_to_bayar: calculatePhaseDuration(claim.waktu_1, claim.waktu_5),
    bayar_to_transfer: calculatePhaseDuration(claim.waktu_3, claim.waktu_5),
    transfer_to_ahli_waris: calculatePhaseDuration(claim.waktu_5, claim.waktu_6),
  };
}

/**
 * Calculate total processing duration from first to last timestamp
 */
export function calculateTotalDuration(claim: DanaKematian): number | null {
  // Find first non-null timestamp
  const firstTimestamp = [
    claim.waktu_0,
    claim.waktu_1,
    claim.waktu_2,
    claim.waktu_3,
  ].find(t => t !== null);

  // Find last non-null timestamp
  const lastTimestamp = [
    claim.waktu_7,
    claim.waktu_6,
    claim.waktu_5,
  ].find(t => t !== null);

  if (!firstTimestamp || !lastTimestamp) return null;

  return calculatePhaseDuration(firstTimestamp, lastTimestamp);
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(days: number | null): string {
  if (days === null) return '-';

  if (days === 0) return 'Hari ini';

  if (days === 1) return '1 hari';

  return `${days} hari`;
}

/**
 * Format duration with more detail (days and hours approximation)
 */
export function formatDurationDetailed(days: number | null): string {
  if (days === null) return 'Tidak ada data';

  if (days === 0) return 'Hari ini';

  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;

  if (weeks > 0) {
    return `${weeks} minggu ${remainingDays > 0 ? `${remainingDays} hari` : ''}`.trim();
  }

  return `${days} hari`;
}

/**
 * Get SLA status for a phase
 */
export function getSLAStatus(duration: number | null, slaDays: number): SLAStatus {
  if (duration === null) {
    return {
      status: 'on_track',
      percentage: 0,
      daysUsed: 0,
      daysLimit: slaDays,
    };
  }

  const percentage = Math.min((duration / slaDays) * 100, 100);

  if (duration <= slaDays) {
    return {
      status: 'on_track',
      percentage,
      daysUsed: duration,
      daysLimit: slaDays,
    };
  } else if (duration <= slaDays * 1.5) {
    return {
      status: 'at_risk',
      percentage,
      daysUsed: duration,
      daysLimit: slaDays,
    };
  } else {
    return {
      status: 'overdue',
      percentage,
      daysUsed: duration,
      daysLimit: slaDays,
    };
  }
}

/**
 * Get comprehensive duration information for a claim
 */
export function getClaimDurationInfo(claim: DanaKematian): DurationInfo {
  const breakdown = calculateAllDurations(claim);
  const totalDays = calculateTotalDuration(claim);

  // Calculate average phase time (excluding null values)
  const validDurations = Object.values(breakdown).filter(
    (d): d is number => d !== null
  );
  const averagePhaseTime =
    validDurations.length > 0
      ? validDurations.reduce((sum, d) => sum + d, 0) / validDurations.length
      : 0;

  // Check if any phase is overdue
  const isOverdue = Object.entries(DOCUMENT_PHASES).some(([key, config]) => {
    const duration = breakdown[key as PhaseKey];
    return duration !== null && duration > config.slaDays;
  });

  // Calculate total overdue days
  let overdueDays = 0;
  if (isOverdue) {
    overdueDays = Object.entries(DOCUMENT_PHASES).reduce((total, [key, config]) => {
      const duration = breakdown[key as PhaseKey];
      if (duration !== null && duration > config.slaDays) {
        return total + (duration - config.slaDays);
      }
      return total;
    }, 0);
  }

  return {
    totalDays: totalDays || 0,
    breakdown,
    averagePhaseTime,
    isOverdue,
    overdueDays: isOverdue ? overdueDays : undefined,
  };
}

/**
 * Get progress percentage based on completed timeline fields
 */
export function getTimelineProgress(claim: DanaKematian): number {
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
  return Math.round((completedFields / timelineFields.length) * 100);
}

/**
 * Get current stage information based on timeline
 */
export function getCurrentStage(claim: DanaKematian): string {
  if (claim.waktu_7) return 'Selesai';
  if (claim.waktu_6) return 'Penyerahan ke Ahli Waris';
  if (claim.waktu_5) return 'Transfer Dana';
  if (claim.waktu_4) return 'Finalisasi';
  if (claim.waktu_3) return 'Validasi Pusat';
  if (claim.waktu_2) return 'Pengiriman ke Pusat';
  if (claim.waktu_1) return 'Dokumen Lengkap';
  if (claim.waktu_0) return 'Laporan Kematian';

  return 'Belum Dimulai';
}
