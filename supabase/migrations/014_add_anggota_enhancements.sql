-- Migration: Add anggota enhancements
-- 1. urutan_keluarga INT for istri/anak ordering (sequence number, NOT enum values)
-- 2. foto_anggota TEXT for member photo (Supabase Storage URL)
-- 3. master_cabang table (single source of truth for branch data)
-- 4. nik_kepemilikan: proper FKs to anggota (heir_anggota_id, source_anggota_id)

-- =========================================================
-- 1. ANGGOTA: urutan_keluarga + foto_anggota
-- =========================================================

-- Sequence number for istri/suami/anak (Istri 1, Anak 2, etc.)
-- Kept as INT (nullable) instead of enum values to remain extensible
-- and to avoid modifying status_anggota_enum which is shared with dana_kematian
ALTER TABLE anggota
  ADD COLUMN IF NOT EXISTS urutan_keluarga INT;

-- Member photo URL (Supabase Storage)
ALTER TABLE anggota
  ADD COLUMN IF NOT EXISTS foto_anggota TEXT;

CREATE INDEX IF NOT EXISTS idx_anggota_urutan_keluarga
  ON anggota(urutan_keluarga);

COMMENT ON COLUMN anggota.urutan_keluarga IS
  'Nomor urut keluarga untuk status istri/suami/anak (contoh: Istri 1 = urutan 1, Anak 2 = urutan 2). Nullable for non-family statuses.';
COMMENT ON COLUMN anggota.foto_anggota IS
  'URL foto anggota yang disimpan di Supabase Storage bucket anggota/foto-anggota';

-- =========================================================
-- 2. MASTER CABANG TABLE
-- =========================================================
-- Single source of truth for branch data.
-- anggota.kode_cabang references this table's kode_cabang (denormalized).
-- Anggota stores cached copies of nama_cabang/kelas/area values for historical integrity.

CREATE TABLE IF NOT EXISTS master_cabang (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  kode_cabang VARCHAR(20) NOT NULL UNIQUE,
  nama_cabang VARCHAR(120) NOT NULL,
  kelas_cabang VARCHAR(50),
  area_regional VARCHAR(50),
  area_witel VARCHAR(50),

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_master_cabang_kode_cabang
  ON master_cabang(kode_cabang);

CREATE INDEX IF NOT EXISTS idx_master_cabang_nama_cabang
  ON master_cabang(nama_cabang);

CREATE INDEX IF NOT EXISTS idx_master_cabang_area_regional
  ON master_cabang(area_regional);

CREATE INDEX IF NOT EXISTS idx_master_cabang_area_witel
  ON master_cabang(area_witel);

CREATE TRIGGER update_master_cabang_updated_at
  BEFORE UPDATE ON master_cabang
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE master_cabang IS 'Master data cabang (single source of truth for branch information)';
COMMENT ON COLUMN master_cabang.kode_cabang IS 'Kode unik cabang, example: BDG001';
COMMENT ON COLUMN master_cabang.nama_cabang IS 'Nama cabang, example: Bandung';
COMMENT ON COLUMN master_cabang.kelas_cabang IS 'Kelas cabang, example: Kelas A';
COMMENT ON COLUMN master_cabang.area_regional IS 'Area regional, example: Jawa Barat';
COMMENT ON COLUMN master_cabang.area_witel IS 'Area witel, example: Bandung';

-- =========================================================
-- 3. NIK KEPEMILIKAN: REAL FK RELATIONSHIPS
-- =========================================================
-- The existing nik_kepemilikan.anggota_id is VARCHAR(255) free text.
-- We add two new nullable FK columns to track the real anggota records:
--   - source_anggota_id: the deceased member who originally owned the NIK
--   - heir_anggota_id:   the actual heir member (the new owner)
-- The old anggota_id column is kept for backward compatibility.

ALTER TABLE nik_kepemilikan
  ADD COLUMN IF NOT EXISTS source_anggota_id UUID REFERENCES anggota(id) ON DELETE SET NULL;

ALTER TABLE nik_kepemilikan
  ADD COLUMN IF NOT EXISTS heir_anggota_id UUID REFERENCES anggota(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nik_kepemilikan_source_anggota_id
  ON nik_kepemilikan(source_anggota_id);

CREATE INDEX IF NOT EXISTS idx_nik_kepemilikan_heir_anggota_id
  ON nik_kepemilikan(heir_anggota_id);

COMMENT ON COLUMN nik_kepemilikan.source_anggota_id IS
  'Foreign key ke anggota yang meninggal (sumber NIK). Nullable for backward compatibility with old rows.';
COMMENT ON COLUMN nik_kepemilikan.heir_anggota_id IS
  'Foreign key ke anggota ahli waris yang mewarisi NIK. Nullable for backward compatibility.';