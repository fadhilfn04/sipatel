/**
 * Tests for lib/utils/pengakhiran-keanggotaan-validation.ts
 *
 * Run: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPengakhiranValidationErrors,
  getPengakhiranFieldError,
  isPengakhiranFutureDate,
  parsePengakhiranDateOnly,
  validatePengakhiranInput,
} from './pengakhiran-keanggotaan-validation';

const BASE = {
  anggota_id: '11111111-1111-1111-1111-111111111111',
  alasan: 'mengundurkan_diri',
  tanggal_efektif_berhenti: '2026-01-10',
  nomor_dokumen: '12/BERHENTI/P2TEL/II/2026',
  tanggal_dokumen: '2026-01-05',
};

test('Input lengkap & valid → tanpa error', () => {
  assert.deepEqual(validatePengakhiranInput(BASE), []);
});

test('Anggota wajib dipilih', () => {
  const errors = validatePengakhiranInput({ ...BASE, anggota_id: '' });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'anggota_id');
});

test('Alasan wajib & harus nilai yang dikenal', () => {
  const missing = validatePengakhiranInput({ ...BASE, alasan: '' });
  assert.equal(getPengakhiranFieldError(missing, 'alasan') !== undefined, true);

  const invalid = validatePengakhiranInput({ ...BASE, alasan: 'pensiun' });
  assert.equal(invalid.some((e) => e.field === 'alasan'), true);
});

test('Keterangan wajib bila alasan lainnya', () => {
  const withoutNote = validatePengakhiranInput({ ...BASE, alasan: 'lainnya' });
  assert.equal(
    withoutNote.some((e) => e.field === 'keterangan_alasan'),
    true,
  );

  const withNote = validatePengakhiranInput({
    ...BASE,
    alasan: 'lainnya',
    keterangan_alasan: 'Pindah domisili ke luar negeri',
  });
  assert.deepEqual(withNote, []);
});

test('Tanggal efektif tidak boleh di masa depan', () => {
  const future = new Date();
  future.setDate(future.getDate() + 30);
  const iso = future.toISOString().slice(0, 10);

  const errors = validatePengakhiranInput({ ...BASE, tanggal_efektif_berhenti: iso });
  assert.equal(
    errors.some(
      (e) => e.field === 'tanggal_efektif_berhenti' && e.message.includes('masa depan'),
    ),
    true,
  );
});

test('Tanggal dokumen tidak boleh lebih akhir dari tanggal efektif', () => {
  const errors = validatePengakhiranInput({
    ...BASE,
    tanggal_dokumen: '2026-01-20',
    tanggal_efektif_berhenti: '2026-01-10',
  });
  assert.equal(errors.some((e) => e.field === 'tanggal_dokumen'), true);
});

test('Nomor dokumen minimal 3 karakter & karakter diizinkan', () => {
  const tooShort = validatePengakhiranInput({ ...BASE, nomor_dokumen: 'AB' });
  assert.equal(tooShort.some((e) => e.field === 'nomor_dokumen'), true);

  const badChars = validatePengakhiranInput({ ...BASE, nomor_dokumen: 'AB#123' });
  assert.equal(
    badChars.some((e) => e.field === 'nomor_dokumen' && e.message.includes('hanya boleh')),
    true,
  );
});

test('Tanggal valid di kalender (2026-02-30 ditolak)', () => {
  assert.equal(parsePengakhiranDateOnly('2026-02-30'), null);
  assert.notEqual(parsePengakhiranDateOnly('2026-02-28'), null);
});

test('Deteksi tanggal masa depan', () => {
  const future = new Date();
  future.setDate(future.getDate() + 1);
  assert.equal(isPengakhiranFutureDate(future.toISOString().slice(0, 10)), true);
  assert.equal(isPengakhiranFutureDate('2000-01-01'), false);
});

test('Gabungan error → satu pesan', () => {
  const errors = validatePengakhiranInput({});
  assert.equal(errors.length > 1, true);
  assert.equal(typeof formatPengakhiranValidationErrors(errors), 'string');
});
