-- =====================================================
-- MIGRATION 027: Dakem claim/assignment, dynamic config,
-- anggota approval & mutasi history
-- =====================================================
-- 1) Penugasan (claim) pengajuan Dana Kematian antar-cabang:
--    satu pengajuan hanya dapat diproses cabang yang meng-claim.
--    Claim dilakukan lewat UPDATE atomik (WHERE claim_status='tersedia')
--    sehingga aman terhadap dua cabang yang claim bersamaan.
-- 2) Konfigurasi dinamis Dana Kematian yang dikelola admin pusat
--    (batas masa kedaluwarsa pengajuan + daftar dokumen wajib),
--    lengkap dengan tabel riwayat perubahan konfigurasi.
-- 3) Approval perubahan data anggota (Edit/Hapus) sebelum data utama diubah.
-- 4) Riwayat mutasi anggota antar-cabang (append-only).
--
-- Migration ini idempotent dan TIDAK mengubah/menghapus data lama.
-- =====================================================

-- =====================================================
-- 1. PENUGASAN (CLAIM) PENGAJUAN DANA KEMATIAN
-- =====================================================

ALTER TABLE dana_kematian
  ADD COLUMN IF NOT EXISTS claim_status VARCHAR(20) NOT NULL DEFAULT 'tersedia'
    CHECK (claim_status IN ('tersedia', 'diklaim')),
  ADD COLUMN IF NOT EXISTS cabang_pemilik_kode VARCHAR(20),
  ADD COLUMN IF NOT EXISTS diklaim_oleh VARCHAR(255),
  ADD COLUMN IF NOT EXISTS diklaim_pada TIMESTAMPTZ;

-- Konsistensi: status 'diklaim' wajib mencatat user pengambil
ALTER TABLE dana_kematian
  DROP CONSTRAINT IF EXISTS chk_dakem_claim_owner;
ALTER TABLE dana_kematian
  ADD CONSTRAINT chk_dakem_claim_owner
    CHECK (claim_status = 'tersedia' OR diklaim_oleh IS NOT NULL);

-- FK ke master_cabang (dibungkus DO block supaya aman dijalankan ulang)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_dakem_cabang_pemilik'
  ) THEN
    ALTER TABLE dana_kematian
      ADD CONSTRAINT fk_dakem_cabang_pemilik
      FOREIGN KEY (cabang_pemilik_kode)
      REFERENCES master_cabang(kode_cabang)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dakem_claim_status
  ON dana_kematian(claim_status);
CREATE INDEX IF NOT EXISTS idx_dakem_diklaim_oleh
  ON dana_kematian(diklaim_oleh);

COMMENT ON COLUMN dana_kematian.claim_status IS 'Status penugasan: tersedia (belum diklaim cabang) / diklaim (milik satu cabang)';
COMMENT ON COLUMN dana_kematian.cabang_pemilik_kode IS 'Kode cabang pemilik pengajuan (cabang yang meng-claim / ditugaskan)';
COMMENT ON COLUMN dana_kematian.diklaim_oleh IS 'ID user yang meng-claim pengajuan (Prisma User.id)';
COMMENT ON COLUMN dana_kematian.diklaim_pada IS 'Waktu pengajuan diklaim/ditugaskan';

-- Formalisasi kolom catatan verifikasi pusat (sudah dipakai API verifikasi
-- tetapi belum pernah didefinisikan di file migrasi — drift skema).
ALTER TABLE dana_kematian
  ADD COLUMN IF NOT EXISTS pusat_catatan_verifikasi TEXT;

COMMENT ON COLUMN dana_kematian.pusat_catatan_verifikasi IS 'Catatan hasil verifikasi Pusat (alasan pengembalian/penolakan, dsb.)';

-- =====================================================
-- 2. KONFIGURASI DINAMIS DANA KEMATIAN (+ RIWAYAT)
-- =====================================================

CREATE TABLE IF NOT EXISTS dana_kematian_config (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by VARCHAR(255),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS dana_kematian_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  value_sebelum JSONB,
  value_setelah JSONB NOT NULL,
  updated_by VARCHAR(255),
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_dakem_config_history_key
  ON dana_kematian_config_history(key, created_at DESC);

COMMENT ON TABLE dana_kematian_config IS 'Konfigurasi Dana Kematian yang dikelola admin pusat (batas kedaluwarsa, dokumen wajib, dll)';
COMMENT ON TABLE dana_kematian_config_history IS 'Riwayat perubahan konfigurasi Dana Kematian (audit trail)';

-- Seed nilai awal — sesuai SKPP yang berlaku saat ini:
-- batas maksimal 4 tahun sejak tanggal meninggal.
-- (ON CONFLICT DO NOTHING: tidak menimpa nilai yang sudah diatur admin)
INSERT INTO dana_kematian_config (key, label, value, description) VALUES
  (
    'max_death_claim_period_years',
    'Batas Maksimal Pengajuan (Tahun)',
    '4'::jsonb,
    'Selisih tepat N tahun sejak tanggal meninggal masih memenuhi syarat; lebih dari itu tidak memenuhi syarat. Sumber: SKPP yang berlaku.'
  ),
  (
    'required_documents',
    'Dokumen Wajib Pengajuan',
    '{
      "file_sk_pensiun": true,
      "file_surat_kematian": true,
      "file_surat_pernyataan_ahli_waris": true,
      "file_kartu_keluarga": true,
      "file_e_ktp": true,
      "file_surat_nikah": true,
      "file_surat_keterangan": true,
      "file_dokumen_pendukung": false
    }'::jsonb,
    'Peta kolom file dokumen -> wajib (true) / opsional (false). Perubahan hanya memengaruhi gate submit baru; dokumen lama tidak dihapus.'
  )
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 3. APPROVAL PERUBAHAN DATA ANGGOTA (EDIT / HAPUS)
-- =====================================================

DO $$ BEGIN
  CREATE TYPE anggota_perubahan_jenis_enum AS ENUM ('edit', 'hapus');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE anggota_perubahan_status_enum AS ENUM ('menunggu', 'disetujui', 'ditolak');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS anggota_perubahan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anggota_id UUID NOT NULL REFERENCES anggota(id) ON DELETE CASCADE,
  jenis anggota_perubahan_jenis_enum NOT NULL,

  status anggota_perubahan_status_enum NOT NULL DEFAULT 'menunggu',

  -- Snapshot data sebelum perubahan
  data_sebelum JSONB,
  -- Data usulan perubahan (payload PATCH untuk edit)
  data_usulan JSONB NOT NULL,

  -- Alasan pengajuan perubahan (dari pengaju)
  alasan TEXT,

  diajukan_oleh VARCHAR(255) NOT NULL,
  diajukan_pada TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  diputuskan_oleh VARCHAR(255),
  diputuskan_pada TIMESTAMPTZ,
  alasan_keputusan TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_anggota_perubahan_anggota
  ON anggota_perubahan(anggota_id, diajukan_pada DESC);
CREATE INDEX IF NOT EXISTS idx_anggota_perubahan_status
  ON anggota_perubahan(status);

COMMENT ON TABLE anggota_perubahan IS 'Usulan perubahan data anggota (edit/hapus) yang memerlukan persetujuan admin sebelum data utama diubah';
COMMENT ON COLUMN anggota_perubahan.data_sebelum IS 'Snapshot data anggota sebelum perubahan';
COMMENT ON COLUMN anggota_perubahan.data_usulan IS 'Payload usulan perubahan (edit)';
COMMENT ON COLUMN anggota_perubahan.diajukan_oleh IS 'ID user pengaju (Prisma User.id)';

-- =====================================================
-- 4. RIWAYAT MUTASI ANGGOTA ANTAR-CABANG (APPEND-ONLY)
-- =====================================================

CREATE TABLE IF NOT EXISTS anggota_mutasi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anggota_id UUID NOT NULL REFERENCES anggota(id) ON DELETE CASCADE,
  nik VARCHAR(25),

  cabang_asal VARCHAR(120),
  cabang_tujuan VARCHAR(120),
  kode_cabang_asal VARCHAR(20),
  kode_cabang_tujuan VARCHAR(20),

  tanggal_efektif DATE,

  diajukan_oleh VARCHAR(255),
  disetujui_oleh VARCHAR(255),
  alasan TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_anggota_mutasi_anggota
  ON anggota_mutasi(anggota_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anggota_mutasi_tujuan
  ON anggota_mutasi(cabang_tujuan, tanggal_efektif DESC);

COMMENT ON TABLE anggota_mutasi IS 'Riwayat mutasi anggota antar-cabang — append-only, tidak diubah/dihapus saat anggota dimutasikan kembali';
COMMENT ON COLUMN anggota_mutasi.cabang_asal IS 'Nama cabang asal sebelum mutasi';
COMMENT ON COLUMN anggota_mutasi.cabang_tujuan IS 'Nama cabang tujuan setelah mutasi';
COMMENT ON COLUMN anggota_mutasi.tanggal_efektif IS 'Tanggal efektif mutasi';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
