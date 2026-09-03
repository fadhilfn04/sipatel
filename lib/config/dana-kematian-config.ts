/**
 * Dana Kematian Configuration
 * Centralized configuration for tariffs, phases, and SLA thresholds
 */

/**
 * Batas maksimal jarak waktu (tahun) antara tanggal meninggal anggota dan
 * tanggal pengajuan Dana Kematian. Pengajuan dengan jarak lebih dari nilai
 * ini tidak dapat diproses.
 *
 * Sumber tunggal aturan ini — ubah nilai di sini saja jika ketentuan
 * berubah (mis. menjadi 3 atau 5 tahun). Dipakai bersama oleh backend
 * (app/api/dana-kematian) dan frontend (lib/utils/death-claim-period.ts).
 */
export const MAX_DEATH_CLAIM_PERIOD_YEARS = 4;

/** Pesan validasi saat batas waktu terlampaui ('{years}' diganti nilai di atas). */
export const DEATH_CLAIM_PERIOD_EXCEEDED_MESSAGE =
  'Pengajuan Dana Kematian tidak dapat diproses karena telah melewati batas waktu pengajuan {years} tahun sejak tanggal meninggal.';

export const TARIFF_CONFIG = {
  // Tarif berdasarkan tanggal meninggal
  cutoffDate: '2023-03-01', // Batas tarif lama vs baru

  oldTariff: {
    baseAmount: 1500000, // Rp 1.5 juta
    mpsAmount: 1500000,
  },

  newTariff: {
    baseAmount: 2000000, // Rp 2 juta
    mpsAmount: 2000000,
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
