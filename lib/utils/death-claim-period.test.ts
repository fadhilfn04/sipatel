/**
 * Tests for lib/utils/death-claim-period.ts
 *
 * Run: npm test
 * (node:test via tsx — proyek belum punya test framework lain)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDeathClaimPeriodDeadline,
  getDeathClaimPeriodExceededMessage,
  isDeathClaimWithinPeriod,
} from './death-claim-period';

/** Konstruktor tanggal lokal (hindari parse UTC string) */
const d = (year: number, month: number, day: number, hour = 0) =>
  new Date(year, month - 1, day, hour);

test('Pengajuan < 4 tahun diterima', () => {
  assert.equal(isDeathClaimWithinPeriod('2022-09-10', d(2026, 9, 9)), true);
});

test('Tepat 4 tahun (hari yang sama) diterima', () => {
  assert.equal(isDeathClaimWithinPeriod('2022-09-10', d(2026, 9, 10)), true);
});

test('> 4 tahun ditolak', () => {
  assert.equal(isDeathClaimWithinPeriod('2022-09-09', d(2026, 9, 10)), false);
});

test('Batas +-1 hari: H-1 diterima, H+1 ditolak', () => {
  assert.equal(isDeathClaimWithinPeriod('2022-09-10', d(2026, 9, 9)), true);
  assert.equal(isDeathClaimWithinPeriod('2022-09-10', d(2026, 9, 11)), false);
});

test('Jam dalam hari tidak mempengaruhi hasil', () => {
  assert.equal(isDeathClaimWithinPeriod('2022-09-10', d(2026, 9, 10, 0)), true);
  assert.equal(isDeathClaimWithinPeriod('2022-09-10', d(2026, 9, 10, 23)), true);
});

test('Leap year: meninggal 29 Feb, tepat 4 tahun tetap 29 Feb', () => {
  // 2020 dan 2024 adalah tahun kabisat
  assert.equal(isDeathClaimWithinPeriod('2020-02-29', d(2024, 2, 29)), true);
  assert.equal(isDeathClaimWithinPeriod('2020-02-29', d(2024, 3, 1)), false);
  assert.equal(isDeathClaimWithinPeriod('2024-02-29', d(2028, 2, 29)), true);
  assert.equal(isDeathClaimWithinPeriod('2024-02-29', d(2028, 3, 1)), false);
});

test('Konfigurasi dapat diubah: maxYears=3 dan maxYears=5', () => {
  assert.equal(isDeathClaimWithinPeriod('2023-06-15', d(2026, 6, 15), 3), true);
  assert.equal(isDeathClaimWithinPeriod('2023-06-15', d(2026, 6, 16), 3), false);
  assert.equal(isDeathClaimWithinPeriod('2021-06-15', d(2026, 6, 15), 5), true);
  assert.equal(isDeathClaimWithinPeriod('2021-06-15', d(2026, 6, 16), 5), false);
});

test('29 Feb dengan maxYears ganjil: clamp ke 28 Feb pada tahun non-kabisat (konvensi date-fns)', () => {
  // 2025 bukan tahun kabisat; 2024-02-29 + 1 tahun = 2025-02-28 (clamp down, konvensi date-fns v4)
  assert.equal(isDeathClaimWithinPeriod('2024-02-29', d(2025, 2, 28), 1), true);
  assert.equal(isDeathClaimWithinPeriod('2024-02-29', d(2025, 3, 1), 1), false);
  assert.equal(isDeathClaimWithinPeriod('2024-02-29', d(2025, 3, 2), 1), false);
});

test('Tanggal meninggal kosong/tidak valid dianggap dalam batas (bukan cakupan rule ini)', () => {
  assert.equal(isDeathClaimWithinPeriod(''), true);
  assert.equal(isDeathClaimWithinPeriod('bukan-tanggal'), true);
});

test('Suffix waktu pada tanggal meninggal diabaikan (date-only normalization)', () => {
  assert.equal(isDeathClaimWithinPeriod('2022-09-10T00:00:00', d(2026, 9, 10)), true);
  assert.equal(isDeathClaimWithinPeriod('2022-09-10T23:59:59Z', d(2026, 9, 11)), false);
});

test('getDeathClaimPeriodDeadline mengembalikan tanggal deadline yang benar', () => {
  assert.deepEqual(getDeathClaimPeriodDeadline('2022-09-10'), d(2026, 9, 10));
  assert.equal(getDeathClaimPeriodDeadline(''), null);
  assert.equal(getDeathClaimPeriodDeadline('bukan-tanggal'), null);
});

test('Pesan validasi memuat nilai konfigurasi (4 tahun)', () => {
  const message = getDeathClaimPeriodExceededMessage();
  assert.match(message, /4 tahun/);
  assert.match(message, /Pengajuan Dana Kematian/);
  assert.equal(getDeathClaimPeriodExceededMessage(3), getDeathClaimPeriodExceededMessage().replace('4 tahun', '3 tahun'));
});
