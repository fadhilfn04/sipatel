-- =====================================================
-- MIGRATION 033: PERUBAHAN KEPENGURUSAN
-- =====================================================
-- Fitur: mencatat perubahan posisi/jabatan kepengurusan anggota
-- (angkat, pindah, berhentikan) melalui pengajuan + verifikasi PC +
-- persetujuan PP, lengkap dengan periode, tanggal mulai/selesai jabatan,
-- dan nomor/tanggal/file SK pengangkatan.
--
-- Latar belakang (docs/perubahan-kepengurusan-audit.md):
--  - `anggota.posisi_kepengurusan` hanya VARCHAR free text (default 'Anggota'),
--    tanpa histori, periode, maupun SK.
--  - Form existing hanya mengenal 'anggota'/'pengurus'; tabel menampilkan
--    'Ketua'/'Wakil Ketua'/dst — mismatch.
--
-- Keputusan yang diterapkan:
--  1. Workflow 2 tahap (pola migration 032):
--     menunggu -> diverifikasi_pc -> disetujui_pp
--     (ditolak / dibatalkan = terminal). Admin boleh jalur cepat (self-approved).
--  2. `anggota.posisi_kepengurusan` tetap menjadi "posisi saat ini" dan
--     di-sinkronkan IDEMPOTENT saat disetujui. Status anggota/keanggotaan/
--     kategori TIDAK diubah oleh modul ini.
--  3. Histori jabatan append-only — data lama tidak dihapus.
--  4. Model tunggal: satu jabatan aktif (selain 'Anggota') per anggota.
--
-- Migration ini idempotent & additive — tidak mengubah data lama.
-- =====================================================

-- =====================================================
-- 1. ENUM JENIS & STATUS
-- =====================================================

DO $$ BEGIN
  CREATE TYPE kepengurusan_jenis_enum AS ENUM ('angkat', 'pindah', 'berhentikan');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE kepengurusan_status_enum AS ENUM
    ('menunggu', 'diverifikasi_pc', 'disetujui_pp', 'ditolak', 'dibatalkan');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- 2. TABEL RIWAYAT / PENGAJUAN KEPENGURUSAN
-- =====================================================

CREATE TABLE IF NOT EXISTS anggota_kepengurusan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relasi ke anggota; data anggota TIDAK dihapus.
  anggota_id UUID NOT NULL REFERENCES anggota(id) ON DELETE CASCADE,

  -- Snapshot identitas (tahan terhadap perubahan data induk) + pelaku
  diajukan_oleh VARCHAR(255) NOT NULL,
  nik VARCHAR(25),
  nama_anggota VARCHAR(255),
  nama_cabang VARCHAR(120),
  kode_cabang VARCHAR(20),

  -- Fakta jabatan
  jenis kepengurusan_jenis_enum NOT NULL,
  jabatan VARCHAR(120) NOT NULL,           -- nilai kanonik, mis. 'Sekretaris'
  jabatan_sebelumnya VARCHAR(120),         -- posisi sebelum perubahan
  periode VARCHAR(50),                     -- opsional, mis. '2025-2030'
  tanggal_mulai DATE NOT NULL,
  tanggal_selesai DATE,                    -- NULL = jabatan terbuka/aktif
  nomor_sk VARCHAR(255) NOT NULL,
  tanggal_sk DATE NOT NULL,
  file_sk TEXT,                            -- URL dokumen SK (bucket anggota / sk-pengangkatan)
  keterangan TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Workflow (pola pengakhiran_keanggotaan / migration 032)
  status kepengurusan_status_enum NOT NULL DEFAULT 'menunggu',
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
-- 3. CONSTRAINT
-- =====================================================

-- Tanggal SK tidak melewati tanggal mulai jabatan.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kepengurusan_tanggal_order') THEN
    ALTER TABLE anggota_kepengurusan
      ADD CONSTRAINT kepengurusan_tanggal_order
      CHECK (tanggal_sk <= tanggal_mulai);
  END IF;
END $$;

-- Bila tanggal selesai diisi, harus setelah tanggal mulai.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kepengurusan_selesai_setelah_mulai') THEN
    ALTER TABLE anggota_kepengurusan
      ADD CONSTRAINT kepengurusan_selesai_setelah_mulai
      CHECK (tanggal_selesai IS NULL OR tanggal_selesai > tanggal_mulai);
  END IF;
END $$;

-- Nomor SK tidak boleh kosong.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kepengurusan_nomor_tidak_kosong') THEN
    ALTER TABLE anggota_kepengurusan
      ADD CONSTRAINT kepengurusan_nomor_tidak_kosong
      CHECK (length(btrim(nomor_sk)) >= 3);
  END IF;
END $$;

-- =====================================================
-- 4. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_kepengurusan_anggota
  ON anggota_kepengurusan(anggota_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kepengurusan_status
  ON anggota_kepengurusan(status);
CREATE INDEX IF NOT EXISTS idx_kepengurusan_not_deleted
  ON anggota_kepengurusan(id)
  WHERE deleted_at IS NULL;

-- Satu pengajuan aktif (menunggu / diverifikasi_pc) per anggota.
CREATE UNIQUE INDEX IF NOT EXISTS uq_kepengurusan_aktif_pengajuan_per_anggota
  ON anggota_kepengurusan(anggota_id)
  WHERE status IN ('menunggu', 'diverifikasi_pc') AND deleted_at IS NULL;

-- Satu jabatan aktif final (selain 'Anggota') per anggota — model tunggal.
CREATE UNIQUE INDEX IF NOT EXISTS uq_kepengurusan_jabatan_aktif_per_anggota
  ON anggota_kepengurusan(anggota_id)
  WHERE status = 'disetujui_pp'
    AND tanggal_selesai IS NULL
    AND jabatan <> 'Anggota'
    AND deleted_at IS NULL;

-- Nomor SK unik antar pengajuan/final yang belum ditolak/dibatalkan.
CREATE UNIQUE INDEX IF NOT EXISTS uq_kepengurusan_nomor_aktif
  ON anggota_kepengurusan(lower(btrim(nomor_sk)))
  WHERE status IN ('menunggu', 'diverifikasi_pc', 'disetujui_pp') AND deleted_at IS NULL;

-- =====================================================
-- 5. TRIGGER & RLS
-- =====================================================

-- update_updated_at_column() didefinisikan pada migration 001/032.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kepengurusan_updated_at ON anggota_kepengurusan;
CREATE TRIGGER trg_kepengurusan_updated_at
  BEFORE UPDATE ON anggota_kepengurusan
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Akses data hanya lewat Next.js API (service role) — pola migration 027/029/032.
ALTER TABLE anggota_kepengurusan ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. COMMENTS
-- =====================================================

COMMENT ON TABLE anggota_kepengurusan IS
  'Pengajuan & riwayat perubahan jabatan kepengurusan anggota (angkat/pindah/berhentikan). '
  'Saat disetujui, anggota.posisi_kepengurusan di-sinkronkan (idempotent). '
  'Status anggota/keanggotaan/kategori TIDAK diubah oleh modul ini.';
COMMENT ON COLUMN anggota_kepengurusan.anggota_id IS 'Anggota yang diubah jabatannya (data tidak dihapus)';
COMMENT ON COLUMN anggota_kepengurusan.diajukan_oleh IS 'ID user pengaju (Prisma User.id)';
COMMENT ON COLUMN anggota_kepengurusan.jenis IS 'Jenis perubahan: angkat, pindah, berhentikan';
COMMENT ON COLUMN anggota_kepengurusan.jabatan IS 'Jabatan tujuan/nilai kanonik (mis. Ketua, Sekretaris, Anggota)';
COMMENT ON COLUMN anggota_kepengurusan.jabatan_sebelumnya IS 'Snapshot posisi_kepengurusan sebelum perubahan';
COMMENT ON COLUMN anggota_kepengurusan.periode IS 'Periode/masa jabatan (teks bebas, opsional)';
COMMENT ON COLUMN anggota_kepengurusan.tanggal_mulai IS 'Tanggal mulai berlaku jabatan';
COMMENT ON COLUMN anggota_kepengurusan.tanggal_selesai IS 'Tanggal berakhir jabatan (NULL = jabatan terbuka)';
COMMENT ON COLUMN anggota_kepengurusan.nomor_sk IS 'Nomor SK pengangkatan/pemberhentian';
COMMENT ON COLUMN anggota_kepengurusan.tanggal_sk IS 'Tanggal SK diterbitkan (<= tanggal_mulai)';
COMMENT ON COLUMN anggota_kepengurusan.file_sk IS 'URL dokumen SK (bucket anggota / folder sk-pengangkatan) — opsional';
COMMENT ON COLUMN anggota_kepengurusan.status IS 'Status pengajuan: menunggu, diverifikasi_pc, disetujui_pp, ditolak, dibatalkan';

-- =====================================================
-- END OF MIGRATION
-- =====================================================

