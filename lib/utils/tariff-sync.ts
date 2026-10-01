/**
 * Dana Kematian — Sinkronisasi Besaran saat Tanggal Meninggal Berubah
 *
 * Besaran dana kematian dihitung otomatis dari tanggal meninggal (tarif lama
 * Rp1.500.000 vs tarif baru Rp2.000.000, cutoff 2023-03-01 — lihat
 * lib/config/dana-kematian-config.ts). Ketika USER CABANG mengubah tanggal
 * meninggal, besaran hasil perhitungan lama TIDAK BOLEH tersimpan kembali.
 *
 * Aturan (dipakai frontend dan backend):
 * 1. Tanggal tidak berubah            → besaran dikembalikan apa adanya.
 * 2. Tanggal berubah + besaran request adalah nilai manual (bukan hasil
 *    auto-tarif lama maupun baru)     → nilai manual dihormati (allowOverride).
 * 3. Tanggal berubah + besaran request kosong/sama dengan auto-tarif lama
 *    (stale) / sudah sama dengan baru → besaran dihitung ulang dari tanggal
 *    baru, sehingga nominal, eligibility, dan status selalu mengikuti
 *    tanggal terbaru.
 */

import { calculateTariff } from './tariff-calculator';

export interface TariffSyncInput {
  tanggalMeninggalLama?: string | null;
  tanggalMeninggalBaru?: string | null;
  /** besaran yang tersimpan di database saat ini */
  besaranSaatIni: number;
  /** besaran yang dikirim client pada request ini (undefined = tidak dikirim) */
  besaranDikirim?: number;
}

export interface TariffSyncResult {
  besaran: number;
  /** true bila besaran perlu ditulis ulang ke database */
  changed: boolean;
}

export function resolveBesaranAfterTanggalMeninggalChange(
  input: TariffSyncInput,
): TariffSyncResult {
  const tanggalBerubah =
    !!input.tanggalMeninggalBaru &&
    input.tanggalMeninggalBaru !== input.tanggalMeninggalLama;

  if (!tanggalBerubah) {
    return {
      besaran: input.besaranDikirim ?? input.besaranSaatIni,
      changed: input.besaranDikirim !== undefined && input.besaranDikirim !== input.besaranSaatIni,
    };
  }

  const autoLama = input.tanggalMeninggalLama
    ? calculateTariff(input.tanggalMeninggalLama).amount
    : null;
  const autoBaru = calculateTariff(input.tanggalMeninggalBaru as string).amount;

  // Nilai manual = dikirim client, tetapi bukan hasil auto-tarif lama (stale)
  // dan bukan hasil auto-tarif baru (sudah benar).
  const dikirim = input.besaranDikirim;
  const isManual =
    dikirim !== undefined && dikirim !== autoLama && dikirim !== autoBaru;

  if (isManual) {
    return { besaran: dikirim as number, changed: dikirim !== input.besaranSaatIni };
  }

  // Auto-follow: besaran dihitung ulang dari tanggal meninggal terbaru.
  return {
    besaran: autoBaru,
    changed: autoBaru !== input.besaranSaatIni,
  };
}
