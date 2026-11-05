/**
 * Tests for lib/workflow/mutasi-cabang-status.ts
 *
 * Run: npm test
 * (node:test via tsx — proyek belum punya test framework lain)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MUTASI_CABANG_ACTIVE_STATUSES,
  getMutasiCabangStatusConfig,
  getMutasiCabangStatusProps,
  isMutasiCabangActive,
  isMutasiCabangCancelable,
  isMutasiCabangTerminal,
  isValidMutasiCabangTransition,
} from './mutasi-cabang-status';

test('Konfigurasi status memuat seluruh nilai workflow', () => {
  const values = MUTASI_CABANG_ACTIVE_STATUSES.concat(['disetujui_pp', 'ditolak', 'dibatalkan']);
  for (const value of values) {
    assert.equal(getMutasiCabangStatusConfig(value).value, value);
  }
});

test('Status tidak dikenal → fallback secondary dengan label asli', () => {
  const config = getMutasiCabangStatusConfig('entah');
  assert.equal(config.label, 'entah');
  assert.equal(config.variant, 'secondary');
});

test('Status kosong → fallback unknown', () => {
  assert.equal(getMutasiCabangStatusConfig(null).label, 'unknown');
});

test('Badge props sesuai label & variant', () => {
  assert.deepEqual(getMutasiCabangStatusProps('menunggu'), {
    label: 'Menunggu Verifikasi',
    variant: 'warning',
  });
  assert.deepEqual(getMutasiCabangStatusProps('disetujui_pp'), {
    label: 'Disetujui PP',
    variant: 'success',
  });
});

test('Transisi dari menunggu diizinkan ke verifikasi PC / ditolak / dibatalkan', () => {
  assert.equal(isValidMutasiCabangTransition('menunggu', 'diverifikasi_pc'), true);
  assert.equal(isValidMutasiCabangTransition('menunggu', 'ditolak'), true);
  assert.equal(isValidMutasiCabangTransition('menunggu', 'dibatalkan'), true);
});

test('Transisi melompati tahap PC → ditolak', () => {
  assert.equal(isValidMutasiCabangTransition('menunggu', 'disetujui_pp'), false);
});

test('Transisi dari verifikasi PC ke keputusan akhir', () => {
  assert.equal(isValidMutasiCabangTransition('diverifikasi_pc', 'disetujui_pp'), true);
  assert.equal(isValidMutasiCabangTransition('diverifikasi_pc', 'ditolak'), true);
  assert.equal(isValidMutasiCabangTransition('diverifikasi_pc', 'dibatalkan'), true);
});

test('Status terminal tidak punya transisi lanjutan', () => {
  for (const status of ['disetujui_pp', 'ditolak', 'dibatalkan']) {
    assert.equal(isMutasiCabangTerminal(status), true);
    assert.equal(isValidMutasiCabangTransition(status, 'menunggu'), false);
  }
});

test('Status aktif & dapat dibatalkan hanya menunggu / diverifikasi_pc', () => {
  assert.equal(isMutasiCabangActive('menunggu'), true);
  assert.equal(isMutasiCabangActive('diverifikasi_pc'), true);
  assert.equal(isMutasiCabangActive('disetujui_pp'), false);
  assert.equal(isMutasiCabangActive('ditolak'), false);
  assert.equal(isMutasiCabangCancelable('menunggu'), true);
  assert.equal(isMutasiCabangCancelable('dibatalkan'), false);
});
