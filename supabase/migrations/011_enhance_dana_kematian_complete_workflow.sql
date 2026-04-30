-- =====================================================
-- ENHANCE DANA_KEMATIAN TABLE FOR COMPLETE WORKFLOW
-- Based on Business Process Document v2.0
-- =====================================================

-- =====================================================
-- ADD NEW FIELDS TO EXISTING dana_kematian TABLE
-- =====================================================

ALTER TABLE dana_kematian
-- Timeline fields (Waktu-0 to Waktu-7)
ADD COLUMN IF NOT EXISTS waktu_0 TIMESTAMP,
ADD COLUMN IF NOT EXISTS waktu_1 TIMESTAMP,
ADD COLUMN IF NOT EXISTS waktu_2 TIMESTAMP,
ADD COLUMN IF NOT EXISTS waktu_3 TIMESTAMP,
ADD COLUMN IF NOT EXISTS waktu_4 TIMESTAMP,
ADD COLUMN IF NOT EXISTS waktu_5 TIMESTAMP,
ADD COLUMN IF NOT EXISTS waktu_6 TIMESTAMP,
ADD COLUMN IF NOT EXISTS waktu_7 TIMESTAMP,

-- Additional tracking fields
ADD COLUMN IF NOT EXISTS tanggal_transfer_dana TIMESTAMP,
ADD COLUMN IF NOT EXISTS tanggal_laporan_lengkap TIMESTAMP,
ADD COLUMN IF NOT EXISTS tanggal_penyaluran_actual TIMESTAMP,

-- Communication tracking (Phase B: Active Validation)
ADD COLUMN IF NOT EXISTS komunikasi_status VARCHAR(50) DEFAULT 'pending' CHECK (komunikasi_status IN ('pending', 'in_progress', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS komunikasi_catatan TEXT,
ADD COLUMN IF NOT EXISTS komunikasi_terakhir TIMESTAMP,

-- Document validation flags
ADD COLUMN IF NOT EXISTS dokumen_surat_kematian_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dokumen_sk_pensiun_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dokumen_surat_pernyataan_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dokumen_kartu_keluarga_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dokumen_ktp_ahli_waris_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dokumen_surat_nikah_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dokumen_buku_rekening_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dokumen_surat_kuasa_verified BOOLEAN DEFAULT FALSE,

-- Reporting documents (Berkas-3 to Berkas-7)
ADD COLUMN IF NOT EXISTS file_berita_acara TEXT,
ADD COLUMN IF NOT EXISTS file_laporan_keuangan TEXT,
ADD COLUMN IF NOT EXISTS file_laporan_feedback TEXT,
ADD COLUMN IF NOT EXISTS file_bukti_penyerahan TEXT,
ADD COLUMN IF NOT EXISTS file_dokumen_pendukung TEXT,

-- Additional document storage fields
ADD COLUMN IF NOT EXISTS file_buku_rekening TEXT,
ADD COLUMN IF NOT EXISTS file_surat_kuasa TEXT,

-- Validation flags
ADD COLUMN IF NOT EXISTS is_validated_pc BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_validated_pp BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_funds_transferred BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_delivered BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_reported BOOLEAN DEFAULT FALSE,

-- Rejection handling
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS rejection_category VARCHAR(50) CHECK (rejection_category IN ('document', 'eligibility', 'fraud', 'timeout', 'other')),
ADD COLUMN IF NOT EXISTS can_resubmit BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS resubmission_deadline TIMESTAMP,

-- Performance tracking
ADD COLUMN IF NOT EXISTS total_processing_days INTEGER,
ADD COLUMN IF NOT EXISTS overdue_days INTEGER,
ADD COLUMN IF NOT EXISTS sla_status VARCHAR(20) DEFAULT 'on_track' CHECK (sla_status IN ('on_track', 'at_risk', 'overdue')),

-- Additional delivery and financial details
ADD COLUMN IF NOT EXISTS metode_penyaluran_actual VARCHAR(50) CHECK (metode_penyaluran_actual IN ('cash', 'transfer')),
ADD COLUMN IF NOT EXISTS penerima_dana VARCHAR(200),
ADD COLUMN IF NOT EXISTS cabang_petugas_penyerah VARCHAR(255),

-- Heir contact information
ADD COLUMN IF NOT EXISTS nik_ahli_waris VARCHAR(25),
ADD COLUMN IF NOT EXISTS no_hp_ahli_waris VARCHAR(20),
ADD COLUMN IF NOT EXISTS alamat_ahli_waris TEXT;

-- =====================================================
-- UPDATE STATUS_PROSES ENUM TO INCLUDE NEW STATUSES
-- =====================================================

-- Drop the existing enum and recreate with new values
DO $$
BEGIN
    -- Check if the new status values exist, if not add them
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending_dokumen' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'status_proses_dakem_enum')) THEN
        ALTER TYPE status_proses_dakem_enum ADD VALUE 'pending_dokumen';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'verified' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'status_proses_dakem_enum')) THEN
        ALTER TYPE status_proses_dakem_enum ADD VALUE 'verified';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ditolak' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'status_proses_dakem_enum')) THEN
        ALTER TYPE status_proses_dakem_enum ADD VALUE 'ditolak';
    END IF;
END $$;

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Timeline indexes
CREATE INDEX IF NOT EXISTS idx_dana_kematian_waktu_0 ON dana_kematian(waktu_0) WHERE waktu_0 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dana_kematian_waktu_1 ON dana_kematian(waktu_1) WHERE waktu_1 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dana_kematian_waktu_2 ON dana_kematian(waktu_2) WHERE waktu_2 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dana_kematian_waktu_3 ON dana_kematian(waktu_3) WHERE waktu_3 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dana_kematian_waktu_4 ON dana_kematian(waktu_4) WHERE waktu_4 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dana_kematian_waktu_5 ON dana_kematian(waktu_5) WHERE waktu_5 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dana_kematian_waktu_6 ON dana_kematian(waktu_6) WHERE waktu_6 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dana_kematian_waktu_7 ON dana_kematian(waktu_7) WHERE waktu_7 IS NOT NULL;

-- Communication tracking index
CREATE INDEX IF NOT EXISTS idx_dana_kematian_komunikasi_status ON dana_kematian(komunikasi_status);

-- Performance tracking indexes
CREATE INDEX IF NOT EXISTS idx_dana_kematian_sla_status ON dana_kematian(sla_status);
CREATE INDEX IF NOT EXISTS idx_dana_kematian_is_validated_pc ON dana_kematian(is_validated_pc);
CREATE INDEX IF NOT EXISTS idx_dana_kematian_is_validated_pp ON dana_kematian(is_validated_pp);

-- Rejection handling index
CREATE INDEX IF NOT EXISTS idx_dana_kematian_can_resubmit ON dana_kematian(can_resubmit) WHERE can_resubmit = TRUE;

-- =====================================================
-- POPULATE EXISTING RECORDS WITH DEFAULT VALUES
-- =====================================================

-- Set waktu_0 from tanggal_lapor_keluarga for existing records
UPDATE dana_kematian
SET waktu_0 = tanggal_lapor_keluarga
WHERE waktu_0 IS NULL AND tanggal_lapor_keluarga IS NOT NULL;

-- Set waktu_2 from cabang_tanggal_kirim_ke_pusat for existing records
UPDATE dana_kematian
SET waktu_2 = cabang_tanggal_kirim_ke_pusat
WHERE waktu_2 IS NULL AND cabang_tanggal_kirim_ke_pusat IS NOT NULL;

-- Set waktu_3 from pusat_tanggal_validasi for existing records
UPDATE dana_kematian
SET waktu_3 = pusat_tanggal_validasi
WHERE waktu_3 IS NULL AND pusat_tanggal_validasi IS NOT NULL;

-- Set waktu_4 from pusat_tanggal_selesai for existing records
UPDATE dana_kematian
SET waktu_4 = pusat_tanggal_selesai
WHERE waktu_4 IS NULL AND pusat_tanggal_selesai IS NOT NULL;

-- Set communication status based on existing status
UPDATE dana_kematian
SET komunikasi_status = 'completed'
WHERE komunikasi_status = 'pending'
AND status_proses IN ('proses_pusat', 'selesai');

-- =====================================================
-- CREATE VIEWS FOR REPORTING
-- =====================================================

-- Complete Timeline View
CREATE OR REPLACE VIEW v_dakem_timeline AS
SELECT
  dk.id,
  dk.nama_anggota,
  dk.status_proses,
  dk.waktu_0 AS "death_report",
  dk.waktu_1 AS "initial_docs",
  dk.waktu_2 AS "final_docs",
  dk.waktu_3 AS "pp_validated",
  dk.waktu_4 AS "processing_complete",
  dk.waktu_5 AS "funds_transferred",
  dk.waktu_6 AS "delivered",
  dk.waktu_7 AS "reported",
  EXTRACT(DAY FROM (COALESCE(dk.waktu_7, NOW()) - dk.waktu_0)) AS "total_days",
  dk.sla_status,
  dk.komunikasi_status
FROM dana_kematian dk
WHERE dk.deleted_at IS NULL;

-- Performance Dashboard View
CREATE OR REPLACE VIEW v_dakem_performance AS
SELECT
  dk.status_proses,
  COUNT(*) AS total_cases,
  AVG(EXTRACT(DAY FROM (COALESCE(dk.waktu_7, NOW()) - dk.waktu_0))) AS avg_processing_days,
  SUM(CASE WHEN dk.sla_status = 'overdue' THEN 1 ELSE 0 END) AS overdue_cases,
  SUM(CASE WHEN dk.sla_status = 'on_track' THEN 1 ELSE 0 END) AS on_track_cases,
  SUM(CASE WHEN dk.komunikasi_status = 'completed' THEN 1 ELSE 0 END) AS communication_completed
FROM dana_kematian dk
WHERE dk.deleted_at IS NULL
GROUP BY dk.status_proses;

-- Financial Reconciliation View
CREATE OR REPLACE VIEW v_dakem_reconciliation AS
SELECT
  dk.id,
  dk.nama_anggota,
  dk.besaran_dana_kematian AS "benefit_amount",
  dk.metode_penyaluran AS "transfer_method_to_pc",
  dk.metode_penyaluran_actual AS "delivery_method_to_heir",
  dk.tanggal_transfer_dana AS "transfer_date",
  dk.tanggal_penyaluran_actual AS "delivery_date",
  dk.cabang_asal_melapor AS "branch",
  dk.file_laporan_keuangan AS "financial_report_url"
FROM dana_kematian dk
WHERE dk.status_proses = 'selesai'
AND dk.deleted_at IS NULL;

-- =====================================================
-- CREATE TRIGGER FOR AUTOMATIC TIMESTAMP UPDATES
-- =====================================================

-- Function to update communication timestamp
CREATE OR REPLACE FUNCTION update_komunikasi_terakhir()
RETURNS TRIGGER AS $$
BEGIN
  NEW.komunikasi_terakhir = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update communication timestamp
CREATE TRIGGER trg_update_komunikasi_terakhir
BEFORE UPDATE OF komunikasi_status, komunikasi_catatan
ON dana_kematian
FOR EACH ROW
WHEN (NEW.komunikasi_status IS DISTINCT FROM OLD.komunikasi_status OR NEW.komunikasi_catatan IS DISTINCT FROM OLD.komunikasi_catatan)
EXECUTE FUNCTION update_komunikasi_terakhir();

-- =====================================================
-- CREATE FUNCTION TO CALCULATE PROCESSING TIME
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_total_processing_days()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.waktu_0 IS NOT NULL AND NEW.waktu_7 IS NOT NULL THEN
    NEW.total_processing_days = EXTRACT(DAY FROM (NEW.waktu_7 - NEW.waktu_0));
  ELSIF NEW.waktu_0 IS NOT NULL THEN
    NEW.total_processing_days = EXTRACT(DAY FROM (NOW() - NEW.waktu_0));
  END IF;

  -- Update SLA status based on processing time
  IF NEW.total_processing_days IS NOT NULL THEN
    IF NEW.total_processing_days > 80 THEN
      NEW.sla_status = 'overdue';
      NEW.overdue_days = NEW.total_processing_days - 80;
    ELSIF NEW.total_processing_days > 60 THEN
      NEW.sla_status = 'at_risk';
    ELSE
      NEW.sla_status = 'on_track';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate processing time
CREATE TRIGGER trg_calculate_processing_days
BEFORE INSERT OR UPDATE OF waktu_0, waktu_7
ON dana_kematian
FOR EACH ROW
EXECUTE FUNCTION calculate_total_processing_days();

-- =====================================================
-- CREATE FUNCTION TO VALIDATE TIMELINE SEQUENCE
-- =====================================================

CREATE OR REPLACE FUNCTION validate_timeline_sequence()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure Waktu-1 is after Waktu-0
  IF NEW.waktu_1 IS NOT NULL AND NEW.waktu_0 IS NOT NULL THEN
    IF NEW.waktu_1 < NEW.waktu_0 THEN
      RAISE EXCEPTION 'Waktu-1 cannot be before Waktu-0';
    END IF;
  END IF;

  -- Ensure Waktu-2 is after Waktu-1
  IF NEW.waktu_2 IS NOT NULL AND NEW.waktu_1 IS NOT NULL THEN
    IF NEW.waktu_2 < NEW.waktu_1 THEN
      RAISE EXCEPTION 'Waktu-2 cannot be before Waktu-1';
    END IF;
  END IF;

  -- Ensure Waktu-3 is after Waktu-2
  IF NEW.waktu_3 IS NOT NULL AND NEW.waktu_2 IS NOT NULL THEN
    IF NEW.waktu_3 < NEW.waktu_2 THEN
      RAISE EXCEPTION 'Waktu-3 cannot be before Waktu-2';
    END IF;
  END IF;

  -- Ensure Waktu-4 is after Waktu-3
  IF NEW.waktu_4 IS NOT NULL AND NEW.waktu_3 IS NOT NULL THEN
    IF NEW.waktu_4 < NEW.waktu_3 THEN
      RAISE EXCEPTION 'Waktu-4 cannot be before Waktu-3';
    END IF;
  END IF;

  -- Ensure Waktu-5 is after Waktu-4
  IF NEW.waktu_5 IS NOT NULL AND NEW.waktu_4 IS NOT NULL THEN
    IF NEW.waktu_5 < NEW.waktu_4 THEN
      RAISE EXCEPTION 'Waktu-5 cannot be before Waktu-4';
    END IF;
  END IF;

  -- Ensure Waktu-6 is after Waktu-5
  IF NEW.waktu_6 IS NOT NULL AND NEW.waktu_5 IS NOT NULL THEN
    IF NEW.waktu_6 < NEW.waktu_5 THEN
      RAISE EXCEPTION 'Waktu-6 cannot be before Waktu-5';
    END IF;
  END IF;

  -- Ensure Waktu-7 is after Waktu-6
  IF NEW.waktu_7 IS NOT NULL AND NEW.waktu_6 IS NOT NULL THEN
    IF NEW.waktu_7 < NEW.waktu_6 THEN
      RAISE EXCEPTION 'Waktu-7 cannot be before Waktu-6';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate timeline sequence
CREATE TRIGGER trg_validate_timeline_sequence
BEFORE INSERT OR UPDATE OF waktu_0, waktu_1, waktu_2, waktu_3, waktu_4, waktu_5, waktu_6, waktu_7
ON dana_kematian
FOR EACH ROW
EXECUTE FUNCTION validate_timeline_sequence();

-- =====================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN dana_kematian.waktu_0 IS 'Waktu-0: Death event and initial report timestamp';
COMMENT ON COLUMN dana_kematian.waktu_1 IS 'Waktu-1: Initial document receipt from heir';
COMMENT ON COLUMN dana_kematian.waktu_2 IS 'Waktu-2: Final document submission to PP';
COMMENT ON COLUMN dana_kematian.waktu_3 IS 'Waktu-3: PP validation completion';
COMMENT ON COLUMN dana_kematian.waktu_4 IS 'Waktu-4: PP processing completion (approval + finance coordination)';
COMMENT ON COLUMN dana_kematian.waktu_5 IS 'Waktu-5: Fund transfer from PP to PC completed';
COMMENT ON COLUMN dana_kematian.waktu_6 IS 'Waktu-6: Fund delivery to heir by PC';
COMMENT ON COLUMN dana_kematian.waktu_7 IS 'Waktu-7: All reports submitted and acknowledged';

COMMENT ON COLUMN dana_kematian.komunikasi_status IS 'Communication status with heir (pending, in_progress, completed, failed)';
COMMENT ON COLUMN dana_kematian.komunikasi_catatan IS 'Notes from communication with heir/family';
COMMENT ON COLUMN dana_kematian.komunikasi_terakhir IS 'Timestamp of last communication attempt';

COMMENT ON COLUMN dana_kematian.is_validated_pc IS 'PC validation completed flag';
COMMENT ON COLUMN dana_kematian.is_validated_pp IS 'PP validation completed flag';
COMMENT ON COLUMN dana_kematian.is_approved IS 'Management approval obtained flag';
COMMENT ON COLUMN dana_kematian.is_funds_transferred IS 'Fund transfer to PC completed flag';
COMMENT ON COLUMN dana_kematian.is_delivered IS 'Fund delivery to heir completed flag';
COMMENT ON COLUMN dana_kematian.is_reported IS 'All reports submitted flag';

COMMENT ON COLUMN dana_kematian.file_berita_acara IS 'Berkas-3: Handover report document URL';
COMMENT ON COLUMN dana_kematian.file_laporan_keuangan IS 'Berkas-4: Financial report document URL';
COMMENT ON COLUMN dana_kematian.file_laporan_feedback IS 'Berkas-5: Feedback report document URL';
COMMENT ON COLUMN dana_kematian.file_bukti_penyerahan IS 'Berkas-6: Delivery receipt document URL';
COMMENT ON COLUMN dana_kematian.file_dokumen_pendukung IS 'Berkas-7: Supporting documents package URL';

COMMENT ON COLUMN dana_kematian.rejection_category IS 'Category of rejection: document, eligibility, fraud, timeout, other';
COMMENT ON COLUMN dana_kematian.can_resubmit IS 'Flag indicating if claim can be resubmitted after rejection';
COMMENT ON COLUMN dana_kematian.resubmission_deadline IS 'Deadline for resubmission if rejected temporarily';

COMMENT ON COLUMN dana_kematian.sla_status IS 'SLA compliance status: on_track, at_risk, overdue';
COMMENT ON COLUMN dana_kematian.total_processing_days IS 'Total processing days from Waktu-0 to Waktu-7';
COMMENT ON COLUMN dana_kematian.overdue_days IS 'Number of days beyond SLA threshold';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
