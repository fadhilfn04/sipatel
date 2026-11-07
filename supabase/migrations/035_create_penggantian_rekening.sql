-- =====================================================
-- MIGRATION 035: Penggantian Rekening Anggota (Keanggotaan)
-- =====================================================
-- Menu Keanggotaan → Penggantian Rekening.
--
-- 1) Kolom `nama_pemilik_rekening` pada `anggota` — mirror pemilik rekening
--    aktif (rekening aktif tetap single source of truth di tabel anggota).
-- 2) Tabel `anggota_rekening` (append-only) — menyimpan snapshot rekening
--    LAMA + rekening BARU setiap penggantian diterapkan, sehingga rekening
--    lama tidak pernah hilang (histori perubahan).
-- 3) Nilai enum `jenis='rekening'` pada `anggota_perubahan` agar usulan
--    penggantian rekening dapat dibedakan dari usulan edit umum.
--
-- Migration ini idempotent dan TIDAK mengubah/menghapus data lama.
-- Desain: docs/penggantian-rekening-audit.md
-- =====================================================

-- =====================================================
-- 1. KOLOM PEMILIK REKENING AKTIF PADA ANGGOTA
-- =====================================================

ALTER TABLE anggota
  ADD COLUMN IF NOT EXISTS nama_pemilik_rekening VARCHAR(255);

COMMENT ON COLUMN anggota.nama_pemilik_rekening IS
  'Nama pemilik rekening aktif (mirror penggantian rekening terakhir; mengikuti aturan wajib sama dengan nama anggota). Histori lengkap di tabel anggota_rekening.';

-- =====================================================
-- 2. HISTORI REKENING (APPEND-ONLY)
-- =====================================================

DO $$ BEGIN
  CREATE TYPE anggota_rekening_status_enum AS ENUM ('aktif', 'non_aktif');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS anggota_rekening (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anggota_id UUID NOT NULL REFERENCES anggota(id) ON DELETE CASCADE,

  -- Snapshot rekening lama saat diganti (null bila anggota belum punya rekening)
  nama_bank_lama VARCHAR(100),
  norek_bank_lama VARCHAR(50),
  nama_pemilik_rekening_lama VARCHAR(255),

  -- Rekening baru (menjadi rekening aktif)
  kode_bank VARCHAR(10) REFERENCES master_bank(kode_bank) ON DELETE SET NULL,
  nama_bank VARCHAR(100) NOT NULL,
  norek_bank VARCHAR(50) NOT NULL,
  nama_pemilik_rekening VARCHAR(255) NOT NULL,
  status anggota_rekening_status_enum NOT NULL DEFAULT 'aktif',

  tanggal_efektif DATE NOT NULL,
  dokumen_pendukung TEXT,
  alasan TEXT,

  diajukan_oleh VARCHAR(255),
  disetujui_oleh VARCHAR(255),
  diputuskan_pada TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_anggota_rekening_anggota
  ON anggota_rekening(anggota_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anggota_rekening_status
  ON anggota_rekening(status);

-- Integritas: maksimal satu rekening aktif per anggota.
CREATE UNIQUE INDEX IF NOT EXISTS uq_anggota_rekening_aktif
  ON anggota_rekening(anggota_id) WHERE status = 'aktif';

COMMENT ON TABLE anggota_rekening IS
  'Histori penggantian rekening anggota — append-only. Rekening aktif tetap tersimpan pada tabel anggota; rekening lama disimpan di sini.';
COMMENT ON COLUMN anggota_rekening.nama_bank_lama IS 'Nama bank rekening lama (snapshot saat diganti)';
COMMENT ON COLUMN anggota_rekening.norek_bank_lama IS 'Nomor rekening lama (snapshot saat diganti)';
COMMENT ON COLUMN anggota_rekening.nama_pemilik_rekening_lama IS 'Nama pemilik rekening lama (snapshot saat diganti)';
COMMENT ON COLUMN anggota_rekening.status IS 'aktif = rekening yang berlaku saat ini; non_aktif = rekening historis';
COMMENT ON COLUMN anggota_rekening.tanggal_efektif IS 'Tanggal efektif penggantian rekening';
COMMENT ON COLUMN anggota_rekening.dokumen_pendukung IS 'URL dokumen pendukung (buku tabungan / bukti kepemilikan rekening)';
COMMENT ON COLUMN anggota_rekening.diajukan_oleh IS 'ID user pengaju (Prisma User.id)';
COMMENT ON COLUMN anggota_rekening.disetujui_oleh IS 'ID user penyetuju (Prisma User.id)';

-- =====================================================
-- 3. JENIS USULAN 'rekening' PADA APPROVAL ANGGOTA
-- =====================================================

ALTER TYPE anggota_perubahan_jenis_enum ADD VALUE IF NOT EXISTS 'rekening';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
