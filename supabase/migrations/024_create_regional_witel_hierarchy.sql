-- ============================================
-- Phase 2: Create Regional/Witel Hierarchy Tables
-- ============================================
-- Normalizes area_regional and area_witel references
-- Creates proper master tables and FK relationships

-- =========================================================
-- 1. CREATE MASTER REGIONAL TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS master_regional (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kode_regional VARCHAR(10) UNIQUE NOT NULL,
  nama_regional VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =========================================================
-- 2. CREATE MASTER WITEL TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS master_witel (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kode_witel VARCHAR(10) UNIQUE NOT NULL,
  nama_witel VARCHAR(100) NOT NULL,
  regional_id UUID REFERENCES master_regional(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =========================================================
-- 3. CREATE INDEXES
-- =========================================================

-- Regional indexes
CREATE INDEX IF NOT EXISTS idx_master_regional_kode
  ON master_regional(kode_regional);

CREATE INDEX IF NOT EXISTS idx_master_regional_nama
  ON master_regional(nama_regional);

CREATE INDEX IF NOT EXISTS idx_master_regional_is_active
  ON master_regional(is_active);

-- Witel indexes
CREATE INDEX IF NOT EXISTS idx_master_witel_kode
  ON master_witel(kode_witel);

CREATE INDEX IF NOT EXISTS idx_master_witel_nama
  ON master_witel(nama_witel);

CREATE INDEX IF NOT EXISTS idx_master_witel_regional_id
  ON master_witel(regional_id);

CREATE INDEX IF NOT EXISTS idx_master_witel_is_active
  ON master_witel(is_active);

-- =========================================================
-- 4. CREATE TRIGGERS
-- =========================================================

-- Regional updated_at trigger
CREATE OR REPLACE FUNCTION update_regional_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_regional_updated_at
  BEFORE UPDATE ON master_regional
  FOR EACH ROW
  EXECUTE FUNCTION update_regional_updated_at();

CREATE TRIGGER trg_audit_regional_updated_by
  BEFORE UPDATE ON master_regional
  FOR EACH ROW
  EXECUTE FUNCTION update_audit_updated_by();

-- Witel updated_at trigger
CREATE OR REPLACE FUNCTION update_witel_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_witel_updated_at
  BEFORE UPDATE ON master_witel
  FOR EACH ROW
  EXECUTE FUNCTION update_witel_updated_at();

CREATE TRIGGER trg_audit_witel_updated_by
  BEFORE UPDATE ON master_witel
  FOR EACH ROW
  EXECUTE FUNCTION update_audit_updated_by();

-- =========================================================
-- 5. ADD FK COLUMNS TO master_cabang
-- =========================================================

ALTER TABLE master_cabang
  ADD COLUMN IF NOT EXISTS regional_id UUID REFERENCES master_regional(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS witel_id UUID REFERENCES master_witel(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_master_cabang_regional_id
  ON master_cabang(regional_id);

CREATE INDEX IF NOT EXISTS idx_master_cabang_witel_id
  ON master_cabang(witel_id);

-- =========================================================
-- 6. SEED COMMON REGIONAL DATA
-- =========================================================
-- Note: These are placeholder values. Actual regional data should be
-- populated based on P2Tel's organizational structure

INSERT INTO master_regional (kode_regional, nama_regional) VALUES
  -- Major regionals (placeholder structure)
  ('REG_JABAR', 'Regional Jawa Barat'),
  ('REG_JATENG', 'Regional Jawa Tengah'),
  ('REG_JATIM', 'Regional Jawa Timur'),
  ('REG_JAKARTA', 'Regional DKI Jakarta'),
  ('REG_BALI', 'Regional Bali'),
  ('REG_SUMUT', 'Regional Sumatera Utara'),
  ('REG_SUMBAR', 'Regional Sumatera Barat'),
  ('REG_SUMSEL', 'Regional Sumatera Selatan'),
  ('REG_KALBAR', 'Regional Kalimantan Barat'),
  ('REG_KALTENG', 'Regional Kalimantan Tengah'),
  ('REG_KALTIM', 'Regional Kalimantan Timur'),
  ('REG_SULSEL', 'Regional Sulawesi Selatan'),
  ('REG_SULUT', 'Regional Sulawesi Utara'),
  ('REG_PAPUA', 'Regional Papua')
ON CONFLICT (kode_regional) DO NOTHING;

-- =========================================================
-- 7. SEED COMMON WITEL DATA
-- =========================================================

INSERT INTO master_witel (kode_witel, nama_witel, regional_id) VALUES
  -- Jabar Witels
  ('WITEL_BANDUNG', 'Witel Bandung', (SELECT id FROM master_regional WHERE kode_regional = 'REG_JABAR')),
  ('WITEL_BOGOR', 'Witel Bogor', (SELECT id FROM master_regional WHERE kode_regional = 'REG_JABAR')),
  ('WITEL_BEKASI', 'Witel Bekasi', (SELECT id FROM master_regional WHERE kode_regional = 'REG_JABAR')),

  -- Jakarta Witels
  ('WITEL_JAKSEL', 'Witel Jakarta Selatan', (SELECT id FROM master_regional WHERE kode_regional = 'REG_JAKARTA')),
  ('WITEL_JAKUT', 'Witel Jakarta Timur', (SELECT id FROM master_regional WHERE kode_regional = 'REG_JAKARTA')),
  ('WITEL_JAKBAR', 'Witel Jakarta Barat', (SELECT id FROM master_regional WHERE kode_regional = 'REG_JAKARTA')),
  ('WITEL_JAKPUS', 'Witel Jakarta Pusat', (SELECT id FROM master_regional WHERE kode_regional = 'REG_JAKARTA')),

  -- Jateng Witels
  ('WITEL_SEMARANG', 'Witel Semarang', (SELECT id FROM master_regional WHERE kode_regional = 'REG_JATENG')),
  ('WITEL_SOLO', 'Witel Solo', (SELECT id FROM master_regional WHERE kode_regional = 'REG_JATENG')),
  ('WITEL_TEGAL', 'Witel Tegal', (SELECT id FROM master_regional WHERE kode_regional = 'REG_JATENG')),

  -- Jatim Witels
  ('WITEL_SURABAYA', 'Witel Surabaya', (SELECT id FROM master_regional WHERE kode_regional = 'REG_JATIM')),
  ('WITEL_MALANG', 'Witel Malang', (SELECT id FROM master_regional WHERE kode_regional = 'REG_JATIM')),
  ('WITEL_KEDIRI', 'Witel Kediri', (SELECT id FROM master_regional WHERE kode_regional = 'REG_JATIM')),

  -- Bali
  ('WITEL_DENPASAR', 'Witel Denpasar', (SELECT id FROM master_regional WHERE kode_regional = 'REG_BALI')),

  -- Sumut
  ('WITEL_MEDAN', 'Witel Medan', (SELECT id FROM master_regional WHERE kode_regional = 'REG_SUMUT')),
  ('WITEL_PEKANBARU', 'Witel Pekanbaru', (SELECT id FROM master_regional WHERE kode_regional = 'REG_SUMUT'))
ON CONFLICT (kode_witel) DO NOTHING;

-- =========================================================
-- 8. MIGRATE EXISTING master_cabang DATA
-- =========================================================

-- Try to match existing area_regional to master_regional
UPDATE master_cabang mc
SET regional_id = mr.id
FROM master_regional mr
WHERE mc.area_regional IS NOT NULL
  AND (
    mc.area_regional = mr.nama_regional OR
    LOWER(mc.area_regional) = LOWER(mr.nama_regional) OR
    mc.area_regional LIKE '%' || mr.nama_regional || '%'
  )
  AND mc.regional_id IS NULL;

-- Try to match existing area_witel to master_witel
UPDATE master_cabang mc
SET witel_id = mw.id
FROM master_witel mw
WHERE mc.area_witel IS NOT NULL
  AND (
    mc.area_witel = mw.nama_witel OR
    LOWER(mc.area_witel) = LOWER(mw.nama_witel) OR
    mc.area_witel LIKE '%' || mw.nama_witel || '%'
  )
  AND mc.witel_id IS NULL;

-- =========================================================
-- 9. UPDATE COMMENTS
-- =========================================================

COMMENT ON TABLE master_regional IS
  'Master table for Regional data. Represents area_regional in organizational hierarchy.';

COMMENT ON TABLE master_witel IS
  'Master table for Witel data. Represents area_witel in organizational hierarchy. '
  'Each witel belongs to a regional.';

COMMENT ON COLUMN master_cabang.regional_id IS
  'Foreign key reference to master_regional. Replaces free-text area_regional.';

COMMENT ON COLUMN master_cabang.witel_id IS
  'Foreign key reference to master_witel. Replaces free-text area_witel.';

COMMENT ON COLUMN master_cabang.area_regional IS
  'Legacy text field for historical accuracy. New records should use regional_id FK.';

COMMENT ON COLUMN master_cabang.area_witel IS
  'Legacy text field for historical accuracy. New records should use witel_id FK.';

-- =========================================================
-- 10. CREATE VIEWS FOR HIERARCHY
-- =========================================================

CREATE OR REPLACE VIEW master_cabang_with_witel_regional AS
SELECT
  mc.*,
  mr.kode_regional,
  mr.nama_regional,
  mw.kode_witel,
  mw.nama_witel
FROM master_cabang mc
LEFT JOIN master_regional mr ON mc.regional_id = mr.id
LEFT JOIN master_witel mw ON mc.witel_id = mw.id;

COMMENT ON VIEW master_cabang_with_witel_regional IS
  'View of master_cabang with joined regional and witel information';

-- =========================================================
-- 11. ENABLE ROW LEVEL SECURITY (RLS)
-- =========================================================

ALTER TABLE master_regional ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_witel ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Allow public read access on master_regional"
  ON master_regional FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Allow public read access on master_witel"
  ON master_witel FOR SELECT
  TO public
  USING (is_active = true);

-- Authenticated users can view all
CREATE POLICY "Allow authenticated to view all master_regional"
  ON master_regional FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated to view all master_witel"
  ON master_witel FOR SELECT
  TO authenticated
  USING (true);

-- System managers can modify
CREATE POLICY "Allow system managers to modify master_regional"
  ON master_regional FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow system managers to modify master_witel"
  ON master_witel FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =========================================================
-- 12. VERIFY MIGRATION
-- =========================================================

-- Check how many cabang have regional/witel assigned
SELECT
  COUNT(*) as total_cabang,
  COUNT(regional_id) as with_regional_fk,
  COUNT(area_regional) as with_regional_text,
  COUNT(witel_id) as with_witel_fk,
  COUNT(area_witel) as with_witel_text
FROM master_cabang;

-- =========================================================
-- END OF MIGRATION
-- =========================================================

-- Notes for anggota table:
-- The anggota table (cabang_area_regional, cabang_area_witel) remains
-- as denormalized cache fields. These are NOT migrated to FK because
-- they represent historical snapshots of what was correct at the time
-- the anggota was created/updated, not current organizational data.

-- Next migration (025): Create batch operation log table
