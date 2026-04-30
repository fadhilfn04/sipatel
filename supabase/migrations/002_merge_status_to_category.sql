-- Migration: Merge status_anggota into kategori_anggota to reduce redundancy
-- This migration consolidates status information into the category field
-- while maintaining backward compatibility

-- Step 1: Add new enum values to kategori_anggota_enum
-- Note: PostgreSQL doesn't support adding enum values in transactions with rollback
-- so we need to do this carefully

-- Add new category values (these match the current status_anggota values)
ALTER TYPE kategori_anggota_enum ADD VALUE 'pegawai' IF NOT EXISTS;
ALTER TYPE kategori_anggota_enum ADD VALUE 'istri' IF NOT EXISTS;
ALTER TYPE kategori_anggota_enum ADD VALUE 'suami' IF NOT EXISTS;
ALTER TYPE kategori_anggota_enum ADD VALUE 'anak' IF NOT EXISTS;

-- Step 2: Create a backup of the original data before migration
CREATE TABLE IF NOT EXISTS anggota_backup_002 AS
SELECT * FROM anggota;

-- Step 3: Migrate data from status_anggota to kategori_anggota
-- For records with kategori_anggota = 'biasa', we can use the status_anggota value
UPDATE anggota
SET kategori_anggota = status_anggota::text::kategori_anggota_enum
WHERE kategori_anggota = 'biasa'
  AND status_anggota IN ('pegawai', 'istri', 'suami', 'anak');

-- Step 4: Mark status_anggota as deprecated but keep it for backward compatibility
COMMENT ON COLUMN anggota.status_anggota IS 'DEPRECATED: Use kategori_anggota instead. This field is kept for backward compatibility and will be removed in future versions.';

-- Step 5: Create a function to maintain backward compatibility
CREATE OR REPLACE FUNCTION get_kategori_with_status(anggota_record anggota)
RETURNS kategori_anggota_enum AS $$
DECLARE
  result kategori_anggota_enum;
BEGIN
  -- If kategori_anggota is already one of the new values, use it
  IF anggota_record.kategori_anggota IN ('pegawai', 'istri', 'suami', 'anak') THEN
    result := anggota_record.kategori_anggota;
  -- Otherwise, check if we should use status_anggota
  ELSIF anggota_record.status_anggota IN ('pegawai', 'istri', 'suami', 'anak') THEN
    result := anggota_record.status_anggota::text::kategori_anggota_enum;
  -- Default to original kategori_anggota
  ELSE
    result := anggota_record.kategori_anggota;
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create an index to support queries on the combined field
CREATE INDEX IF NOT EXISTS idx_anggota_kategori_status_combined
ON anggota(
  CASE
    WHEN kategori_anggota IN ('pegawai', 'istri', 'suami', 'anak') THEN kategori_anggota
    WHEN status_anggota IN ('pegawai', 'istri', 'suami', 'anak') THEN status_anggota::text::kategori_anggota_enum
    ELSE kategori_anggota
  END
);

-- Step 7: Add a comment explaining the migration
COMMENT ON TABLE anggota IS '
Anggota (members) table - MIGRATION NOTES:
- Migration 002: Merged status_anggota into kategori_anggota to reduce redundancy
- Use kategori_anggota for all new code
- status_anggota field is deprecated but maintained for backward compatibility
- Use get_kategori_with_status() function for unified access to category information
';