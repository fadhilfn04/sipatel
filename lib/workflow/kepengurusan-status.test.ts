import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  KEPENGURUSAN_STATUSES,
  getKepengurusanStatusConfig,
  getKepengurusanStatusProps,
  isKepengurusanCancelable,
  isKepengurusanTerminal,
  isValidKepengurusanTransition,
} from './kepengurusan-status';

test('Daftar status kepengurusan lengkap (5 status)', () => {
  assert.equal(KEPENGURUSAN_STATUSES.length, 5);
  const values = KEPENGURUSAN_STATUSES.map((s) => s.value).sort();
  assert.deepEqual(values, [
    'dibatalkan',
    'disetujui_pp',
    'ditolak',
    'diverifikasi_pc',
    'menunggu',
  ]);
});

test('Badge props status sesuai label & variant', () => {
  assert.deepEqual(getKepengurusanStatusProps('menunggu'), {
    label: 'Menunggu Verifikasi',
    variant: 'warning',
  });
  assert.deepEqual(getKepengurusanStatusProps('diverifikasi_pc'), {
    label: 'Verifikasi PC',
    variant: 'info',
  });
  assert.deepEqual(getKepengurusanStatusProps('disetujui_pp'), {
    label: 'Disetujui PP',
    variant: 'success',
  });
});

test('Status tidak dikenal → fallback aman', () => {
  const config = getKepengurusanStatusConfig('entah');
  assert.equal(config.label, 'entah');
  assert.equal(config.terminal, false);
  assert.equal(getKepengurusanStatusConfig(null).value, 'unknown');
});

test('Transisi dari menunggu diizinkan ke verifikasi PC / ditolak / dibatalkan', () => {
  assert.equal(isValidKepengurusanTransition('menunggu', 'diverifikasi_pc'), true);
  assert.equal(isValidKepengurusanTransition('menunggu', 'ditolak'), true);
  assert.equal(isValidKepengurusanTransition('menunggu', 'dibatalkan'), true);
});

test('Transisi melompati tahap PC → disetujui_pp ditolak', () => {
  assert.equal(isValidKepengurusanTransition('menunggu', 'disetujui_pp'), false);
});

test('Transisi dari verifikasi PC ke keputusan akhir', () => {
  assert.equal(isValidKepengurusanTransition('diverifikasi_pc', 'disetujui_pp'), true);
  assert.equal(isValidKepengurusanTransition('diverifikasi_pc', 'ditolak'), true);
  assert.equal(isValidKepengurusanTransition('diverifikasi_pc', 'dibatalkan'), true);
});

test('Status terminal tidak punya transisi lanjutan', () => {
  for (const terminal of ['disetujui_pp', 'ditolak', 'dibatalkan']) {
    assert.equal(isKepengurusanTerminal(terminal), true);
    assert.equal(isValidKepengurusanTransition(terminal, 'menunggu'), false);
  }
});

test('Status aktif & dapat dibatalkan hanya menunggu / diverifikasi_pc', () => {
  assert.equal(isKepengurusanCancelable('menunggu'), true);
  assert.equal(isKepengurusanCancelable('diverifikasi_pc'), true);
  assert.equal(isKepengurusanCancelable('disetujui_pp'), false);
  assert.equal(isKepengurusanCancelable('ditolak'), false);
});
