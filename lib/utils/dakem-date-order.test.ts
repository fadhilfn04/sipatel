/**
 * Tests for lib/utils/dakem-date-order.ts
 *
 * Run: npm test
 * (node:test via tsx — proyek belum punya test framework lain)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateOrderErrors,
  validateDakemDateOrder,
  getDakemDateOrderFields,
} from './dakem-date-order';

test('Rantai tanggal urut sesuai workflow → tidak ada error', () => {
  const errors = validateDakemDateOrder({
    tanggal_meninggal: '2026-01-10',
    tanggal_lapor_keluarga: '2026-01-12',
    cabang_tanggal_awal_terima_berkas: '2026-01-15',
    cabang_tanggal_kirim_ke_pusat: '2026-01-20',
    pusat_tanggal_awal_terima: '2026-01-22',
    pusat_tanggal_validasi: '2026-01-25',
    pusat_tanggal_selesai: '2026-02-01',
    cabang_tanggal_serah_ke_ahli_waris: '2026-01-28',
    cabang_tanggal_lapor_ke_pusat: '2026-02-05',
  });
  assert.equal(errors.length, 0);
});

test('Tanggal Meninggal lebih besar dari tanggal Input/Pengajuan → ditolak', () => {
  const errors = validateDakemDateOrder({
    tanggal_meninggal: '2026-02-01',
    cabang_tanggal_awal_terima_berkas: '2026-01-15',
  });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'cabang_tanggal_awal_terima_berkas');
  assert.match(errors[0].message, /Tanggal Input\/Terima Berkas/);
  assert.match(errors[0].message, /tidak boleh lebih awal dari Tanggal Meninggal/);
});

test('Tanggal Meninggal lebih besar dari tanggal Kirim ke Pusat → ditolak', () => {
  const errors = validateDakemDateOrder({
    tanggal_meninggal: '2026-02-01',
    cabang_tanggal_kirim_ke_pusat: '2026-01-20',
  });
  // Error menempel pada tahap yang lebih awal dari tahap sebelumnya:
  // kirim ke pusat lebih awal dari meninggal (dan lapor keluarga kosong).
  assert.ok(errors.length >= 1);
  assert.ok(errors.some(e => e.field === 'cabang_tanggal_kirim_ke_pusat'));
});

test('Tanggal kirim ke Pusat lebih awal dari tanggal terima berkas → ditolak', () => {
  const errors = validateDakemDateOrder({
    tanggal_meninggal: '2026-01-10',
    cabang_tanggal_awal_terima_berkas: '2026-01-15',
    cabang_tanggal_kirim_ke_pusat: '2026-01-12',
  });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'cabang_tanggal_kirim_ke_pusat');
});

test('Tanggal validasi pusat lebih awal dari tanggal kirim → ditolak', () => {
  const errors = validateDakemDateOrder({
    tanggal_meninggal: '2026-01-10',
    cabang_tanggal_kirim_ke_pusat: '2026-01-20',
    pusat_tanggal_awal_terima: '2026-01-22',
    pusat_tanggal_validasi: '2026-01-21',
  });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'pusat_tanggal_validasi');
});

test('Serah ke ahli waris lebih awal dari validasi pusat → ditolak', () => {
  const errors = validateDakemDateOrder({
    tanggal_meninggal: '2026-01-10',
    pusat_tanggal_validasi: '2026-02-01',
    cabang_tanggal_serah_ke_ahli_waris: '2026-01-15',
  });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'cabang_tanggal_serah_ke_ahli_waris');
  assert.match(errors[0].message, /Serah ke Ahli Waris/);
});

test('Tanggal sama persis antar tahap → diterima (boundary)', () => {
  const errors = validateDakemDateOrder({
    tanggal_meninggal: '2026-01-10',
    tanggal_lapor_keluarga: '2026-01-10',
    cabang_tanggal_awal_terima_berkas: '2026-01-10',
  });
  assert.equal(errors.length, 0);
});

test('Tanggal kosong/null diabaikan — hanya pasangan terisi yang divalidasi', () => {
  const errors = validateDakemDateOrder({
    tanggal_meninggal: '2026-01-10',
    tanggal_lapor_keluarga: null,
    cabang_tanggal_awal_terima_berkas: undefined,
    pusat_tanggal_validasi: '',
  });
  assert.equal(errors.length, 0);
});

test('Suffix waktu pada tanggal diabaikan (presisi hari)', () => {
  const errors = validateDakemDateOrder({
    tanggal_meninggal: '2026-01-10T08:00:00',
    cabang_tanggal_awal_terima_berkas: '2026-01-10T23:59:59',
  });
  assert.equal(errors.length, 0);
});

test('formatDateOrderErrors menggabungkan seluruh pesan', () => {
  const errors = validateDakemDateOrder({
    tanggal_meninggal: '2026-02-01',
    cabang_tanggal_awal_terima_berkas: '2026-01-15',
    cabang_tanggal_kirim_ke_pusat: '2026-01-16',
  });
  const message = formatDateOrderErrors(errors);
  assert.ok(message.includes('Tanggal Input/Terima Berkas'));
  assert.ok(message.includes('Tanggal Kirim ke Pusat'));
});

test('getDakemDateOrderFields memuat seluruh field rantai + serah ke ahli waris', () => {
  const fields = getDakemDateOrderFields();
  assert.ok(fields.includes('tanggal_meninggal'));
  assert.ok(fields.includes('cabang_tanggal_kirim_ke_pusat'));
  assert.ok(fields.includes('cabang_tanggal_lapor_ke_pusat'));
  assert.ok(fields.includes('cabang_tanggal_serah_ke_ahli_waris'));
});
