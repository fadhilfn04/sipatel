/**
 * Tests for lib/workflow/pengakhiran-keanggotaan-status.ts
 *
 * Run: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PENGAKHIRAN_ACTIVE_STATUSES,
  getPengakhiranStatusConfig,
  getPengakhiranStatusProps,
  isPengakhiranActive,
  isPengakhiranCancelable,
  isPengakhiranTerminal,
  isValidPengakhiranTransition,
} from './pengakhiran-keanggotaan-status';

test('Konfigurasi status memuat seluruh nilai workflow', () => {
  const values = PENGAKHIRAN_ACTIVE_STATUSES.concat([
    'disetujui_pp',
    'ditolak',
    'dibatalkan',
  ]);
  for (const value of values) {
    assert.equal(getPengakhiranStatusConfig(value).value, value);
  }
});

test('Status tidak dikenal → fallback secondary dengan label asli', () => {
  const config = getPengakhiranStatusConfig('entah');
  assert.equal(config.label, 'entah');
  assert.equal(config.variant, 'secondary');
});

test('Status kosong → fallback unknown', () => {
  assert.equal(getPengakhiranStatusConfig(null).label, 'unknown');
});

test('Badge props sesuai label & variant', () => {
  assert.deepEqual(getPengakhiranStatusProps('menunggu'), {
    label: 'Menunggu Verifikasi',
    variant: 'warning',
  });
  assert.deepEqual(getPengakhiranStatusProps('disetujui_pp'), {
    label: 'Disetujui PP',
    variant: 'success',
  });
});

test('Transisi dari menunggu diizinkan ke verifikasi PC / ditolak / dibatalkan', () => {
  assert.equal(isValidPengakhiranTransition('menunggu', 'diverifikasi_pc'), true);
  assert.equal(isValidPengakhiranTransition('menunggu', 'ditolak'), true);
  assert.equal(isValidPengakhiranTransition('menunggu', 'dibatalkan'), true);
});

test('Transisi melompati tahap PC → ditolak', () => {
  assert.equal(isValidPengakhiranTransition('menunggu', 'disetujui_pp'), false);
});

test('Transisi dari verifikasi PC ke keputusan akhir', () => {
  assert.equal(isValidPengakhiranTransition('diverifikasi_pc', 'disetujui_pp'), true);
  assert.equal(isValidPengakhiranTransition('diverifikasi_pc', 'ditolak'), true);
  assert.equal(isValidPengakhiranTransition('diverifikasi_pc', 'dibatalkan'), true);
});

test('Status terminal tidak punya transisi lanjutan', () => {
  for (const status of ['disetujui_pp', 'ditolak', 'dibatalkan']) {
    assert.equal(isPengakhiranTerminal(status), true);
    assert.equal(isValidPengakhiranTransition(status, 'menunggu'), false);
  }
});

test('Status aktif & dapat dibatalkan hanya menunggu / diverifikasi_pc', () => {
  assert.equal(isPengakhiranActive('menunggu'), true);
  assert.equal(isPengakhiranActive('diverifikasi_pc'), true);
  assert.equal(isPengakhiranActive('disetujui_pp'), false);
  assert.equal(isPengakhiranActive('ditolak'), false);
  assert.equal(isPengakhiranCancelable('menunggu'), true);
  assert.equal(isPengakhiranCancelable('dibatalkan'), false);
});
