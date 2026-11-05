-- =====================================================
-- MIGRATION 030: PENGAJUAN MUTASI CABANG — CABANG TUJUAN
-- =====================================================
-- Penyesuaian: fitur Mutasi Cabang menjadi fitur pengurus/admin.
-- Pengaju memilih anggota (NIK) dan menentukan cabang tujuan.
-- =====================================================

ALTER TABLE pengajuan_mutasi_cabang
  ADD COLUMN IF NOT EXISTS cabang_tujuan VARCHAR(120);

ALTER TABLE pengajuan_mutasi_cabang
  ADD COLUMN IF NOT EXISTS kode_cabang_tujuan VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_pengajuan_mutasi_tujuan
  ON pengajuan_mutasi_cabang(cabang_tujuan);

COMMENT ON COLUMN pengajuan_mutasi_cabang.cabang_tujuan IS 'Nama cabang tujuan mutasi (dipilih pengurus/admin)';
COMMENT ON COLUMN pengajuan_mutasi_cabang.kode_cabang_tujuan IS 'Kode cabang tujuan mutasi (jika tersedia pada master cabang)';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
