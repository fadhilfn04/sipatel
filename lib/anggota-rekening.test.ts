import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  REKENING_EDITABLE_FIELDS,
  buildRekeningUpdatePayload,
  computeRekeningDiff,
  isNamaPemilikSesuai,
  normalizeNamaPemilik,
  safeParsePenggantianRekening,
  safeParsePenggantianRekeningForm,
  WAJIB_PEMILIK_SAMA_DENGAN_ANGGOTA,
} from './anggota-rekening';

function futureDate(daysAhead = 1): string {
  return new Date(Date.now() + daysAhead * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

const baseForm = {
  nama_bank: 'Bank Central Asia',
  kode_bank: 'BCA',
  norek_bank: '1234567890',
  nama_pemilik_rekening: 'Budi Santoso',
  tanggal_efektif: futureDate(),
  dokumen_pendukung:
    'https://example.supabase.co/storage/v1/object/public/anggota/dokumen-rekening/buku.jpg',
};

const baseRequest = { ...baseForm, alasan: 'Rekening lama ditutup bank' };

test('allowlist rekening: hanya bank, norek, nama pemilik', () => {
  assert.deepEqual([...REKENING_EDITABLE_FIELDS].sort(), [
    'nama_bank',
    'nama_pemilik_rekening',
    'norek_bank',
  ]);
});

test('safeParse form valid → ok', () => {
  const result = safeParsePenggantianRekeningForm(baseForm);
  assert.equal(result.ok, true);
  assert.equal(result.data?.norek_bank, '1234567890');
});

test('safeParse request valid (dengan alasan) → ok', () => {
  const result = safeParsePenggantianRekening(baseRequest);
  assert.equal(result.ok, true);
  assert.equal(result.data?.alasan, 'Rekening lama ditutup bank');
});

test('norek non digit / kurang dari 8 digit ditolak', () => {
  for (const norek of ['12ab567890', '1234567']) {
    const result = safeParsePenggantianRekeningForm({ ...baseForm, norek_bank: norek });
    assert.equal(result.ok, false, `norek '${norek}' seharusnya ditolak`);
  }
});

test('nama pemilik rekening kurang dari 3 karakter ditolak', () => {
  const result = safeParsePenggantianRekeningForm({
    ...baseForm,
    nama_pemilik_rekening: 'AB',
  });
  assert.equal(result.ok, false);
});

test('tanggal efektif di masa lalu ditolak', () => {
  const result = safeParsePenggantianRekeningForm({
    ...baseForm,
    tanggal_efektif: '2000-01-01',
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('masa lalu')));
});

test('dokumen pendukung kosong / bukan URL ditolak', () => {
  for (const dokumen of ['', 'bukan-url']) {
    const result = safeParsePenggantianRekeningForm({
      ...baseForm,
      dokumen_pendukung: dokumen,
    });
    assert.equal(result.ok, false, `dokumen '${dokumen}' seharusnya ditolak`);
  }
});

test('alasan kurang dari 10 karakter ditolak (request)', () => {
  const result = safeParsePenggantianRekening({ ...baseRequest, alasan: 'pendek' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.toLowerCase().includes('alasan')));
});

test('field di luar allowlist (strict) ditolak', () => {
  const result = safeParsePenggantianRekening({ ...baseRequest, nik: '3201123456789012' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("'nik'")));
});

test('normalisasi & kesesuaian nama pemilik rekening', () => {
  assert.equal(normalizeNamaPemilik('  budi   santoso '), 'BUDI SANTOSO');
  assert.equal(isNamaPemilikSesuai('budi  santoso', 'BUDI SANTOSO'), true);
  assert.equal(isNamaPemilikSesuai('Siti Aminah', 'Budi Santoso'), false);
  // Default aman: wajib sama dengan nama anggota.
  assert.equal(WAJIB_PEMILIK_SAMA_DENGAN_ANGGOTA, true);
});

test('computeRekeningDiff hanya field rekening yang berubah', () => {
  const diff = computeRekeningDiff(
    { nama_bank: 'BCA', norek_bank: '11111111', nama_pemilik_rekening: 'Budi' },
    { ...baseForm, nama_bank: 'BCA' },
  );
  assert.equal(diff.length, 2);
  const fields = diff.map((d) => d.field).sort();
  assert.deepEqual(fields, ['nama_pemilik_rekening', 'norek_bank']);
});

test('buildRekeningUpdatePayload hanya 3 kolom rekening + updated_at', () => {
  const payload = buildRekeningUpdatePayload(baseForm);
  assert.deepEqual(
    { ...payload, updated_at: 'fixed' },
    {
      nama_bank: 'Bank Central Asia',
      norek_bank: '1234567890',
      nama_pemilik_rekening: 'Budi Santoso',
      updated_at: 'fixed',
    },
  );
});
