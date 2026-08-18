-- ============================================
-- Phase 2: Add Audit Trail to Master Tables
-- ============================================
-- Adds created_by and updated_by fields to master tables
-- References auth.users (Supabase) for consistency with authentication

-- =========================================================
-- 1. ADD AUDIT COLUMNS TO master_cabang
-- =========================================================

ALTER TABLE master_cabang
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN master_cabang.created_by IS
  'UUID of user who created this record (references auth.users)';

COMMENT ON COLUMN master_cabang.updated_by IS
  'UUID of user who last updated this record (references auth.users)';

-- =========================================================
-- 2. ADD AUDIT COLUMNS TO nik_kepemilikan
-- =========================================================

ALTER TABLE nik_kepemilikan
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN nik_kepemilikan.created_by IS
  'UUID of user who created this NIK ownership record (references auth.users)';

COMMENT ON COLUMN nik_kepemilikan.updated_by IS
  'UUID of user who last updated this NIK ownership record (references auth.users)';

-- =========================================================
-- 3. ADD AUDIT COLUMNS TO master_bank
-- =========================================================

ALTER TABLE master_bank
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN master_bank.created_by IS
  'UUID of user who created this bank record (references auth.users)';

COMMENT ON COLUMN master_bank.updated_by IS
  'UUID of user who last updated this bank record (references auth.users)';

-- =========================================================
-- 4. ADD AUDIT COLUMNS TO NEW MASTER TABLES
-- =========================================================
-- These tables will be created in subsequent migrations:
-- - master_tarif_dana_kematian (020)
-- - master_kategori_bantuan (022)
-- - master_regional (024)
-- - master_witel (024)

-- =========================================================
-- 5. CREATE UPDATED_BY TRIGGER FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION update_audit_updated_by()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the current user from the session
  -- Note: This requires the request to set the local variable
  NEW.updated_by = COALESCE(
    current_setting('request.user.id', true)::UUID,
    NEW.updated_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 6. APPLY TRIGGERS TO TABLES
-- =========================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trg_audit_master_cabang_updated_by ON master_cabang;
DROP TRIGGER IF EXISTS trg_audit_nik_kepemilikan_updated_by ON nik_kepemilikan;
DROP TRIGGER IF EXISTS trg_audit_master_bank_updated_by ON master_bank;

-- Create triggers for master_cabang
CREATE TRIGGER trg_audit_master_cabang_updated_by
  BEFORE UPDATE ON master_cabang
  FOR EACH ROW
  EXECUTE FUNCTION update_audit_updated_by();

-- Create triggers for nik_kepemilikan
CREATE TRIGGER trg_audit_nik_kepemilikan_updated_by
  BEFORE UPDATE ON nik_kepemilikan
  FOR EACH ROW
  EXECUTE FUNCTION update_audit_updated_by();

-- Create triggers for master_bank
CREATE TRIGGER trg_audit_master_bank_updated_by
  BEFORE UPDATE ON master_bank
  FOR EACH ROW
  EXECUTE FUNCTION update_audit_updated_by();

-- =========================================================
-- 7. CREATE HELPER VIEW FOR AUDIT LOGS
-- =========================================================

CREATE OR REPLACE VIEW master_cabang_with_audit AS
SELECT
  mc.*,
  creator.email AS created_by_email,
  creator.raw_user_meta_data->>'name' AS created_by_name,
  updater.email AS updated_by_email,
  updater.raw_user_meta_data->>'name' AS updated_by_name
FROM master_cabang mc
LEFT JOIN auth.users creator ON mc.created_by = creator.id
LEFT JOIN auth.users updater ON mc.updated_by = updater.id;

COMMENT ON VIEW master_cabang_with_audit IS
  'View of master_cabang with user information for audit trails';

CREATE OR REPLACE VIEW nik_kepemilikan_with_audit AS
SELECT
  nk.*,
  creator.email AS created_by_email,
  creator.raw_user_meta_data->>'name' AS created_by_name,
  updater.email AS updated_by_email,
  updater.raw_user_meta_data->>'name' AS updated_by_name
FROM nik_kepemilikan nk
LEFT JOIN auth.users creator ON nk.created_by = creator.id
LEFT JOIN auth.users updater ON nk.updated_by = updater.id;

COMMENT ON VIEW nik_kepemilikan_with_audit IS
  'View of nik_kepemilikan with user information for audit trails';

-- =========================================================
-- 8. MIGRATE EXISTING RECORDS
-- =========================================================
-- For existing records, we'll set created_by and updated_by to NULL
-- This indicates they were created before audit tracking was implemented

-- Optionally, you could update them to a system user ID if you have one

-- =========================================================
-- 9. CREATE INDEX FOR AUDIT QUERIES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_master_cabang_created_by
  ON master_cabang(created_by);

CREATE INDEX IF NOT EXISTS idx_master_cabang_updated_by
  ON master_cabang(updated_by);

CREATE INDEX IF NOT EXISTS idx_nik_kepemilikan_created_by
  ON nik_kepemilikan(created_by);

CREATE INDEX IF NOT EXISTS idx_nik_kepemilikan_updated_by
  ON nik_kepemilikan(updated_by);

CREATE INDEX IF NOT EXISTS idx_master_bank_created_by
  ON master_bank(created_by);

CREATE INDEX IF NOT EXISTS idx_master_bank_updated_by
  ON master_bank(updated_by);

-- =========================================================
-- 10. AUDIT POLICY FOR auth.users ACCESS
-- =========================================================

-- Grant necessary permissions on auth.users for the views
-- Note: auth.users typically has RLS enabled

-- =========================================================
-- END OF MIGRATION
-- =========================================================

-- Notes for API Implementation:
-- 1. When inserting records, extract user.id from session and set created_by
-- 2. When updating records, set the local variable: SET LOCAL request.user.id = '<user_uuid>';
-- 3. Use the audit views (*_with_audit) for displaying audit information

-- Next migration (022): Create Master Kategori Bantuan table
