-- =====================================================
-- MIGRATION 029: PENGAJUAN MUTASI CABANG (SELF-SERVICE ANGGOTA)
-- =====================================================
-- Fitur: Anggota mengajukan mutasi cabang melalui form pengajuan.
-- Alur:  menunggu -> diverifikasi_pc -> disetujui_pp
--                              \-> ditolak (terminal)
--                              \-> dibatalkan (terminal, oleh pengaju/PC/PP)
--
-- Dokumen mutasi cukup nomor + tanggal (tanpa upload file).
-- Data pengajuan selalu terikat ke akun anggota yang login (anggota_id
-- di-resolve server-side dari user_id, bukan input manual).
-- =====================================================

DO $$ BEGIN
  CREATE TYPE pengajuan_mutasi_status_enum AS ENUM (
    'menunggu',
    'diverifikasi_pc',
    'disetujui_pp',
    'ditolak',
    'dibatalkan'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS pengajuan_mutasi_cabang (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relasi & identitas pengaju (snapshot agar tahan terhadap perubahan data induk)
  anggota_id UUID NOT NULL REFERENCES anggota(id) ON DELETE CASCADE,
  diajukan_oleh VARCHAR(255) NOT NULL,
  nik VARCHAR(25),
  nama_anggota VARCHAR(255),
  cabang_asal VARCHAR(120),
  kode_cabang_asal VARCHAR(20),

  -- Data dokumen mutasi (sesuai kebutuhan: cukup nomor + tanggal, tanpa upload)
  tanggal_mulai_mutasi DATE NOT NULL,
  nomor_dokumen_mutasi VARCHAR(255) NOT NULL,
  tanggal_dokumen_mutasi DATE NOT NULL,

  -- Status & workflow (dikembangkan untuk verifikasi admin/PC/PP)
  status pengajuan_mutasi_status_enum NOT NULL DEFAULT 'menunggu',
  catatan_pengaju TEXT,

  -- Tahap verifikasi PC
  diverifikasi_oleh VARCHAR(255),
  diverifikasi_pada TIMESTAMPTZ,
  catatan_verifikasi TEXT,

  -- Keputusan akhir (PP/admin)
  diputuskan_oleh VARCHAR(255),
  diputuskan_pada TIMESTAMPTZ,
  alasan_keputusan TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Validasi integritas tanggal dokumen: dokumen diterbitkan sebelum/pada tanggal efektif.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pengajuan_mutasi_tanggal_order'
  ) THEN
    ALTER TABLE pengajuan_mutasi_cabang
      ADD CONSTRAINT pengajuan_mutasi_tanggal_order
      CHECK (tanggal_dokumen_mutasi <= tanggal_mulai_mutasi);
  END IF;
END $$;

-- Nomor dokumen tidak boleh kosong.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pengajuan_mutasi_nomor_tidak_kosong'
  ) THEN
    ALTER TABLE pengajuan_mutasi_cabang
      ADD CONSTRAINT pengajuan_mutasi_nomor_tidak_kosong
      CHECK (length(btrim(nomor_dokumen_mutasi)) >= 3);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pengajuan_mutasi_anggota
  ON pengajuan_mutasi_cabang(anggota_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pengajuan_mutasi_status
  ON pengajuan_mutasi_cabang(status);
CREATE INDEX IF NOT EXISTS idx_pengajuan_mutasi_pengaju
  ON pengajuan_mutasi_cabang(diajukan_oleh, created_at DESC);

-- Hanya satu pengajuan aktif (menunggu / diverifikasi_pc) per anggota.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pengajuan_mutasi_aktif_per_anggota
  ON pengajuan_mutasi_cabang(anggota_id)
  WHERE status IN ('menunggu', 'diverifikasi_pc');

-- Nomor dokumen unik untuk pengajuan yang belum ditolak/dibatalkan.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pengajuan_mutasi_nomor_aktif
  ON pengajuan_mutasi_cabang(lower(btrim(nomor_dokumen_mutasi)))
  WHERE status IN ('menunggu', 'diverifikasi_pc', 'disetujui_pp');

-- Updated_at trigger (fungsi dibuat di migration 001; recreate agar idempotent).
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_pengajuan_mutasi_cabang_updated_at'
  ) THEN
    CREATE TRIGGER update_pengajuan_mutasi_cabang_updated_at
    BEFORE UPDATE ON pengajuan_mutasi_cabang
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Akses data hanya lewat API (service role). Frontend tidak query langsung.
ALTER TABLE pengajuan_mutasi_cabang ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE pengajuan_mutasi_cabang IS 'Pengajuan mutasi cabang yang diajukan anggota secara mandiri (self-service)';
COMMENT ON COLUMN pengajuan_mutasi_cabang.anggota_id IS 'Anggota yang mengajukan mutasi (di-resolve server-side dari akun login)';
COMMENT ON COLUMN pengajuan_mutasi_cabang.diajukan_oleh IS 'ID user pengaju (Prisma User.id)';
COMMENT ON COLUMN pengajuan_mutasi_cabang.nik IS 'Snapshot NIK anggota saat pengajuan';
COMMENT ON COLUMN pengajuan_mutasi_cabang.nama_anggota IS 'Snapshot nama anggota saat pengajuan';
COMMENT ON COLUMN pengajuan_mutasi_cabang.cabang_asal IS 'Snapshot nama cabang asal anggota saat pengajuan';
COMMENT ON COLUMN pengajuan_mutasi_cabang.kode_cabang_asal IS 'Snapshot kode cabang asal anggota saat pengajuan';
COMMENT ON COLUMN pengajuan_mutasi_cabang.tanggal_mulai_mutasi IS 'Tanggal efektif mulai berlakunya mutasi';
COMMENT ON COLUMN pengajuan_mutasi_cabang.nomor_dokumen_mutasi IS 'Nomor surat/dokumen resmi mutasi';
COMMENT ON COLUMN pengajuan_mutasi_cabang.tanggal_dokumen_mutasi IS 'Tanggal diterbitkannya surat/dokumen mutasi';
COMMENT ON COLUMN pengajuan_mutasi_cabang.status IS 'Status pengajuan: menunggu, diverifikasi_pc, disetujui_pp, ditolak, dibatalkan';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
