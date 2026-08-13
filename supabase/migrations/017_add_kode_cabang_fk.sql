-- =====================================================
-- MIGRATION 017: Add FK from anggota.kode_cabang to master_cabang
-- =====================================================
-- The audit found that anggota.kode_cabang is a free VARCHAR with no
-- database-level referential integrity to master_cabang.kode_cabang.
--
-- This migration adds the FK constraint, but ONLY if all existing
-- anggota.kode_cabang values are valid (exist in master_cabang).
--
-- If invalid data is found, the migration RAISES an EXCEPTION and
-- aborts WITHOUT modifying any data. The administrator must clean up
-- the invalid references before re-running this migration.
--
-- The diagnostic query at the bottom shows any invalid records.
-- =====================================================

-- ── SAFETY CHECK: Verify no orphaned kode_cabang references exist ──
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO invalid_count
  FROM anggota a
  LEFT JOIN master_cabang mc ON a.kode_cabang = mc.kode_cabang
  WHERE a.kode_cabang IS NOT NULL
    AND a.deleted_at IS NULL
    AND mc.kode_cabang IS NULL;

  IF invalid_count > 0 THEN
    RAISE EXCEPTION '
      ┌──────────────────────────────────────────────────────────────┐
      │ CANNOT ADD FK: Found % orphaned kode_cabang references       │
      │ in anggota that do not exist in master_cabang.               │
      │                                                              │
      │ Run this diagnostic query to see the invalid records:        │
      │                                                              │
      │   SELECT a.id, a.nik, a.nama_anggota, a.kode_cabang          │
      │   FROM anggota a                                             │
      │   LEFT JOIN master_cabang mc ON a.kode_cabang = mc.kode_cabang │
      │   WHERE a.kode_cabang IS NOT NULL                            │
      │     AND a.kode_cabang != ''''                                  │
      │     AND a.deleted_at IS NULL                                  │
      │     AND mc.kode_cabang IS NULL;                              │
      │                                                              │
      │ Fix the invalid kode_cabang values (either update the        │
      │ anggota record or create the missing master_cabang entry),   │
      │ then re-run this migration.                                  │
      └──────────────────────────────────────────────────────────────┘
    ', invalid_count;
  END IF;
END $$;

-- ── If we reach here, all kode_cabang references are valid ──

-- Add the foreign key constraint
ALTER TABLE anggota
  ADD CONSTRAINT fk_anggota_kode_cabang
  FOREIGN KEY (kode_cabang) REFERENCES master_cabang(kode_cabang)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_anggota_kode_cabang ON anggota IS
  'Foreign key from anggota.kode_cabang to master_cabang.kode_cabang. Added by migration 017.';

-- ── DIAGNOSTIC QUERY (run manually to verify, commented out for production) ──
-- SELECT
--   a.id, a.nik, a.nama_anggota, a.kode_cabang,
--   mc.kode_cabang AS master_exists
-- FROM anggota a
-- LEFT JOIN master_cabang mc ON a.kode_cabang = mc.kode_cabang
-- WHERE a.kode_cabang IS NOT NULL
--   AND a.kode_cabang != ''
--   AND a.deleted_at IS NULL
--   AND mc.kode_cabang IS NULL;