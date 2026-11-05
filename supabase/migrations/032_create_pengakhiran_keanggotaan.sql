-- =====================================================
-- MIGRATION 032: PENGAKHIRAN KEANGGOTAAN
-- =====================================================
-- Fitur: mencatat anggota yang berhenti menjadi anggota (pengakhiran
-- keanggotaan) melalui pengajuan + verifikasi PC + persetujuan PP.
--
-- Latar belakang (docs/pengakhiran-keanggotaan-audit.md):
--  - `status_anggota` adalah PERAN KELUARGA (pegawai/istri/suami/anak/
--    meninggal) dan enum-nya DIPAKAI BERSAMA dengan `dana_kematian`
--    → TIDAK diubah.
--  - Belum ada representasi "anggota berhenti" di level anggota.
--
-- Keputusan bisnis yang diterapkan:
--  1. Workflow 2 tahap: menunggu -> diverifikasi_pc -> disetujui_pp
--     (ditolak / dibatalkan = terminal).
--  2. Alasan: mengundurkan_diri, diberhentikan, lainnya
--     (nilai "pensiun" tidak dipakai — mayoritas anggota adalah pensiunan).
--  3. status_keanggotaan_enum menyertakan 'non_aktif' (untuk skorsing
--     sementara di masa depan); modul ini hanya menetapkan 'berhenti'.
--  4. Status diterapkan langsung saat disetujui (bukan scheduled).
--  5. Dokumen pendukung opsional.
--  6. Blokir bila ada pengajuan Dana Kematian / Mutasi Cabang berjalan
--     (divalidasi di API, bukan constraint).
--  7. Tanpa reaktivasi otomatis.
--  8. Tanggal efektif berhenti tidak boleh di masa depan (divalidasi API).
--
-- Migration ini idempotent dan additive — tidak mengubah data lama.
-- =====================================================

-- =====================================================
-- 1. STATUS KEANGGOTAAN (SIKLUS HIDUP) DI TABEL anggota
-- =====================================================

DO $$ BEGIN
  CREATE TYPE status_keanggotaan_enum AS ENUM ('aktif', 'non_aktif', 'berhenti');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Baris lama otomatis menjadi 'aktif' — tidak perlu backfill manual.
ALTER TABLE anggota
  ADD COLUMN IF NOT EXISTS status_keanggotaan status_keanggotaan_enum
  NOT NULL DEFAULT 'aktif';

CREATE INDEX IF NOT EXISTS idx_anggota_status_keanggotaan
  ON anggota(status_keanggotaan);

COMMENT ON COLUMN anggota.status_keanggotaan IS
  'SIKLUS HIDUP KEANGGOTAAN: aktif (anggota aktif), non_aktif (skorsing sementara), '
  'berhenti (pengakhiran keanggotaan — lihat tabel pengakhiran_keanggotaan). '
  'Terpisah dari status_anggota (peran keluarga) & kategori_anggota (tier).';

-- =====================================================
-- 2. ENUM ALASAN & STATUS PENGAJUAN
-- =====================================================

DO $$ BEGIN
  CREATE TYPE alasan_pengakhiran_enum AS ENUM
    ('mengundurkan_diri', 'diberhentikan', 'lainnya');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pengakhiran_status_enum AS ENUM
    ('menunggu', 'diverifikasi_pc', 'disetujui_pp', 'ditolak', 'dibatalkan');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- 3. TABEL PENGAKHIRAN KEANGGOTAAN
-- =====================================================

CREATE TABLE IF NOT EXISTS pengakhiran_keanggotaan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relasi ke anggota; data anggota TIDAK dihapus saat berhenti.
  anggota_id UUID NOT NULL REFERENCES anggota(id) ON DELETE CASCADE,

  -- Snapshot identitas (tahan terhadap perubahan data induk) + pelaku
  diajukan_oleh VARCHAR(255) NOT NULL,
  nik VARCHAR(25),
  nama_anggota VARCHAR(255),
  nama_cabang VARCHAR(120),
  kode_cabang VARCHAR(20),

  -- Fakta pengakhiran
  alasan alasan_pengakhiran_enum NOT NULL,
  -- Wajib diisi bila alasan = 'lainnya' (divalidasi di API agar pesan jelas).
  keterangan_alasan TEXT,
  tanggal_efektif_berhenti DATE NOT NULL,
  nomor_dokumen VARCHAR(255) NOT NULL,
  tanggal_dokumen DATE NOT NULL,
  keterangan TEXT,
  -- URL dokumen pendukung (bucket anggota / folder surat-pengakhiran) — opsional.
  file_dokumen_pendukung TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Workflow (pola pengajuan_mutasi_cabang)
  status pengakhiran_status_enum NOT NULL DEFAULT 'menunggu',
  catatan_pengaju TEXT,

  -- Tahap verifikasi PC
  diverifikasi_oleh VARCHAR(255),
  diverifikasi_pada TIMESTAMPTZ,
  catatan_verifikasi TEXT,

  -- Keputusan akhir (PP/pusat)
  diputuskan_oleh VARCHAR(255),
  diputuskan_pada TIMESTAMPTZ,
  alasan_keputusan TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ
);

-- =====================================================
-- 4. CONSTRAINT
-- =====================================================

-- Dokumen diterbitkan sebelum/pada tanggal efektif berhenti.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pengakhiran_tanggal_order') THEN
    ALTER TABLE pengakhiran_keanggotaan
      ADD CONSTRAINT pengakhiran_tanggal_order
      CHECK (tanggal_dokumen <= tanggal_efektif_berhenti);
  END IF;
END $$;

-- Nomor dokumen tidak boleh kosong.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pengakhiran_nomor_tidak_kosong') THEN
    ALTER TABLE pengakhiran_keanggotaan
      ADD CONSTRAINT pengakhiran_nomor_tidak_kosong
      CHECK (length(btrim(nomor_dokumen)) >= 3);
  END IF;
END $$;

-- =====================================================
-- 5. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_pengakhiran_anggota
  ON pengakhiran_keanggotaan(anggota_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pengakhiran_status
  ON pengakhiran_keanggotaan(status);
CREATE INDEX IF NOT EXISTS idx_pengakhiran_tanggal_efektif
  ON pengakhiran_keanggotaan(tanggal_efektif_berhenti DESC);
CREATE INDEX IF NOT EXISTS idx_pengakhiran_not_deleted
  ON pengakhiran_keanggotaan(id)
  WHERE deleted_at IS NULL;

-- Satu pengajuan aktif (menunggu / diverifikasi_pc) per anggota.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pengakhiran_aktif_per_anggota
  ON pengakhiran_keanggotaan(anggota_id)
  WHERE status IN ('menunggu', 'diverifikasi_pc');

-- Satu pengakhiran final (disetujui) per anggota.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pengakhiran_final_per_anggota
  ON pengakhiran_keanggotaan(anggota_id)
  WHERE status = 'disetujui_pp' AND deleted_at IS NULL;

-- Nomor dokumen unik untuk pengajuan yang belum ditolak/dibatalkan.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pengakhiran_nomor_aktif
  ON pengakhiran_keanggotaan(lower(btrim(nomor_dokumen)))
  WHERE status IN ('menunggu', 'diverifikasi_pc', 'disetujui_pp');

-- =====================================================
-- 6. TRIGGER & RLS
-- =====================================================

-- update_updated_at_column() didefinisikan pada migration 001/029.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pengakhiran_updated_at ON pengakhiran_keanggotaan;
CREATE TRIGGER trg_pengakhiran_updated_at
  BEFORE UPDATE ON pengakhiran_keanggotaan
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Akses data hanya lewat Next.js API (service role) — pola migration 027/029/031.
ALTER TABLE pengakhiran_keanggotaan ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 7. COMMENTS
-- =====================================================

COMMENT ON TABLE pengakhiran_keanggotaan IS
  'Pengajuan & riwayat pengakhiran keanggotaan (anggota berhenti). '
  'Satu pengajuan aktif & satu pengakhiran final per anggota (partial unique index). '
  'Data anggota tidak dihapus; status anggota.status_keanggotaan diset "berhenti" saat disetujui.';

COMMENT ON COLUMN pengakhiran_keanggotaan.anggota_id IS 'Anggota yang diajukan berhenti (relasi ke anggota; data tidak dihapus)';
COMMENT ON COLUMN pengakhiran_keanggotaan.diajukan_oleh IS 'ID user pengaju (Prisma User.id)';
COMMENT ON COLUMN pengakhiran_keanggotaan.nik IS 'Snapshot NIK anggota saat pengajuan';
COMMENT ON COLUMN pengakhiran_keanggotaan.nama_anggota IS 'Snapshot nama anggota saat pengajuan';
COMMENT ON COLUMN pengakhiran_keanggotaan.nama_cabang IS 'Snapshot nama cabang anggota saat pengajuan';
COMMENT ON COLUMN pengakhiran_keanggotaan.kode_cabang IS 'Snapshot kode cabang anggota saat pengajuan';
COMMENT ON COLUMN pengakhiran_keanggotaan.alasan IS 'Alasan berhenti: mengundurkan_diri, diberhentikan, lainnya';
COMMENT ON COLUMN pengakhiran_keanggotaan.keterangan_alasan IS 'Penjelasan wajib bila alasan = lainnya';
COMMENT ON COLUMN pengakhiran_keanggotaan.tanggal_efektif_berhenti IS 'Tanggal efektif anggota berhenti (tidak boleh di masa depan)';
COMMENT ON COLUMN pengakhiran_keanggotaan.nomor_dokumen IS 'Nomor surat/dokumen resmi pengakhiran keanggotaan';
COMMENT ON COLUMN pengakhiran_keanggotaan.tanggal_dokumen IS 'Tanggal diterbitkannya dokumen pengakhiran';
COMMENT ON COLUMN pengakhiran_keanggotaan.file_dokumen_pendukung IS 'URL dokumen pendukung (bucket anggota / surat-pengakhiran) — opsional';
COMMENT ON COLUMN pengakhiran_keanggotaan.status IS 'Status pengajuan: menunggu, diverifikasi_pc, disetujui_pp, ditolak, dibatalkan';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
