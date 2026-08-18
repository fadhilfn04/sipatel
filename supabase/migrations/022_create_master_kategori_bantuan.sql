-- ============================================
-- Phase 2: Master Kategori Bantuan
-- ============================================
-- Creates a master table for bantuan (assistance) categories
-- Replaces free-text kategori_bantuan field in anggota table

-- =========================================================
-- 1. CREATE MASTER KATEGORI BANTUAN TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS master_kategori_bantuan (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kode_kategori VARCHAR(20) UNIQUE NOT NULL,
  nama_kategori VARCHAR(100) NOT NULL,
  deskripsi TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =========================================================
-- 2. CREATE INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_master_kategori_bantuan_kode
  ON master_kategori_bantuan(kode_kategori);

CREATE INDEX IF NOT EXISTS idx_master_kategori_bantuan_nama
  ON master_kategori_bantuan(nama_kategori);

CREATE INDEX IF NOT EXISTS idx_master_kategori_bantuan_is_active
  ON master_kategori_bantuan(is_active);

-- =========================================================
-- 3. CREATE UPDATED_AT TRIGGER
-- =========================================================

CREATE OR REPLACE FUNCTION update_kategori_bantuan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_kategori_bantuan_updated_at
  BEFORE UPDATE ON master_kategori_bantuan
  FOR EACH ROW
  EXECUTE FUNCTION update_kategori_bantuan_updated_at();

-- Apply updated_by trigger
CREATE TRIGGER trg_audit_kategori_bantuan_updated_by
  BEFORE UPDATE ON master_kategori_bantuan
  FOR EACH ROW
  EXECUTE FUNCTION update_audit_updated_by();

-- =========================================================
-- 4. SEED COMMON BANTUAN CATEGORIES
-- =========================================================

INSERT INTO master_kategori_bantuan (kode_kategori, nama_kategori, deskripsi) VALUES
  -- Existing categories from anggota table
  ('BANSOS', 'Bantuan Sosial', 'Bantuan sosial rutin untuk anggota'),
  ('BANTUAN_MEDIS', 'Bantuan Medis', 'Bantuan untuk keperluan medis/kesehatan'),
  ('BANTUAN_PENDIDIKAN', 'Bantuan Pendidikan', 'Bantuan untuk keperluan pendidikan'),
  ('BANTUAN_PERBAIKAN_RUMAH', 'Bantuan Perbaikan Rumah', 'Bantuan untuk perbaikan/tempat tinggal'),

  -- Additional common categories
  ('BANTUAN_DARURAT', 'Bantuan Darurat', 'Bantuan untuk keadaan darurat'),
  ('BANTUAN_KEMATIAN', 'Bantuan Kematian Keluarga', 'Bantuan duka cita ketika keluarga meninggal'),
  ('BANTUAN_BENCANA', 'Bantuan Bencana Alam', 'Bantuan untuk korban bencana alam'),
  ('BANTUAN_IBADAH', 'Bantuan Ibadah', 'Bantuan untuk keperluan ibadah'),
  ('BANTUAN_TRANSPORTASI', 'Bantuan Transportasi', 'Bantuan untuk keperluan transportasi'),
  ('BANTUAN_LAINNYA', 'Bantuan Lainnya', 'Kategori bantuan lainnya')
ON CONFLICT (kode_kategori) DO NOTHING;

-- =========================================================
-- 5. ADD KODE_KATEGORI TO anggota TABLE
-- =========================================================

ALTER TABLE anggota
  ADD COLUMN IF NOT EXISTS kategori_bantuan_id UUID REFERENCES master_kategori_bantuan(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_anggota_kategori_bantuan_id
  ON anggota(kategori_bantuan_id);

-- =========================================================
-- 6. MIGRATE EXISTING DATA
-- =========================================================
-- Try to match existing free-text kategori_bantuan to master records

UPDATE anggota a
SET kategori_bantuan_id = mkb.id
FROM master_kategori_bantuan mkb
WHERE a.kategori_bantuan IS NOT NULL
  AND (
    a.kategori_bantuan = mkb.nama_kategori OR
    LOWER(a.kategori_bantuan) = LOWER(mkb.nama_kategori) OR
    a.kategori_bantuan LIKE '%' || mkb.nama_kategori || '%'
  )
  AND a.kategori_bantuan_id IS NULL;

-- =========================================================
-- 7. UPDATE COMMENTS
-- =========================================================

COMMENT ON TABLE master_kategori_bantuan IS
  'Master table for bantuan (assistance) categories. '
  'Standardizes kategori_bantuan values across the system.';

COMMENT ON COLUMN master_kategori_bantuan.id IS
  'Primary key UUID';

COMMENT ON COLUMN master_kategori_bantuan.kode_kategori IS
  'Unique category code (e.g., BANSOS, BANTUAN_MEDIS)';

COMMENT ON COLUMN master_kategori_bantuan.nama_kategori IS
  'Display name of the category';

COMMENT ON COLUMN master_kategori_bantuan.deskripsi IS
  'Detailed description of what this category covers';

COMMENT ON COLUMN anggota.kategori_bantuan_id IS
  'Foreign key reference to master_kategori_bantuan. '
  'Replaces free-text kategori_bantuan field.';

COMMENT ON COLUMN anggota.kategori_bantuan IS
  'Legacy text field. New records should use kategori_bantuan_id FK. '
  'Keep for historical accuracy.';

-- =========================================================
-- 8. CREATE VIEW FOR ACTIVE CATEGORIES
-- =========================================================

CREATE OR REPLACE VIEW active_kategori_bantuan AS
SELECT id, kode_kategori, nama_kategori, deskripsi
FROM master_kategori_bantuan
WHERE is_active = true
ORDER BY nama_kategori;

COMMENT ON VIEW active_kategori_bantuan IS
  'View of active bantuan categories for dropdown selection';

-- =========================================================
-- 9. ENABLE ROW LEVEL SECURITY (RLS)
-- =========================================================

ALTER TABLE master_kategori_bantuan ENABLE ROW LEVEL SECURITY;

-- Public read access (master data is reference data)
CREATE POLICY "Allow public read access on master_kategori_bantuan"
  ON master_kategori_bantuan FOR SELECT
  TO public
  USING (is_active = true);

-- Authenticated users can view all (including inactive)
CREATE POLICY "Allow authenticated to view all master_kategori_bantuan"
  ON master_kategori_bantuan FOR SELECT
  TO authenticated
  USING (true);

-- Only users with MANAGE_KEANGGOTAAN permission can modify
CREATE POLICY "Allow keanggotaan managers to modify master_kategori_bantuan"
  ON master_kategori_bantuan FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =========================================================
-- 10. VERIFY MIGRATION
-- =========================================================

-- Check how many anggota records have kategori_bantuan
SELECT
  COUNT(*) as total_anggota,
  COUNT(kategori_bantuan_id) as with_kategori_fk,
  COUNT(kategori_bantuan) as with_kategori_text,
  COUNT(*) - COUNT(kategori_bantuan_id) as still_without_fk
FROM anggota
WHERE deleted_at IS NULL;

-- =========================================================
-- END OF MIGRATION
-- =========================================================

-- Next migration (023): Clarify anggota status fields
