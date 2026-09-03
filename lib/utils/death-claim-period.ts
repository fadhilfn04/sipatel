/**
 * Death Claim Period Validation Utility
 *
 * Batas waktu pengajuan Dana Kematian sejak tanggal meninggal anggota.
 * Nilai batas bersumber dari MAX_DEATH_CLAIM_PERIOD_YEARS di
 * lib/config/dana-kematian-config.ts — ubah nilainya di sana, bukan di sini.
 *
 * Dipakai bersama oleh backend (app/api/dana-kematian, source of truth)
 * dan frontend (DanaKematianFormModal, untuk feedback UX).
 */

import { addYears, isAfter, parseISO, startOfDay } from 'date-fns';
import {
  DEATH_CLAIM_PERIOD_EXCEEDED_MESSAGE,
  MAX_DEATH_CLAIM_PERIOD_YEARS,
} from '@/lib/config/dana-kematian-config';

/**
 * Parse string tanggal 'YYYY-MM-DD' (suffix waktu diabaikan) sebagai tanggal
 * lokal. parseISO dipakai — bukan new Date() — karena new Date('YYYY-MM-DD')
 * menginterpretasi string sebagai UTC sehingga bisa bergeser sehari pada
 * timezone di belakang UTC.
 */
function parseDateOnly(value: string): Date | null {
  const match = /^\s*(\d{4}-\d{2}-\d{2})/.exec(value || '');
  if (!match) return null;
  const parsed = parseISO(match[1]);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Tanggal batas terakhir pengajuan untuk tanggal meninggal tertentu:
 * tanggalMeninggal + maxYears. Return null jika tanggal meninggal
 * kosong/tidak valid.
 */
export function getDeathClaimPeriodDeadline(
  tanggalMeninggal: string,
  maxYears: number = MAX_DEATH_CLAIM_PERIOD_YEARS,
): Date | null {
  const deathDate = parseDateOnly(tanggalMeninggal);
  return deathDate ? addYears(deathDate, maxYears) : null;
}

/**
 * Apakah pengajuan masih dalam batas waktu?
 *
 * Perbandingan dilakukan pada presisi hari: pengajuan pada hari yang tepat
 * N tahun setelah tanggal meninggal masih diterima, kelebihan satu hari
 * ditolak. Default tanggal pengajuan adalah "hari ini" (zona waktu server /
 * browser lokal). Tanggal meninggal kosong/tidak valid dianggap dalam batas
 * — kewajiban field divalidasi terpisah di masing-masing flow.
 */
export function isDeathClaimWithinPeriod(
  tanggalMeninggal: string,
  tanggalPengajuan: Date = new Date(),
  maxYears: number = MAX_DEATH_CLAIM_PERIOD_YEARS,
): boolean {
  const deadline = getDeathClaimPeriodDeadline(tanggalMeninggal, maxYears);
  if (!deadline) return true;
  return !isAfter(startOfDay(tanggalPengajuan), deadline);
}

/** Pesan validasi batas waktu, siap ditampilkan di UI. */
export function getDeathClaimPeriodExceededMessage(
  maxYears: number = MAX_DEATH_CLAIM_PERIOD_YEARS,
): string {
  return DEATH_CLAIM_PERIOD_EXCEEDED_MESSAGE.replace('{years}', String(maxYears));
}
