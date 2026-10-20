import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDefaultRequiredDocumentMap,
  getKnownDocumentFileKeys,
  validateMaxPeriodYears,
  validateRequiredDocuments,
} from './dakem-config';

test('validateMaxPeriodYears menerima bilangan bulat 1..50', () => {
  assert.deepEqual(validateMaxPeriodYears(4), { valid: true, value: 4 });
  assert.deepEqual(validateMaxPeriodYears('5'), { valid: true, value: 5 });
  assert.deepEqual(validateMaxPeriodYears(1), { valid: true, value: 1 });
  assert.deepEqual(validateMaxPeriodYears(50), { valid: true, value: 50 });
});

test('validateMaxPeriodYears menolak nilai tidak logis', () => {
  assert.equal(validateMaxPeriodYears(0).valid, false);
  assert.equal(validateMaxPeriodYears(51).valid, false);
  assert.equal(validateMaxPeriodYears(4.5).valid, false);
  assert.equal(validateMaxPeriodYears('abc').valid, false);
  assert.equal(validateMaxPeriodYears(null).valid, false);
  assert.equal(validateMaxPeriodYears(undefined).valid, false);
});

test('validateRequiredDocuments menerima fileKey yang dikenal', () => {
  const result = validateRequiredDocuments({
    file_sk_pensiun: true,
    file_dokumen_pendukung: false,
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.value, {
    file_sk_pensiun: true,
    file_dokumen_pendukung: false,
  });
});

test('validateRequiredDocuments menolak key tak dikenal / nilai non-boolean', () => {
  assert.equal(validateRequiredDocuments({ file_tidak_ada: true }).valid, false);
  assert.equal(validateRequiredDocuments({ file_sk_pensiun: 'ya' }).valid, false);
  assert.equal(validateRequiredDocuments(null).valid, false);
  assert.equal(validateRequiredDocuments([]).valid, false);
});

test('default dokumen wajib sesuai konfigurasi statis (Dokumen Pendukung opsional)', () => {
  const map = getDefaultRequiredDocumentMap();
  assert.equal(map.file_sk_pensiun, true);
  assert.equal(map.file_surat_kematian, true);
  assert.equal(map.file_surat_pernyataan_ahli_waris, true);
  assert.equal(map.file_kartu_keluarga, true);
  assert.equal(map.file_e_ktp, true);
  assert.equal(map.file_surat_nikah, true);
  assert.equal(map.file_surat_keterangan, true);
  assert.equal(map.file_dokumen_pendukung, false);
});

test('getKnownDocumentFileKeys mengembalikan seluruh fileKey dokumen', () => {
  const keys = getKnownDocumentFileKeys();
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.includes('file_sk_pensiun'));
  assert.ok(keys.includes('file_dokumen_pendukung'));
});
