/**
 * Tests for lib/server/dakem-enforcement-rules.ts — read-only pasca submit
 * ke Pusat & transisi khusus Pusat (anti-bypass API oleh USER CABANG).
 *
 * Run: npm test
 * (node:test via tsx — proyek belum punya test framework lain)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCabangPatchPermissions,
  DakemActorContext,
} from './dakem-enforcement-rules';

const CABANG: DakemActorContext = {
  userId: 'u-cabang',
  roleSlug: 'pc_staff',
  isSuperuser: false,
  canManagePC: true,
  canVerifyPP: false,
  isCabangOnly: true,
};

const PUSAT: DakemActorContext = {
  userId: 'u-pusat',
  roleSlug: 'pp_staff',
  isSuperuser: false,
  canManagePC: false,
  canVerifyPP: true,
  isCabangOnly: false,
};

const DRAFT_CLAIM = {
  status_proses: 'draft',
  file_sk_pensiun: null,
  nama_anggota: 'A',
  dokumen_sk_pensiun_verified: false,
};

const SUBMITTED_CLAIM = {
  status_proses: 'proses_pusat',
  file_sk_pensiun: 'https://x/sk.pdf',
  nama_anggota: 'A',
  tanggal_meninggal: '2026-01-01',
  document_metadata: {},
};

test('Cabang masih boleh mengubah data pengajuan saat status draft', () => {
  const result = validateCabangPatchPermissions(
    { nama_anggota: 'B', file_sk_pensiun: 'https://x/new.pdf' },
    DRAFT_CLAIM,
    CABANG,
  );
  assert.equal(result.allowed, true);
});

test('Cabang DAPAT submit Berkas Lengkap (draft → proses_pusat)', () => {
  const result = validateCabangPatchPermissions(
    { status_proses: 'proses_pusat' },
    DRAFT_CLAIM,
    CABANG,
  );
  assert.equal(result.allowed, true);
});

test('Bypass API: cabang mengubah data/dokumen SETELAH submit → 403 ditolak', () => {
  const result = validateCabangPatchPermissions(
    { file_sk_pensiun: 'https://x/diubah.pdf', nama_anggota: 'B' },
    SUBMITTED_CLAIM,
    CABANG,
  );
  assert.equal(result.allowed, false);
  assert.match(result.message || '', /read-only/);
  assert.match(result.message || '', /file_sk_pensiun/);
});

test('Bypass API: cabang mengubah tanggal meninggal setelah submit → ditolak', () => {
  const result = validateCabangPatchPermissions(
    { tanggal_meninggal: '2020-01-01' },
    SUBMITTED_CLAIM,
    CABANG,
  );
  assert.equal(result.allowed, false);
});

test('Cabang tidak dapat melakukan transisi khusus Pusat', () => {
  for (const target of ['verified', 'penyaluran', 'ditolak']) {
    const result = validateCabangPatchPermissions(
      { status_proses: target },
      SUBMITTED_CLAIM,
      CABANG,
    );
    assert.equal(result.allowed, false, `target ${target} harus ditolak`);
  }
});

test('Cabang tidak dapat mengembalikan berkas koreksi dari proses_pusat', () => {
  const result = validateCabangPatchPermissions(
    { status_proses: 'pending_dokumen' },
    SUBMITTED_CLAIM,
    CABANG,
  );
  assert.equal(result.allowed, false);
});

test('Cabang tidak dapat menyetir flag verifikasi dokumen milik Pusat (walau di draft)', () => {
  const result = validateCabangPatchPermissions(
    { dokumen_sk_pensiun_verified: true },
    DRAFT_CLAIM,
    CABANG,
  );
  assert.equal(result.allowed, false);
  assert.match(result.message || '', /dokumen_sk_pensiun_verified/);
});

test('Nilai no-op (sama dengan existing) tetap diizinkan pasca submit', () => {
  const result = validateCabangPatchPermissions(
    { nama_anggota: 'A', file_sk_pensiun: 'https://x/sk.pdf' },
    SUBMITTED_CLAIM,
    CABANG,
  );
  assert.equal(result.allowed, true);
});

test('Aksi tahap lanjut PC tetap diizinkan pasca submit (penyerahan/laporan/selesai)', () => {
  // penyaluran → terima_ahli_waris
  assert.equal(
    validateCabangPatchPermissions(
      {
        status_proses: 'terima_ahli_waris',
        cabang_tanggal_serah_ke_ahli_waris: '2026-02-01',
        file_bukti_penyerahan: 'https://x/serah.pdf',
        waktu_6: '2026-02-01T10:00:00Z',
      },
      { ...SUBMITTED_CLAIM, status_proses: 'penyaluran' },
      CABANG,
    ).allowed,
    true,
  );

  // terima_ahli_waris → laporan (upload laporan cabang via document_metadata)
  assert.equal(
    validateCabangPatchPermissions(
      {
        status_proses: 'laporan',
        document_metadata: { file_laporan_cabang: 'https://x/laporan.pdf' },
      },
      { ...SUBMITTED_CLAIM, status_proses: 'terima_ahli_waris' },
      CABANG,
    ).allowed,
    true,
  );

  // laporan → selesai
  assert.equal(
    validateCabangPatchPermissions(
      {
        status_proses: 'selesai',
        cabang_tanggal_lapor_ke_pusat: '2026-03-01',
        pusat_tanggal_selesai: '2026-03-01',
        waktu_7: '2026-03-01T10:00:00Z',
      },
      { ...SUBMITTED_CLAIM, status_proses: 'laporan' },
      CABANG,
    ).allowed,
    true,
  );
});

test('document_metadata pasca submit hanya boleh pada tahap laporan cabang', () => {
  const result = validateCabangPatchPermissions(
    { document_metadata: { surat_nikah_keterangan: 'diubah' } },
    SUBMITTED_CLAIM, // proses_pusat — bukan tahap laporan
    CABANG,
  );
  assert.equal(result.allowed, false);
});

test('Pusat/admin tidak dibatasi aturan cabang', () => {
  const result = validateCabangPatchPermissions(
    { dokumen_sk_pensiun_verified: true, status_proses: 'verified' },
    SUBMITTED_CLAIM,
    PUSAT,
  );
  assert.equal(result.allowed, true);
});
