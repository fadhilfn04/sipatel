/**
 * Tests for lib/config/dana-kematian-berkas.ts — Mandatory Document
 * Configuration & gerbang "Berkas Lengkap".
 *
 * Run: npm test
 * (node:test via tsx — proyek belum punya test framework lain)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BERKAS_DOCUMENTS,
  evaluateBerkasDocument,
  getBerkasDocuments,
  getBerkasDocumentLabel,
  getMandatoryBerkasDocuments,
  getMissingBerkasItems,
  isBerkasLengkap,
} from './dana-kematian-berkas';

const FILE = 'https://xxx.supabase.co/storage/v1/object/public/dana-kematian/x/file.pdf';

/** Data pengajuan dengan seluruh dokumen wajib lengkap. */
function completeClaim(overrides: Record<string, any> = {}) {
  return {
    file_sk_pensiun: FILE,
    file_surat_kematian: FILE,
    file_surat_pernyataan_ahli_waris: FILE,
    file_kartu_keluarga: FILE,
    file_e_ktp: FILE,
    file_surat_nikah: FILE,
    file_surat_keterangan: FILE,
    file_dokumen_pendukung: FILE,
    document_metadata: {
      akte_kematian_sumber: 'disdukcapil',
      kk_ahli_waris_konfirmasi: true,
    },
    status_ahli_waris: 'anak',
    ...overrides,
  };
}

test('Seluruh dokumen wajib terpenuhi → isBerkasLengkap true, tanpa item hilang', () => {
  const claim = completeClaim();
  assert.equal(isBerkasLengkap(claim, { statusAhliWaris: 'anak' }), true);
  assert.deepEqual(getMissingBerkasItems(claim, { statusAhliWaris: 'anak' }), []);
});

test('Konfigurasi: Dokumen Pendukung (Dokumen-8) opsional — tidak menghalangi Berkas Lengkap', () => {
  const claim = completeClaim({ file_dokumen_pendukung: null });
  assert.equal(isBerkasLengkap(claim), true);
});

test('Dokumen wajib yang belum diupload muncul pada daftar item hilang', () => {
  const claim = completeClaim({ file_surat_keterangan: null, file_e_ktp: null });
  const missing = getMissingBerkasItems(claim, { statusAhliWaris: 'anak' });
  assert.ok(missing.includes('Surat Permohonan'));
  assert.ok(missing.includes('E-KTP Ahli Waris'));
  assert.equal(isBerkasLengkap(claim), false);
});

test('SK Pensiun dapat digantikan pernyataan resmi (flag + keterangan)', () => {
  const claim = completeClaim({
    file_sk_pensiun: null,
    document_metadata: {
      ...completeClaim().document_metadata,
      sk_pensiun_missing: true,
      sk_pensiun_hilang_keterangan: 'Hilang karena banjir',
    },
  });
  assert.equal(isBerkasLengkap(claim), true);
});

test('SK Pensiun hilang tanpa keterangan resmi → belum lengkap', () => {
  const claim = completeClaim({
    file_sk_pensiun: null,
    document_metadata: {
      ...completeClaim().document_metadata,
      sk_pensiun_missing: true,
    },
  });
  const missing = getMissingBerkasItems(claim);
  assert.ok(missing.some(item => item.startsWith('SK Pensiun')));
});

test('Surat Nikah dapat digantikan keterangan', () => {
  const claim = completeClaim({
    file_surat_nikah: null,
    document_metadata: {
      ...completeClaim().document_metadata,
      surat_nikah_keterangan: 'Buku nikah hilang terbakar',
    },
  });
  assert.equal(isBerkasLengkap(claim), true);
});

test('Akte Kematian wajib disertai sumber dokumen', () => {
  const claim = completeClaim({
    file_surat_kematian: FILE,
    document_metadata: { kk_ahli_waris_konfirmasi: true }, // tanpa akte_kematian_sumber
  });
  assert.equal(isBerkasLengkap(claim), false);
  assert.ok(getMissingBerkasItems(claim).includes('Sumber Dokumen Akte Kematian'));
});

test('Akte Kematian sumber lainnya wajib disertai keterangan sumber', () => {
  const claim = completeClaim({
    document_metadata: {
      akte_kematian_sumber: 'lainnya',
      kk_ahli_waris_konfirmasi: true,
      // akte_kematian_sumber_lainnya tidak diisi
    },
  });
  const missing = getMissingBerkasItems(claim);
  assert.ok(missing.some(item => item.includes('Akte Kematian (Lainnya)')));
});

test('KK wajib disertai konfirmasi garis keturunan', () => {
  const claim = completeClaim({
    document_metadata: { akte_kematian_sumber: 'disdukcapil' }, // konfirmasi KK false
  });
  assert.equal(isBerkasLengkap(claim), false);
  assert.ok(getMissingBerkasItems(claim).includes('Konfirmasi garis keturunan pada KK'));
});

test('Daftar dokumen wajib dikonfigurasi terpusat — dokumen opsional tidak masuk list', () => {
  const mandatory = getMandatoryBerkasDocuments();
  const optional = getBerkasDocuments().filter(doc => !doc.requiredForLengkap);

  assert.ok(mandatory.length >= 6, 'minimal 6 dokumen wajib sesuai baseline');
  assert.ok(
    mandatory.every(doc => doc.requiredForLengkap === true),
    'semua entri pada daftar mandatory ber-flag requiredForLengkap true'
  );
  assert.ok(
    optional.every(doc => doc.requiredForLengkap === false),
    'semua dokumen opsional ber-flag false'
  );
  // Baseline saat ini: 6 dokumen utama + Surat Permohonan (Dokumen-7) wajib;
  // Dokumen Pendukung (Dokumen-8) opsional.
  assert.ok(mandatory.some(d => d.id === 'surat_permohonan'));
  assert.ok(optional.some(d => d.id === 'dokumen_pendukung'));
});

test('Config memuat metadata Keterangan untuk Dokumen-7 & Dokumen-8 (pola Dokumen-1 SK)', () => {
  const permohonan = BERKAS_DOCUMENTS.find(d => d.id === 'surat_permohonan');
  const pendukung = BERKAS_DOCUMENTS.find(d => d.id === 'dokumen_pendukung');
  assert.equal(permohonan?.keteranganMetaKey, 'surat_permohonan_keterangan');
  assert.equal(pendukung?.keteranganMetaKey, 'dokumen_pendukung_keterangan');
});

test('evaluateBerkasDocument menandai dokumen belum ok bila file & keterangan tidak ada', () => {
  const permohonan = BERKAS_DOCUMENTS.find(d => d.id === 'surat_permohonan')!;
  const evaluation = evaluateBerkasDocument(
    permohonan,
    { file_surat_keterangan: null, document_metadata: {} },
    { statusAhliWaris: 'anak' }
  );
  assert.equal(evaluation.ok, false);
  assert.ok(evaluation.missingItems.includes('Surat Permohonan'));
});

test('Label Surat Ahli Waris mengikuti hubungan (keluarga inti vs lainnya)', () => {
  const doc = BERKAS_DOCUMENTS.find(d => d.id === 'surat_ahli_waris')!;
  assert.equal(
    getBerkasDocumentLabel(doc, { statusAhliWaris: 'istri' }),
    'Surat Keterangan Ahli Waris'
  );
  assert.equal(
    getBerkasDocumentLabel(doc, { statusAhliWaris: 'saudara' }),
    'Surat Kuasa Ahli Waris'
  );
});

test('File kosong string dianggap belum diupload', () => {
  const claim = completeClaim({ file_surat_keterangan: '' });
  assert.equal(isBerkasLengkap(claim), false);
});
