/**
 * Tariff Calculator Utility
 * Calculates Dana Kematian amount based on death date and MPS status
 */

import { TARIFF_CONFIG, TariffType } from '@/lib/config/dana-kematian-config';

export interface TariffCalculation {
  amount: number;
  tariffType: TariffType;
  cutoffDate: string;
  isAutoCalculated: boolean;
}

/**
 * Determine if a date falls under old or new tariff
 */
export function getTariffType(tanggalMeninggal: string): TariffType {
  const deathDate = new Date(tanggalMeninggal);
  const cutoffDate = new Date(TARIFF_CONFIG.cutoffDate);

  return deathDate < cutoffDate ? 'old' : 'new';
}

/**
 * Calculate tariff amount based on death date
 * Note: Currently MPS status doesn't affect the amount in this configuration,
 * but the parameter is kept for future flexibility
 */
export function calculateTariff(
  tanggalMeninggal: string,
  statusMPS?: string
): TariffCalculation {
  const tariffType = getTariffType(tanggalMeninggal);
  const config = tariffType === 'old' ? TARIFF_CONFIG.oldTariff : TARIFF_CONFIG.newTariff;

  // For future enhancement: Add logic for MPS bonus if needed
  // Example: if (statusMPS === 'mps' && tariffType === 'new') { ... }

  return {
    amount: config.baseAmount,
    tariffType,
    cutoffDate: TARIFF_CONFIG.cutoffDate,
    isAutoCalculated: true,
  };
}

/**
 * Format tariff amount as Indonesian Rupiah currency string
 */
export function formatTariffLabel(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get tariff display label with type description
 */
export function getTariffDisplayLabel(tariffType: TariffType, amount?: number): string {
  const typeLabel = tariffType === 'old' ? 'Tarif Lama' : 'Tarif Baru';
  const amountLabel = amount ? formatTariffLabel(amount) : '';

  return `${typeLabel}${amountLabel ? ` (${amountLabel})` : ''}`;
}

/**
 * Check if a given amount matches the auto-calculated tariff
 */
export function isAutoTariff(tanggalMeninggal: string, amount: number): boolean {
  const calculation = calculateTariff(tanggalMeninggal);
  return calculation.amount === amount;
}
