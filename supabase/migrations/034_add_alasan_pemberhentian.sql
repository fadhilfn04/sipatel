-- =====================================================
-- MIGRATION 034: ALASAN PEMBERHENTIAN PENGURUS
-- =====================================================
-- Fitur: menu Pemberhentian Pengurus (docs/pemberhentian-pengurus-audit.md).
-- Menambah alasan terstruktur pada baris jenis='berhentikan' di tabel
-- anggota_kepengurusan (migration 033). TIDAK ada tabel baru — mekanisme
-- perubahan kepengurusan existing dipakai ulang sepenuhnya.
--
-- Keputusan yang diterapkan (default rekomendasi audit §13):
--  - Q1 enum alasan: habis_masa_jabatan, mengundurkan_diri, diberhentikan, lainnya
--  - Q2 keterangan_alasan wajib bila 'lainnya' (divalidasi di API/form)
--  - Q3 dokumen SK wajib bila 'diberhentikan' (divalidasi di API/form)
--
-- Migration ini idempotent & additive — tidak mengubah data lama.
-- =====================================================

-- =====================================================
-- 1. ENUM ALASAN PEMBERHENTIAN
-- =====================================================

DO $$ BEGIN
  CREATE TYPE alasan_pemberhentian_enum AS ENUM
    ('habis_masa_jabatan', 'mengundurkan_diri', 'diberhentikan', 'lainnya');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- 2. KOLOM TAMBAHAN (nullable → aman untuk data lama)
-- =====================================================

ALTER TABLE anggota_kepengurusan
  ADD COLUMN IF NOT EXISTS alasan_pemberhentian alasan_pemberhentian_enum;
ALTER TABLE anggota_kepengurusan
  ADD COLUMN IF NOT EXISTS keterangan_alasan TEXT;

-- =====================================================
-- 3. INDEX FILTER DAFTAR PER JENIS (menu Pemberhentian Pengurus)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_kepengurusan_jenis_status
  ON anggota_kepengurusan(jenis, status)
  WHERE deleted_at IS NULL;

-- =====================================================
-- 4. COMMENTS
-- =====================================================

COMMENT ON COLUMN anggota_kepengurusan.alasan_pemberhentian IS
  'Alasan pemberhentian pengurus — hanya relevan saat jenis=''berhentikan'' (nullable). '
  'Nilai: habis_masa_jabatan, mengundurkan_diri, diberhentikan, lainnya.';
COMMENT ON COLUMN anggota_kepengurusan.keterangan_alasan IS
  'Penjelasan alasan pemberhentian — wajib bila alasan_pemberhentian=''lainnya'' (divalidasi API).';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
