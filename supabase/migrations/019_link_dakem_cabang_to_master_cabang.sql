-- ============================================
-- Phase 2: Link Dana Kematian Cabang to Master Cabang
-- ============================================
-- Adds FK constraint from dana_kematian.kode_cabang to master_cabang.kode_cabang
-- Migrates existing free-text cabang_asal_melapor data to proper FK reference
-- Keeps legacy field for historical accuracy

-- =========================================================
-- 1. ADD kode_cabang COLUMN TO dana_kematian
-- =========================================================

ALTER TABLE dana_kematian
  ADD COLUMN IF NOT EXISTS kode_cabang VARCHAR(20);

-- =========================================================
-- 2. CREATE INDEX FOR PERFORMANCE
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_dakem_kode_cabang
  ON dana_kematian(kode_cabang);

-- =========================================================
-- 3. MIGRATE EXISTING DATA
-- =========================================================
-- Migrate free-text cabang_asal_melapor to kode_cabang FK
-- Using fuzzy matching on nama_cabang

UPDATE dana_kematian d
SET kode_cabang = mc.kode_cabang
FROM master_cabang mc
WHERE d.cabang_asal_melapor = mc.nama_cabang
  AND d.kode_cabang IS NULL;

-- Try case-insensitive match for any remaining records
UPDATE dana_kematian d
SET kode_cabang = mc.kode_cabang
FROM master_cabang mc
WHERE LOWER(d.cabang_asal_melapor) = LOWER(mc.nama_cabang)
  AND d.kode_cabang IS NULL;

-- Try partial match (contains) for any remaining records
UPDATE dana_kematian d
SET kode_cabang = mc.kode_cabang
FROM master_cabang mc
WHERE d.cabang_asal_melapor LIKE '%' || mc.nama_cabang || '%'
  OR mc.nama_cabang LIKE '%' || d.cabang_asal_melapor || '%'
  AND d.kode_cabang IS NULL;

-- =========================================================
-- 4. ADD FOREIGN KEY CONSTRAINT
-- =========================================================

ALTER TABLE dana_kematian
  ADD CONSTRAINT fk_dakem_kode_cabang
  FOREIGN KEY (kode_cabang)
  REFERENCES master_cabang(kode_cabang)
  ON DELETE SET NULL;

-- =========================================================
-- 5. UPDATE COMMENTS
-- =========================================================

COMMENT ON COLUMN dana_kematian.kode_cabang IS
  'Foreign key reference to master_cabang. Indicates the cabang where the death claim was first reported.';

COMMENT ON COLUMN dana_kematian.cabang_asal_melapor IS
  'Legacy text field kept for historical accuracy. '
  'For new records, use kode_cabang FK instead. '
  'This field preserves the original cabang name as it was entered at the time of reporting.';

-- =========================================================
-- 6. CREATE OR REPLACE VIEW FOR ACTIVE DAKEM WITH CABANG INFO
-- =========================================================

-- Drop view if exists (from previous migrations)
DROP VIEW IF EXISTS dana_kematian_with_cabang;

CREATE OR REPLACE VIEW dana_kematian_with_cabang AS
SELECT
  dakem.*,
  mc.nama_cabang,
  mc.kelas_cabang,
  mc.area_regional,
  mc.area_witel
FROM dana_kematian dakem
LEFT JOIN master_cabang mc ON dakem.kode_cabang = mc.kode_cabang
WHERE dakem.deleted_at IS NULL;

COMMENT ON VIEW dana_kematian_with_cabang IS
  'View of active dana_kematian records joined with master_cabang information. '
  'Provides denormalized cabang data for reporting and UI display.';

-- =========================================================
-- 7. VERIFY MIGRATION
-- =========================================================

-- This query shows how many records were successfully migrated
SELECT
  COUNT(*) as total_dakem_records,
  COUNT(kode_cabang) as migrated_to_fk,
  COUNT(*) - COUNT(kode_cabang) as still_without_cabang_fk,
  ROUND(100.0 * COUNT(kode_cabang) / COUNT(*), 2) as migration_percentage
FROM dana_kematian
WHERE deleted_at IS NULL;

-- Records that could not be migrated (for manual review)
-- Uncomment if needed for troubleshooting:
-- SELECT id, cabang_asal_melapor
-- FROM dana_kematian
-- WHERE kode_cabang IS NULL
--   AND deleted_at IS NULL
--   AND cabang_asal_melapor IS NOT NULL
-- LIMIT 20;

-- =========================================================
-- END OF MIGRATION
-- =========================================================

-- Note: Records without kode_cabang FK should be reviewed manually
-- Options:
-- 1. Add missing cabang to master_cabang table
-- 2. Update record with appropriate kode_cabang
-- 3. Accept NULL if cabang no longer exists

-- Next migration (020): Create Master Tarif Dana Kematian table
