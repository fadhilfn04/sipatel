-- =====================================================
-- MIGRATION 026: Formalize Dakem document columns (drift reconciliation)
-- =====================================================
-- Kolom-kolom berikut SUDAH ADA di database produksi (digunakan oleh form
-- pengajuan Dana Kematian) tetapi belum pernah diformalkan di file migrasi:
--   - file_surat_keterangan       (Dokumen-7 — Surat Permohonan)
--   - dokumen_surat_keterangan_verified
--   - dokumen_pendukung_verified  (Dokumen-8 — Dokumen Pendukung)
--   - document_metadata           (JSONB; keterangan dokumen, sumber akte,
--                                  konfirmasi KK, rejection note, dll.)
--
-- Migration ini idempotent (ADD COLUMN IF NOT EXISTS) — tidak mengubah data
-- apa pun, hanya memastikan skema terdefinisi di semua environment.
--
-- Field "Keterangan" Dokumen-7 & Dokumen-8 (pola Dokumen-1 SK Pensiun)
-- disimpan pada document_metadata dengan key:
--   - surat_permohonan_keterangan
--   - dokumen_pendukung_keterangan
-- =====================================================

ALTER TABLE dana_kematian
  ADD COLUMN IF NOT EXISTS file_surat_keterangan TEXT,
  ADD COLUMN IF NOT EXISTS dokumen_surat_keterangan_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dokumen_pendukung_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS document_metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN dana_kematian.file_surat_keterangan IS 'Dokumen-7: Surat Permohonan/pengantar resmi dari cabang (URL)';
COMMENT ON COLUMN dana_kematian.dokumen_surat_keterangan_verified IS 'Flag verifikasi PP untuk Dokumen-7 (Surat Permohonan)';
COMMENT ON COLUMN dana_kematian.dokumen_pendukung_verified IS 'Flag verifikasi PP untuk Dokumen-8 (Dokumen Pendukung, opsional)';
COMMENT ON COLUMN dana_kematian.document_metadata IS 'Metadata dokumen (jsonb): keterangan dokumen (sk_pensiun_hilang_keterangan, surat_nikah_keterangan, surat_permohonan_keterangan, dokumen_pendukung_keterangan), sumber akte kematian, konfirmasi KK, rejection note, laporan cabang, dll.';

-- =====================================================
-- Daftar dokumen wajib ("Berkas Lengkap") dikonfigurasi terpusat pada
-- lib/config/dana-kematian-berkas.ts (dipakai bersama frontend & backend).
-- Menambah dokumen wajib baru di masa depan cukup:
--   1. Tambah kolom file_* TEXT + dokumen_*_verified BOOLEAN di sini.
--   2. Tambah folder bucket + validasi folder di app/api/upload.
--   3. Tambah entri pada BERKAS_DOCUMENTS (requiredForLengkap: true).
-- =====================================================

-- END OF MIGRATION
