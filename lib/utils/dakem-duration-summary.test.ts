import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDakemDurationSummary,
  summarizeByCabang,
  diffDays,
} from './dakem-duration-summary';

test('diffDays menghitung selisih hari', () => {
  assert.equal(diffDays('2026-01-01', '2026-01-04'), 3);
  assert.equal(diffDays('2026-01-01', '2026-01-01'), 0);
  assert.equal(diffDays(null, '2026-01-01'), null);
  assert.equal(diffDays('2026-01-01', null), null);
});

test('getDakemDurationSummary mengisi tahapan yang tersedia', () => {
  const claim = {
    waktu_0: '2026-01-01T08:00:00Z',
    waktu_2: '2026-01-05T08:00:00Z',
    waktu_3: '2026-01-10T08:00:00Z',
    waktu_4: '2026-01-12T08:00:00Z',
    waktu_6: '2026-01-20T08:00:00Z',
    waktu_7: '2026-01-22T08:00:00Z',
  };
  const summary = getDakemDurationSummary(claim);
  assert.equal(summary.waktu_proses_cabang_hari, 4);
  assert.equal(summary.waktu_tunggu_pusat_hari, 5);
  assert.equal(summary.pemrosesan_pusat_hari, 2);
  assert.equal(summary.penyaluran_hari, 8);
  assert.equal(summary.pelaporan_hari, 2);
  assert.equal(summary.durasi_keseluruhan_hari, 21);
});

test('getDakemDurationSummary fallback ke kolom tanggal DATE', () => {
  const summary = getDakemDurationSummary({
    tanggal_lapor_keluarga: '2026-01-01',
    cabang_tanggal_kirim_ke_pusat: '2026-01-03',
    pusat_tanggal_validasi: '2026-01-06',
  });
  assert.equal(summary.waktu_proses_cabang_hari, 2);
  assert.equal(summary.waktu_tunggu_pusat_hari, 3);
  assert.equal(summary.jumlah_koreksi, 0);
});

test('jumlah_koreksi dihitung dari riwayat', () => {
  const summary = getDakemDurationSummary(
    { waktu_0: '2026-01-01' },
    [
      { status_ke: 'pending_dokumen' },
      { status_ke: 'revisi_pusat' },
      { status_ke: 'verified' },
    ],
  );
  assert.equal(summary.jumlah_koreksi, 2);
});

test('summarizeByCabang mengagregasi tanpa peringkat', () => {
  const recap = summarizeByCabang([
    { id: '1', cabang_asal_melapor: 'Cabang A', status_proses: 'selesai', waktu_0: '2026-01-01', waktu_2: '2026-01-05' },
    { id: '2', cabang_asal_melapor: 'Cabang A', status_proses: 'selesai', waktu_0: '2026-01-02', waktu_2: '2026-01-08' },
    { id: '3', cabang_asal_melapor: 'Cabang B', status_proses: 'draft', waktu_0: '2026-01-01' },
  ]);

  assert.equal(recap.length, 2);
  // Urutan alfabetis
  assert.equal(recap[0].cabang, 'Cabang A');
  assert.equal(recap[1].cabang, 'Cabang B');

  const a = recap[0];
  assert.equal(a.jumlah_pengajuan, 2);
  assert.equal(a.jumlah_selesai, 2);
  assert.equal(a.rata_rata_waktu_proses_cabang_hari, 5); // (4 + 6) / 2
});
