import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeChangedFields,
  maskAuditValue,
  sanitizeAuditPayload,
} from './audit-mask';

test('maskAuditValue menyembunyikan nilai kecuali 4 digit terakhir', () => {
  assert.equal(maskAuditValue('1234567890123456'), '****3456 (16)');
  assert.equal(maskAuditValue('1234'), '****');
  assert.equal(maskAuditValue(''), '');
  assert.equal(maskAuditValue(null), null);
  assert.equal(maskAuditValue(undefined), null);
});

test('sanitizeAuditPayload membuang kredensial & memasking rekening', () => {
  const result = sanitizeAuditPayload({
    password: 'rahasia',
    access_token: 'jwt-token',
    nama_bank: 'BRI',
    norek_bank: '1234567890',
    nama_anggota: 'Budi',
  });

  assert.ok(result);
  assert.equal('password' in result, false, 'password harus dibuang');
  assert.equal('access_token' in result, false, 'token harus dibuang');
  assert.equal(result.norek_bank, '****7890 (10)');
  assert.equal(result.nama_bank, 'BRI');
  assert.equal(result.nama_anggota, 'Budi');
});

test('sanitizeAuditPayload menangani null/undefined', () => {
  assert.equal(sanitizeAuditPayload(null), null);
  assert.equal(sanitizeAuditPayload(undefined), null);
});

test('computeChangedFields mendeteksi field berubah/tambah/hilang', () => {
  const oldValues = { nama: 'Budi', alamat: 'Lama', kota: 'Bandung' };
  const newValues = { nama: 'Budi', alamat: 'Baru', kode_pos: '40115' };

  assert.deepEqual(computeChangedFields(oldValues, newValues), [
    'alamat',
    'kode_pos',
    'kota',
  ]);
  assert.deepEqual(computeChangedFields(null, { a: 1 }), ['a']);
  assert.deepEqual(computeChangedFields({ a: 1 }, null), ['a']);
  assert.deepEqual(computeChangedFields(null, null), []);
  assert.deepEqual(computeChangedFields({ a: 1 }, { a: 1 }), []);
});
