import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildAnggotaPartialUpdatePayload,
  computeFieldDiff,
  formatFieldValue,
  getFieldLabel,
  PERSONAL_DATA_EDITABLE_FIELDS,
  PROTECTED_FIELDS,
  safeParsePerubahanDataPribadi,
} from './anggota-perubahan';

test('allowlist tidak memuat field terproteksi', () => {
  for (const field of PERSONAL_DATA_EDITABLE_FIELDS) {
    assert.equal(
      (PROTECTED_FIELDS as readonly string[]).includes(field),
      false,
      `Field '${field}' tidak boleh berada di allowlist Perubahan Data Pribadi`,
    );
  }
});

test('safeParse: payload valid → hanya field yang dikirim yang diekstrak', () => {
  const result = safeParsePerubahanDataPribadi({
    perubahan: { alamat: 'Jl. Merdeka No. 1', nomor_handphone: '081234567890' },
    alasan: 'Pindah rumah baru',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.changes || {}).sort(), [
    'alamat',
    'nomor_handphone',
  ]);
  assert.equal(result.alasan, 'Pindah rumah baru');
});

test('safeParse: field terproteksi (nik) ditolak dengan pesan jelas', () => {
  const result = safeParsePerubahanDataPribadi({
    perubahan: { nik: '3201123456789012', alamat: 'Jl. Merdeka No. 1' },
    alasan: 'koreksi data pribadi',
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("'nik'")));
});

test('safeParse: alasan wajib minimal 10 karakter', () => {
  const result = safeParsePerubahanDataPribadi({
    perubahan: { alamat: 'Jl. Merdeka No. 1' },
    alasan: 'pendek',
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.toLowerCase().includes('alasan')));
});

test('safeParse: nomor handphone tidak valid ditolak', () => {
  const result = safeParsePerubahanDataPribadi({
    perubahan: { nomor_handphone: 'abcdefgh' },
    alasan: 'koreksi nomor handphone',
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('handphone')));
});

test('safeParse: tanggal lahir di masa depan ditolak', () => {
  const result = safeParsePerubahanDataPribadi({
    perubahan: { tanggal_lahir: '2999-01-01' },
    alasan: 'koreksi tanggal lahir',
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('masa depan')));
});

test('safeParse: string kosong dinormalisasi menjadi null', () => {
  const result = safeParsePerubahanDataPribadi({
    perubahan: { email: '' },
    alasan: 'mengosongkan email lama',
  });

  assert.equal(result.ok, true);
  assert.equal(result.changes?.email, null);
});

test('computeFieldDiff: hanya menampilkan field yang benar-benar berubah', () => {
  const before = { alamat: 'Jl. Lama', rt: '001', email: null };
  const after = { alamat: 'Jl. Baru', rt: '001', email: '' };

  const diff = computeFieldDiff(before, after, Object.keys(after));

  assert.equal(diff.length, 1);
  assert.equal(diff[0].field, 'alamat');
  assert.equal(diff[0].label, 'Alamat');
});

test('computeFieldDiff: label & format nilai boolean', () => {
  const diff = computeFieldDiff({ status_bpjs: false }, { status_bpjs: true }, [
    'status_bpjs',
  ]);

  assert.equal(diff.length, 1);
  assert.equal(getFieldLabel('status_bpjs'), 'Status BPJS');
  assert.equal(formatFieldValue(diff[0].before), 'Tidak');
  assert.equal(formatFieldValue(diff[0].after), 'Ya');
});

test('allowlist tidak memuat field rekening (milik menu Penggantian Rekening)', () => {
  for (const field of ['nama_bank', 'norek_bank', 'nama_pemilik_rekening']) {
    assert.equal(
      PERSONAL_DATA_EDITABLE_FIELDS.includes(field as never),
      false,
      `Field '${field}' tidak boleh diubah lewat Perubahan Data Pribadi`,
    );
    assert.equal(
      (PROTECTED_FIELDS as readonly string[]).includes(field),
      true,
      `Field '${field}' harus terdaftar di PROTECTED_FIELDS`,
    );
  }
});

test('safeParse: perubahan nama_bank ditolak (gunakan menu Penggantian Rekening)', () => {
  const result = safeParsePerubahanDataPribadi({
    perubahan: { nama_bank: 'BCA' },
    alasan: 'ganti rekening lama ke rekening baru',
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("'nama_bank'")));
});

test('buildAnggotaPartialUpdatePayload: hanya key terkirim + normalisasi + updated_at', () => {
  const payload = buildAnggotaPartialUpdatePayload({
    alamat: 'Jl. Merdeka No. 1',
    email: '',
    status_bpjs: false,
    nomor_handphone: undefined,
    alasan_perubahan: 'harus dibuang',
  });

  assert.deepEqual(
    { ...payload, updated_at: 'fixed' },
    {
      alamat: 'Jl. Merdeka No. 1',
      email: null,
      status_bpjs: false,
      updated_at: 'fixed',
    },
  );
});
