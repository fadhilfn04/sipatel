/**
 * Tests for lib/utils/tariff-sync.ts
 *
 * Run: npm test
 * (node:test via tsx — proyek belum punya test framework lain)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBesaranAfterTanggalMeninggalChange } from './tariff-sync';

// Tarif (lib/config/dana-kematian-config.ts):
//   sebelum 2023-03-01 → Rp1.500.000 ; setelahnya → Rp2.000.000
const TARIFF_OLD = 1500000;
const TARIFF_NEW = 2000000;

test('Tanggal tidak berubah → besaran request dipertahankan', () => {
  const result = resolveBesaranAfterTanggalMeninggalChange({
    tanggalMeninggalLama: '2023-06-01',
    tanggalMeninggalBaru: '2023-06-01',
    besaranSaatIni: TARIFF_NEW,
    besaranDikirim: TARIFF_NEW,
  });
  assert.equal(result.besaran, TARIFF_NEW);
  assert.equal(result.changed, false);
});

test('Tanggal berubah, request membawa nominal lama (stale auto) → dihitung ulang otomatis', () => {
  // Klaim lama: meninggal 2022 (tarif lama 1,5jt). Cabang mengubah tanggal
  // menjadi 2024 tetapi form masih mengirim nominal lama.
  const result = resolveBesaranAfterTanggalMeninggalChange({
    tanggalMeninggalLama: '2022-05-01',
    tanggalMeninggalBaru: '2024-05-01',
    besaranSaatIni: TARIFF_OLD,
    besaranDikirim: TARIFF_OLD,
  });
  assert.equal(result.besaran, TARIFF_NEW);
  assert.equal(result.changed, true);
});

test('Tanggal berubah dari tarif baru ke tarif lama → nominal mengikuti tarif lama', () => {
  const result = resolveBesaranAfterTanggalMeninggalChange({
    tanggalMeninggalLama: '2024-05-01',
    tanggalMeninggalBaru: '2022-05-01',
    besaranSaatIni: TARIFF_NEW,
    besaranDikirim: TARIFF_NEW,
  });
  assert.equal(result.besaran, TARIFF_OLD);
  assert.equal(result.changed, true);
});

test('Tanggal berubah, besaran tidak dikirim → auto mengikuti tanggal baru', () => {
  const result = resolveBesaranAfterTanggalMeninggalChange({
    tanggalMeninggalLama: '2022-05-01',
    tanggalMeninggalBaru: '2024-05-01',
    besaranSaatIni: TARIFF_OLD,
  });
  assert.equal(result.besaran, TARIFF_NEW);
  assert.equal(result.changed, true);
});

test('Tanggal berubah, besaran manual (bukan hasil tarif) → override manual dihormati', () => {
  const result = resolveBesaranAfterTanggalMeninggalChange({
    tanggalMeninggalLama: '2022-05-01',
    tanggalMeninggalBaru: '2024-05-01',
    besaranSaatIni: 1750000,
    besaranDikirim: 1750000,
  });
  assert.equal(result.besaran, 1750000);
  assert.equal(result.changed, false);
});

test('Tanggal berubah, besaran request sudah sesuai tarif baru → tetap (bukan dihitung ulang)', () => {
  const result = resolveBesaranAfterTanggalMeninggalChange({
    tanggalMeninggalLama: '2022-05-01',
    tanggalMeninggalBaru: '2024-05-01',
    besaranSaatIni: TARIFF_OLD,
    besaranDikirim: TARIFF_NEW,
  });
  assert.equal(result.besaran, TARIFF_NEW);
  assert.equal(result.changed, true);
});
