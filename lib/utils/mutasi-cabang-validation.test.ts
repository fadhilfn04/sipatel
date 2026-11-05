/**
 * Tests for lib/utils/mutasi-cabang-validation.ts
 *
 * Run: npm test
 * (node:test via tsx — proyek belum punya test framework lain)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMutasiValidationErrors,
  getMutasiFieldError,
  parseMutasiDateOnly,
  validatePengajuanMutasiInput,
} from './mutasi-cabang-validation';

const VALID_INPUT = {
  anggota_id: 'aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff',
  cabang_tujuan: 'BANDUNG TIMUR',
  cabang_asal: 'BANDUNG SELATAN',
  tanggal_mulai_mutasi: '2026-03-01',
  nomor_dokumen_mutasi: '01/MUT/P2TEL/II/2026',
  tanggal_dokumen_mutasi: '2026-02-20',
};

test('Pengajuan valid lengkap → tidak ada error', () => {
  assert.equal(validatePengajuanMutasiInput(VALID_INPUT).length, 0);
});

test('Tanggal dokumen sama persis dengan tanggal mulai → diterima (boundary)', () => {
  const errors = validatePengajuanMutasiInput({
    ...VALID_INPUT,
    tanggal_dokumen_mutasi: '2026-03-01',
  });
  assert.equal(errors.length, 0);
});

test('Seluruh field kosong → lima error wajib diisi', () => {
  const errors = validatePengajuanMutasiInput({});
  assert.equal(errors.length, 5);
  const fields = errors.map((e) => e.field);
  assert.ok(fields.includes('anggota_id'));
  assert.ok(fields.includes('cabang_tujuan'));
  assert.ok(fields.includes('tanggal_mulai_mutasi'));
  assert.ok(fields.includes('nomor_dokumen_mutasi'));
  assert.ok(fields.includes('tanggal_dokumen_mutasi'));
});

test('Anggota (NIK) belum dipilih → ditolak', () => {
  const errors = validatePengajuanMutasiInput({ ...VALID_INPUT, anggota_id: '' });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'anggota_id');
  assert.match(errors[0].message, /wajib dipilih/);
});

test('Cabang tujuan belum dipilih → ditolak', () => {
  const errors = validatePengajuanMutasiInput({ ...VALID_INPUT, cabang_tujuan: '  ' });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'cabang_tujuan');
  assert.match(errors[0].message, /wajib dipilih/);
});

test('Cabang tujuan sama dengan cabang asal (beda kapitalisasi) → ditolak', () => {
  const errors = validatePengajuanMutasiInput({
    ...VALID_INPUT,
    cabang_asal: 'Bandung Timur',
    cabang_tujuan: 'BANDUNG TIMUR',
  });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'cabang_tujuan');
  assert.match(errors[0].message, /tidak boleh sama dengan cabang asal/);
});

test('Nomor dokumen hanya spasi → ditolak (wajib diisi)', () => {
  const errors = validatePengajuanMutasiInput({ ...VALID_INPUT, nomor_dokumen_mutasi: '   ' });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'nomor_dokumen_mutasi');
  assert.match(errors[0].message, /wajib diisi/);
});

test('Nomor dokumen terlalu pendek → ditolak', () => {
  const errors = validatePengajuanMutasiInput({ ...VALID_INPUT, nomor_dokumen_mutasi: 'AB' });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'nomor_dokumen_mutasi');
  assert.match(errors[0].message, /3-100/);
});

test('Nomor dokumen memuat karakter tidak diizinkan → ditolak', () => {
  const errors = validatePengajuanMutasiInput({
    ...VALID_INPUT,
    nomor_dokumen_mutasi: 'MUT#2026<script>',
  });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'nomor_dokumen_mutasi');
  assert.match(errors[0].message, /hanya boleh berisi/);
});

test('Nomor dokumen dengan karakter . / _ - ( ) diterima', () => {
  const errors = validatePengajuanMutasiInput({
    ...VALID_INPUT,
    nomor_dokumen_mutasi: 'No. 12/SK-MUT(P2TEL)/2026',
  });
  assert.equal(errors.length, 0);
});

test('Format tanggal salah → ditolak', () => {
  const errors = validatePengajuanMutasiInput({
    ...VALID_INPUT,
    tanggal_mulai_mutasi: '01-03-2026',
    tanggal_dokumen_mutasi: '20/02/2026',
  });
  assert.equal(errors.length, 2);
  assert.ok(errors.some((e) => e.field === 'tanggal_mulai_mutasi'));
  assert.ok(errors.some((e) => e.field === 'tanggal_dokumen_mutasi'));
});

test('Tanggal tidak ada di kalender (2026-02-30) → ditolak', () => {
  assert.equal(parseMutasiDateOnly('2026-02-30'), null);
  const errors = validatePengajuanMutasiInput({
    ...VALID_INPUT,
    tanggal_mulai_mutasi: '2026-02-30',
  });
  assert.ok(errors.some((e) => e.field === 'tanggal_mulai_mutasi'));
});

test('Tanggal dokumen lebih akhir dari tanggal mulai mutasi → ditolak', () => {
  const errors = validatePengajuanMutasiInput({
    ...VALID_INPUT,
    tanggal_mulai_mutasi: '2026-02-01',
    tanggal_dokumen_mutasi: '2026-02-20',
  });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'tanggal_dokumen_mutasi');
  assert.match(errors[0].message, /tidak boleh lebih akhir/);
});

test('Suffix waktu pada tanggal diabaikan (presisi hari)', () => {
  const errors = validatePengajuanMutasiInput({
    ...VALID_INPUT,
    tanggal_mulai_mutasi: '2026-03-01T00:00:00',
    tanggal_dokumen_mutasi: '2026-03-01T23:59:59',
  });
  assert.equal(errors.length, 0);
});

test('formatMutasiValidationErrors menggabungkan seluruh pesan', () => {
  const errors = validatePengajuanMutasiInput({});
  const message = formatMutasiValidationErrors(errors);
  assert.ok(message.includes('Anggota (NIK) wajib dipilih'));
  assert.ok(message.includes('Cabang Tujuan wajib dipilih'));
  assert.ok(message.includes('Tanggal Mulai Mutasi wajib diisi'));
  assert.ok(message.includes('Nomor Dokumen Mutasi wajib diisi'));
  assert.ok(message.includes('Tanggal Dokumen Mutasi wajib diisi'));
});

test('getMutasiFieldError mengembalikan pesan untuk field terkait', () => {
  const errors = validatePengajuanMutasiInput({
    anggota_id: '',
    cabang_tujuan: '',
    tanggal_mulai_mutasi: '',
    nomor_dokumen_mutasi: '',
    tanggal_dokumen_mutasi: '',
  });
  assert.match(getMutasiFieldError(errors, 'anggota_id') || '', /wajib dipilih/);
  assert.match(getMutasiFieldError(errors, 'cabang_tujuan') || '', /wajib dipilih/);
  assert.equal(getMutasiFieldError([], 'nomor_dokumen_mutasi'), undefined);
});
