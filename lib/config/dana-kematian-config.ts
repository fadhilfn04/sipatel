/**
 * Dana Kematian Configuration
 * Centralized configuration for tariffs, phases, and SLA thresholds
 */

export const TARIFF_CONFIG = {
  // Tarif berdasarkan tanggal meninggal
  cutoffDate: '2023-03-01', // Batas tarif lama vs baru

  oldTariff: {
    baseAmount: 25000000, // Rp 25 juta
    mpsAmount: 25000000,
  },

  newTariff: {
    baseAmount: 50000000, // Rp 50 juta
    mpsAmount: 50000000,
  },

  // Threshold otomatis
  autoCalculate: true,
  allowOverride: true,
} as const;

export const DOCUMENT_PHASES = {
  lapor_to_lengkap: {
    from: 'waktu_0', // Laporan Kematian
    to: 'waktu_1',   // Dokumen Lengkap
    label: 'Lapor → Lengkap',
    slaDays: 7,
  },
  lengkap_to_bayar: {
    from: 'waktu_1', // Dokumen Lengkap
    to: 'waktu_5',   // Transfer Dana
    label: 'Lengkap → Bayar',
    slaDays: 14,
  },
  bayar_to_transfer: {
    from: 'waktu_3', // Validasi PP
    to: 'waktu_5',   // Transfer Dana
    label: 'Bayar → Transfer',
    slaDays: 3,
  },
  transfer_to_ahli_waris: {
    from: 'waktu_5', // Transfer Dana
    to: 'waktu_6',   // Penyerahan ke Ahli Waris
    label: 'Transfer → Ahli Waris',
    slaDays: 7,
  },
} as const;

export type TariffType = 'old' | 'new';
export type PhaseKey = keyof typeof DOCUMENT_PHASES;

export interface PhaseConfig {
  from: string;
  to: string;
  label: string;
  slaDays: number;
}

export interface DurationInfo {
  totalDays: number;
  breakdown: Record<PhaseKey, number | null>;
  averagePhaseTime: number;
  isOverdue: boolean;
  overdueDays?: number;
}

export interface SLAStatus {
  status: 'on_track' | 'at_risk' | 'overdue';
  percentage: number;
  daysUsed: number;
  daysLimit: number;
}
