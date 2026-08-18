-- ============================================
-- Phase 2: Clarify Anggota Status Fields
-- ============================================
-- Adds comprehensive comments to clarify the distinction between
-- status_anggota and kategori_anggota fields
-- These fields have overlapping names but serve different purposes

-- =========================================================
-- 1. UPDATE COLUMN COMMENTS FOR anggota TABLE
-- =========================================================

-- Drop existing comments if any
COMMENT ON COLUMN anggota.status_anggota IS NULL;
COMMENT ON COLUMN anggota.kategori_anggota IS NULL;
COMMENT ON COLUMN anggota.status_mps IS NULL;
COMMENT ON COLUMN anggota.status_iuran IS NULL;

-- Add clarified comments

COMMENT ON COLUMN anggota.status_anggota IS
  'STATUS KELUARGA: Peran anggota dalam struktur keluarga pensiunan. '
  'Values: pegawai (pensiunan utama), istri, suami, anak, meninggal. '
  'Indicates the family role in the pensioner household. '
  'When changed to "meninggal", the NIK can be inherited by eligible heirs. '
  'This is about FAMILY STATUS, not membership tier.';

COMMENT ON COLUMN anggota.kategori_anggota IS
  'KATEGORI KEANGGOTAAN: Tingkat keanggotaan berdasarkan jenis pensiun/jasa. '
  'Values: biasa (pensiunan biasa), luar_biasa (pensiunan luar biasa), kehormatan (pensiunan kehormatan). '
  'Indicates membership tier based on service/contribution to P2Tel. '
  'BUSINESS RULE: When kategori_anggota = "biasa", status_mps must be "mps". '
  'This is about MEMBERSHIP TIER, not family status.';

COMMENT ON COLUMN anggota.status_mps IS
  'STATUS MPS: Manfaat Pensiun Sekaligus - indicates whether member receives '
  'full pension benefits simultaneously. '
  'Values: mps (receives full benefits), non_mps (benefits are split/shared). '
  'BUSINESS RULE: Kategori anggota "biasa" automatically gets status_mps = "mps". '
  'This field is automatically set by the system based on kategori_anggota.';

COMMENT ON COLUMN anggota.status_iuran IS
  'STATUS IURAN: Status pembayaran iuran keanggotaan. '
  'Values: iuran (aktif membayar iuran), tidak_iuran (tidak membayar/iuran dibebaskan). '
  'Indicates whether the member is actively paying membership dues. '
  'May be affected by BPJS status, age, or other factors.';

-- =========================================================
-- 2. ADD TABLE-LEVEL COMMENT
-- =========================================================

COMMENT ON TABLE anggota IS
  'Tabel data anggota pensiunan P2Tel. '
  'STATUS FIELDS: '
  '  - status_anggota: FAMILY ROLE (pegawai/istri/suami/anak/meninggal) '
  '  - kategori_anggota: MEMBERSHIP TIER (biasa/luar_biasa/kehormatan) '
  '  - status_mps: PENSION BENEFIT TYPE (mps/non_mps) '
  '  - status_iuran: DUES PAYMENT STATUS (iuran/tidak_iuran) '
  '  - status_kepesertaan: Additional membership status field (varchar)';

-- =========================================================
-- 3. CREATE DOCUMENTATION VIEW
-- =========================================================

CREATE OR REPLACE VIEW anggota_status_documentation AS
SELECT
  'status_anggota' AS field_name,
  'Family Role' AS category,
  'pegawai, istri, suami, anak, meninggal' AS possible_values,
  'Indicates family role in pensioner household. "meninggal" allows NIK inheritance.' AS description
UNION ALL
SELECT
  'kategori_anggota',
  'Membership Tier',
  'biasa, luar_biasa, kehormatan',
  'Indicates membership tier based on service. "biasa" → status_mps must be "mps".'
UNION ALL
SELECT
  'status_mps',
  'Benefit Type',
  'mps, non_mps',
  'Manfaat Pensiun Sekaligus. Auto-set: kategori=biasa → status_mps=mps.'
UNION ALL
SELECT
  'status_iuran',
  'Dues Status',
  'iuran, tidak_iuran',
  'Status of membership dues payment. Active paying vs exempted.'
UNION ALL
SELECT
  'status_kepesertaan',
  'Additional Status',
  'Free text',
  'Additional membership status information (varchar).';

COMMENT ON VIEW anggota_status_documentation IS
  'Documentation view explaining the difference between various status fields in anggota table';

-- =========================================================
-- 4. CREATE VALIDATION FUNCTION FOR MPS RULE
-- =========================================================

CREATE OR REPLACE FUNCTION validate_mps_rule(
  p_kategori_anggota VARCHAR,
  p_status_mps VARCHAR
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Business rule: Kategori Biasa → Status MPS = MPS
  IF p_kategori_anggota = 'biasa' AND p_status_mps != 'mps' THEN
    RETURN FALSE;
  END IF;

  -- If kategori is not biasa, status_mps can be anything
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_mps_rule IS
  'Validates the MPS business rule: kategori_anggota=biasa requires status_mps=mps';

-- =========================================================
-- 5. ADD CHECK CONSTRAINT (OPTIONAL - ENFORCED IN API)
-- =========================================================
-- Note: We enforce this in the API layer, not database constraint
-- because we want to provide clear error messages to users

-- Uncomment to enforce at database level:
-- ALTER TABLE anggota
--   ADD CONSTRAINT chk_mps_business_rule
--   CHECK (
--     kategori_anggota != 'biasa' OR status_mps = 'mps'
--   );

-- =========================================================
-- 6. CREATE TRIGGER TO AUTO-SET STATUS_MPS (OPTIONAL)
-- =========================================================
-- This trigger automatically sets status_mps = 'mps' when kategori_anggota = 'biasa'
-- Can be enabled if you want database-level enforcement

-- Uncomment to enable:
-- CREATE OR REPLACE FUNCTION auto_set_mps_status()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   IF NEW.kategori_anggota = 'biasa' THEN
--     NEW.status_mps = 'mps';
--   END IF;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER trg_auto_set_mps_status
--   BEFORE INSERT OR UPDATE OF kategori_anggota ON anggota
--   FOR EACH ROW
--   EXECUTE FUNCTION auto_set_mps_status();

-- =========================================================
-- 7. BUSINESS RULE DOCUMENTATION
-- =========================================================

-- Create a documentation table for business rules
CREATE TABLE IF NOT EXISTS business_rule_documentation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_name VARCHAR(100) NOT NULL,
  rule_description TEXT NOT NULL,
  affected_table VARCHAR(100) NOT NULL,
  affected_columns TEXT[],
  enforcement_layer VARCHAR(20) NOT NULL, -- 'database', 'api', 'ui'
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

INSERT INTO business_rule_documentation (rule_name, rule_description, affected_table, affected_columns, enforcement_layer) VALUES
  ('MPS Business Rule', 'Kategori anggota "biasa" harus memiliki status_mps = "mps"', 'anggota', ARRAY['kategori_anggota', 'status_mps'], 'api'),
  ('Protected Fields', 'NIK, nama_anggota, kategori_anggota, status_anggota, status_mps, status_iuran tidak boleh diubah via API setelah dibuat', 'anggota', ARRAY['nik', 'nama_anggota', 'kategori_anggota', 'status_anggota', 'status_mps', 'status_iuran'], 'api'),
  ('NIK Inheritance', 'NIK dapat diwariskan hanya jika status_anggota = "meninggal" dan ahli waris adalah istri/suami/anak', 'anggota, nik_kepemilikan', ARRAY['status_anggota', 'hubungan'], 'api')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE business_rule_documentation IS
  'Documentation table for business rules enforced in the system';

-- =========================================================
-- END OF MIGRATION
-- =========================================================

-- Summary:
-- This migration clarifies the semantic difference between:
-- 1. status_anggota = FAMILY ROLE (who they are in the family)
-- 2. kategori_anggota = MEMBERSHIP TIER (what level of membership)
-- 3. status_mps = BENEFIT TYPE (how benefits are paid)
-- 4. status_iuran = DUES STATUS (paying status)
-- 5. status_kepesertaan = ADDITIONAL INFO (free text notes)

-- Next migration (024): Create Regional/Witel hierarchy tables
