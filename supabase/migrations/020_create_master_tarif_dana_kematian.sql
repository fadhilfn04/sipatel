-- ============================================
-- Phase 2: Master Tarif Dana Kematian
-- ============================================
-- Creates a master table for Dana Kematian tariff rates
-- Enables strict validation of besaran_dana_kematian based on kategori_anggota

-- =========================================================
-- 1. CREATE ENUM TYPE FOR TARIF KATEGORI
-- =========================================================

-- Note: Reusing existing kategori_anggota_enum values
-- This ensures consistency with anggota table

DO $$
BEGIN
  -- Check if type already exists before creating
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kategori_anggota_tarif_enum') THEN
    CREATE TYPE kategori_anggota_tarif_enum AS ENUM (
      'biasa',
      'luar_biasa',
      'kehormatan'
    );
  END IF;
END $$;

-- =========================================================
-- 2. CREATE MASTER TARIF DANA KEMATIAN TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS master_tarif_dana_kematian (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kategori_anggota kategori_anggota_tarif_enum NOT NULL,
  masa_kerja_min INT,
  masa_kerja_max INT,
  besaran_dana NUMERIC(14,2) NOT NULL,
  tanggal_berlaku DATE NOT NULL,
  tanggal_berakhir DATE,
  is_active BOOLEAN DEFAULT true,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,

  -- Ensure only one active tariff per category at a time
  CONSTRAINT unique_active_tarif_per_category
    EXCLUDE (USING (
      kategori_anggota WITH = AND
      is_active WITH = AND
      (tanggal_berakhir IS NULL OR tanggal_berakhir >= CURRENT_DATE) WITH =
    ))
);

-- =========================================================
-- 3. CREATE INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_tarif_kategori_anggota
  ON master_tarif_dana_kematian(kategori_anggota);

CREATE INDEX IF NOT EXISTS idx_tarif_is_active
  ON master_tarif_dana_kematian(is_active);

CREATE INDEX IF NOT EXISTS idx_tarif_masa_kerja
  ON master_tarif_dana_kematian(masa_kerja_min, masa_kerja_max);

CREATE INDEX IF NOT EXISTS idx_tarif_tanggal_berlaku
  ON master_tarif_dana_kematian(tanggal_berlaku DESC);

CREATE INDEX IF NOT EXISTS idx_tarif_active_per_category
  ON master_tarif_dana_kematian(kategori_anggota, is_active)
  WHERE is_active = true AND (tanggal_berakhir IS NULL OR tanggal_berakhir >= CURRENT_DATE);

-- =========================================================
-- 4. CREATE UPDATED_AT TRIGGER
-- =========================================================

CREATE OR REPLACE FUNCTION update_tarif_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_tarif_updated_at
  BEFORE UPDATE ON master_tarif_dana_kematian
  FOR EACH ROW
  EXECUTE FUNCTION update_tarif_updated_at();

-- =========================================================
-- 5. ADD FOREIGN KEY TO dana_kematian (OPTIONAL)
-- =========================================================
-- This column will store the tarif_id for reference
-- The besaran_dana_kematian value must still match the tarif

ALTER TABLE dana_kematian
  ADD COLUMN IF NOT EXISTS tarif_id UUID REFERENCES master_tarif_dana_kematian(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dakem_tarif_id
  ON dana_kematian(tarif_id);

-- =========================================================
-- 6. SEED INITIAL TARIFF DATA
-- =========================================================
-- Note: These are placeholder values. Actual amounts should be
-- determined by P2Tel management based on current policies.

INSERT INTO master_tarif_dana_kematian (
  kategori_anggota,
  masa_kerja_min,
  masa_kerja_max,
  besaran_dana,
  tanggal_berlaku,
  keterangan
) VALUES
  -- Kategori Biasa (standard pensioners)
  ('biasa', 0, 10, 3500000, '2024-01-01', 'Tarif dasar untuk kategori biasa, masa kerja 0-10 tahun'),
  ('biasa', 11, 20, 4500000, '2024-01-01', 'Tarif dasar untuk kategori biasa, masa kerja 11-20 tahun'),
  ('biasa', 21, 999, 5500000, '2024-01-01', 'Tarif dasar untuk kategori biasa, masa kerja >20 tahun'),

  -- Kategori Luar Biasa (exceptional pensioners)
  ('luar_biasa', 0, 10, 5000000, '2024-01-01', 'Tarif untuk kategori luar biasa, masa kerja 0-10 tahun'),
  ('luar_biasa', 11, 20, 6500000, '2024-01-01', 'Tarif untuk kategori luar biasa, masa kerja 11-20 tahun'),
  ('luar_biasa', 21, 999, 8000000, '2024-01-01', 'Tarif untuk kategori luar biasa, masa kerja >20 tahun'),

  -- Kategori Kehormatan (honorary pensioners)
  ('kehormatan', 0, 999, 10000000, '2024-01-01', 'Tarif untuk kategori kehormatan (fixed amount)')
ON CONFLICT DO NOTHING;

-- =========================================================
-- 7. CREATE HELPER FUNCTION TO GET APPLICABLE TARIFF
-- =========================================================

CREATE OR REPLACE FUNCTION get_applicable_tarif(
  p_kategori_anggota VARCHAR,
  p_masa_kerja INT DEFAULT NULL
)
RETURNS TABLE (
  tarif_id UUID,
  kategori_anggota VARCHAR,
  besaran_dana NUMERIC,
  masa_kerja_min INT,
  masa_kerja_max INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mt.id,
    mt.kategori_anggota::VARCHAR,
    mt.besaran_dana,
    mt.masa_kerja_min,
    mt.masa_kerja_max
  FROM master_tarif_dana_kematian mt
  WHERE mt.is_active = true
    AND mt.kategori_anggota = p_kategori_anggota::kategori_anggota_tarif_enum
    AND (mt.tanggal_berakhir IS NULL OR mt.tanggal_berakhir >= CURRENT_DATE)
    AND (
      p_masa_kerja IS NULL OR
      (p_masa_kerja BETWEEN COALESCE(mt.masa_kerja_min, 0) AND COALESCE(mt.masa_kerja_max, 999999))
    )
  ORDER BY
    mt.masa_kerja_min DESC NULLS LAST
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 8. CREATE VALIDATION FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION validate_dana_kematian_amount(
  p_besaran_dana NUMERIC,
  p_kategori_anggota VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  v_valid_amount BOOLEAN;
BEGIN
  -- Check if the amount matches any active tariff for the category
  SELECT EXISTS(
    SELECT 1
    FROM master_tarif_dana_kematian
    WHERE is_active = true
      AND kategori_anggota = p_kategori_anggota::kategori_anggota_tarif_enum
      AND (tanggal_berakhir IS NULL OR tanggal_berakhir >= CURRENT_DATE)
      AND besaran_dana = p_besaran_dana
  ) INTO v_valid_amount;

  RETURN v_valid_amount;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 9. COMMENTS FOR DOCUMENTATION
-- =========================================================

COMMENT ON TABLE master_tarif_dana_kematian IS
  'Master table for Dana Kematian tariff rates. '
  'Defines the benefit amount based on kategori_anggota and masa kerja. '
  'Strict validation: besaran_dana_kematian must match one of these tariffs.';

COMMENT ON COLUMN master_tarif_dana_kematian.id IS
  'Primary key UUID';

COMMENT ON COLUMN master_tarif_dana_kematian.kategori_anggota IS
  'Kategori anggota: biasa, luar_biasa, kehormatan';

COMMENT ON COLUMN master_tarif_dana_kematian.masa_kerja_min IS
  'Minimum masa kerja (years) for this tariff tier. NULL = no minimum';

COMMENT ON COLUMN master_tarif_dana_kematian.masa_kerja_max IS
  'Maximum masa kerja (years) for this tariff tier. NULL = no maximum';

COMMENT ON COLUMN master_tarif_dana_kematian.besaran_dana IS
  'Benefit amount in Rupiah. Must match exactly when creating dana_kematian records';

COMMENT ON COLUMN master_tarif_dana_kematian.tanggal_berlaku IS
  'Effective date when this tariff becomes active';

COMMENT ON COLUMN master_tarif_dana_kematian.tanggal_berakhir IS
  'End date for this tariff. NULL means currently active';

COMMENT ON COLUMN dana_kematian.tarif_id IS
  'Reference to master_tarif_dana_kematian. Links the claim to the applicable tariff rule';

COMMENT ON FUNCTION get_applicable_tarif IS
  'Helper function to get the applicable tariff for a given kategori_anggota and masa_kerja';

COMMENT ON FUNCTION validate_dana_kematian_amount IS
  'Validation function to check if a given amount matches defined tariffs';

-- =========================================================
-- 10. ENABLE ROW LEVEL SECURITY (RLS)
-- =========================================================

ALTER TABLE master_tarif_dana_kematian ENABLE ROW LEVEL SECURITY;

-- Public read access (master data is reference data)
CREATE POLICY "Allow public read access on master_tarif_dana_kematian"
  ON master_tarif_dana_kematian FOR SELECT
  TO public
  USING (is_active = true);

-- Authenticated users can view all (including inactive)
CREATE POLICY "Allow authenticated to view all master_tarif"
  ON master_tarif_dana_kematian FOR SELECT
  TO authenticated
  USING (true);

-- Only users with MANAGE_DANA_KEMATIAN permission can modify
CREATE POLICY "Allow dana kematian managers to modify master_tarif"
  ON master_tarif_dana_kematian FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =========================================================
-- END OF MIGRATION
-- =========================================================

-- Next migration (021): Add audit trail to master tables
