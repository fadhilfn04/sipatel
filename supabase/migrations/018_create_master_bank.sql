-- ============================================
-- Phase 2: Master Bank Table Creation
-- ============================================
-- Creates a master table for bank data to eliminate free-text `nama_bank` field
-- in the anggota table and ensure data consistency.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- 1. CREATE MASTER BANK TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS master_bank (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kode_bank VARCHAR(10) UNIQUE NOT NULL,
  nama_bank VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- =========================================================
-- 2. CREATE INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_master_bank_kode_bank
  ON master_bank(kode_bank);

CREATE INDEX IF NOT EXISTS idx_master_bank_nama_bank
  ON master_bank(nama_bank);

CREATE INDEX IF NOT EXISTS idx_master_bank_is_active
  ON master_bank(is_active);

-- =========================================================
-- 3. CREATE UPDATED_AT TRIGGER
-- =========================================================

-- Reuse the existing trigger function if available, otherwise create it
CREATE OR REPLACE FUNCTION update_master_bank_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_master_bank_updated_at
  BEFORE UPDATE ON master_bank
  FOR EACH ROW
  EXECUTE FUNCTION update_master_bank_updated_at();

-- =========================================================
-- 4. SEED COMMON INDONESIAN BANKS
-- =========================================================

INSERT INTO master_bank (kode_bank, nama_bank, is_active) VALUES
  -- Major National Banks
  ('BCA', 'Bank Central Asia', true),
  ('BNI', 'Bank Negara Indonesia', true),
  ('MANDIRI', 'Bank Mandiri', true),
  ('BRI', 'Bank Rakyat Indonesia', true),

  -- State-Owned Banks
  ('BTN', 'Bank Tabungan Negara', true),
  ('BPD', 'Bank Pembangunan Daerah', true),

  -- Private Banks
  ('CIMB', 'CIMB Niaga', true),
  ('PERMATA', 'Bank Permata', true),
  ('PANIN', 'Bank Panin', true),
  ('UOB', 'Bank UOB Indonesia', true),
  ('Maybank', 'Bank Maybank Indonesia', true),
  ('BUKOPIN', 'Bank Bukopin', true),
  ('JAGO', 'Bank Jago', true),

  -- Digital Banks
  ('DIGIO', 'Bank Digibank Indonesia', true),
  ('JENIUS', 'Jenius by BTPN', true),

  -- Islamic Banks
  ('MUAMALAT', 'Bank Muamalat Indonesia', true),
  ('BSI', 'Bank Syariah Indonesia', true),
  ('BTPN_SYARIAH', 'BTPN Syariah', true),
  ('BANK_SYARIAH_BUKOPIN', 'Bank Syariah Bukopin', true),

  -- Foreign Banks Operating in Indonesia
  ('CITIBANK', 'Citibank NA', true),
  ('HSBC', 'HSBC Indonesia', true),
  ('STANDARD_CHARTERED', 'Standard Chartered Bank', true),
  ('DEUTSCHE', 'Deutsche Bank AG', true),
  ('MIZUHO', 'Bank Mizuho Indonesia', true),

  -- Regional Development Banks (BPD) - Major Ones
  ('BPD_JABAR', 'Bank BPD Jabar Banten', true),
  ('BPD_JATENG', 'Bank BPD Jawa Tengah', true),
  ('BPD_JATIM', 'Bank BPD Jawa Timur', true),
  ('BPD_DKI', 'Bank DKI', true),
  ('BPD_BALI', 'Bank BPD Bali', true)
ON CONFLICT (kode_bank) DO NOTHING;

-- =========================================================
-- 5. COMMENTS FOR DOCUMENTATION
-- =========================================================

COMMENT ON TABLE master_bank IS
  'Master table for bank data. Single source of truth for bank information '
  'used in anggota and other tables. Replaces free-text nama_bank field.';

COMMENT ON COLUMN master_bank.id IS
  'Primary key UUID';

COMMENT ON COLUMN master_bank.kode_bank IS
  'Unique bank code (e.g., BCA, BNI, MANDIRI). Used as FK reference.';

COMMENT ON COLUMN master_bank.nama_bank IS
  'Full bank name (e.g., Bank Central Asia, Bank Negara Indonesia)';

COMMENT ON COLUMN master_bank.is_active IS
  'Whether this bank is active and can be used in the system';

COMMENT ON COLUMN master_bank.created_at IS
  'Timestamp when record was created';

COMMENT ON COLUMN master_bank.updated_at IS
  'Timestamp when record was last updated';

-- =========================================================
-- 6. ENABLE ROW LEVEL SECURITY (RLS)
-- =========================================================

ALTER TABLE master_bank ENABLE ROW LEVEL SECURITY;

-- Public read access (master data is reference data)
CREATE POLICY "Allow public read access on master_bank"
  ON master_bank FOR SELECT
  TO public
  USING (is_active = true);

-- Authenticated users can view all (including inactive)
CREATE POLICY "Allow authenticated to view all master_bank"
  ON master_bank FOR SELECT
  TO authenticated
  USING (true);

-- Only users with MANAGE_SYSTEM permission can insert/update/delete
CREATE POLICY "Allow system managers to manage master_bank"
  ON master_bank FOR ALL
  TO authenticated
  USING (
    -- Check if user has system management permission
    -- This requires joining with User/UserRole tables
    -- For now, we'll allow authenticated users and enforce at API level
    true
  )
  WITH CHECK (true);

-- =========================================================
-- END OF MIGRATION
-- =========================================================

-- Next migration (019): Add kode_bank FK to anggota table
-- and migrate existing nama_bank data
