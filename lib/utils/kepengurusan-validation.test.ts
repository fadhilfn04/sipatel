import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getKepengurusanFieldError,
  validateKepengurusanInput,
  type KepengurusanInput,
} from './kepengurusan-validation';

const baseValid: KepengurusanInput = {
  anggota_id: '11111111-1111-1111-1111-111111111111',
  jenis: 'angkat',
  jabatan: 'Sekretaris',
  periode: '2025-2030',
  tanggal_mulai: '2020-01-01',
  tanggal_sk: '2020-01-01',
  nomor_sk: 'SK/001/P2TEL/2020',
  catatan_pengaju: 'Pengangkatan pengurus periode baru',
};

test('Input valid → tidak ada error', () => {
  const errors = validateKepengurusanInput(baseValid);
  assert.equal(errors.length, 0);
});

test('Anggota wajib dipilih', () => {
  const errors = validateKepengurusanInput({ ...baseValid, anggota_id: '' });
  assert.ok(getKepengurusanFieldError(errors, 'anggota_id'));
});

test('Jenis perubahan tidak valid ditolak', () => {
  const errors = validateKepengurusanInput({ ...baseValid, jenis: 'hapus' });
  assert.ok(getKepengurusanFieldError(errors, 'jenis'));
});

test('Jabatan wajib untuk angkat/pindah', () => {
  const errors = validateKepengurusanInput({ ...baseValid, jabatan: '' });
  assert.ok(getKepengurusanFieldError(errors, 'jabatan'));
});

test('Jabatan "Anggota" tidak boleh untuk pengangkatan', () => {
  const errors = validateKepengurusanInput({ ...baseValid, jabatan: 'Anggota' });
  assert.ok(getKepengurusanFieldError(errors, 'jabatan'));
});

test('Jenis berhentikan tidak mewajibkan jabatan', () => {
  const errors = validateKepengurusanInput({ ...baseValid, jenis: 'berhentikan', jabatan: '' });
  assert.equal(getKepengurusanFieldError(errors, 'jabatan'), undefined);
});

test('Tanggal SK tidak boleh melewati tanggal mulai', () => {
  const errors = validateKepengurusanInput({
    ...baseValid,
    tanggal_sk: '2020-02-01',
    tanggal_mulai: '2020-01-01',
  });
  assert.ok(getKepengurusanFieldError(errors, 'tanggal_sk'));
});

test('Tanggal mulai tidak boleh di masa depan', () => {
  const errors = validateKepengurusanInput({ ...baseValid, tanggal_mulai: '2999-01-01', tanggal_sk: '2999-01-01' });
  assert.ok(getKepengurusanFieldError(errors, 'tanggal_mulai'));
});

test('Tanggal selesai harus setelah tanggal mulai', () => {
  const errors = validateKepengurusanInput({
    ...baseValid,
    tanggal_selesai: '2020-01-01',
  });
  assert.ok(getKepengurusanFieldError(errors, 'tanggal_selesai'));
});

test('Nomor SK wajib & minimal 3 karakter', () => {
  assert.ok(getKepengurusanFieldError(validateKepengurusanInput({ ...baseValid, nomor_sk: '' }), 'nomor_sk'));
  assert.ok(getKepengurusanFieldError(validateKepengurusanInput({ ...baseValid, nomor_sk: 'AB' }), 'nomor_sk'));
});

test('Alasan/catatan wajib minimal 10 karakter', () => {
  assert.ok(
    getKepengurusanFieldError(validateKepengurusanInput({ ...baseValid, catatan_pengaju: 'pendek' }), 'catatan_pengaju'),
  );
});
