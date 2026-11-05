-- =====================================================
-- MIGRATION 031: Entry Data Karyawan Meninggal Dunia
-- =====================================================
-- Registrasi fakta kematian anggota (satu baris per anggota) sebagai
-- single source of truth di level anggota.
--
-- Latar belakang (docs/entry-meninggal-dunia-audit.md):
--  - anggota.status_anggota sudah punya nilai 'meninggal', tetapi tanggal
--    meninggal & surat kematian hanya tersimpan per pengajuan di
--    dana_kematian (snapshot), bukan sebagai fakta level anggota.
--  - Modul Dana Kematian TIDAK diubah oleh migration ini; kolom
--    tanggal_meninggal / file_surat_kematian di dana_kematian tetap
--    dipertahankan sebagai snapshot per pengajuan.
--
-- Alur integrasi:
--  - Entry kematian  -> INSERT anggota_kematian + sinkronisasi
--                       anggota.status_anggota = 'meninggal'.
--  - Pengajuan Dakem -> prefill dari anggota_kematian (reuse data &
--                       dokumen, tanpa upload ulang).
--  - Entry kematian TIDAK PERNAH membuat baris dana_kematian.
--
-- Migration ini idempotent dan additive — tidak mengubah data lama.
-- =====================================================

CREATE TABLE IF NOT EXISTS anggota_kematian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relasi 1:1 ke anggota — UNIQUE memastikan satu fakta kematian per anggota
  anggota_id UUID NOT NULL UNIQUE REFERENCES anggota(id) ON DELETE CASCADE,

  -- Fakta kematian
  tanggal_meninggal DATE NOT NULL,
  file_surat_kematian TEXT,

  -- Metadata internal (nama file asli, catatan, dsb. — bukan field form)
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  dicatat_oleh VARCHAR(255),
  dicatat_pada TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_anggota_kematian_tanggal
  ON anggota_kematian(tanggal_meninggal DESC);

CREATE INDEX IF NOT EXISTS idx_anggota_kematian_dicatat
  ON anggota_kematian(dicatat_oleh);

-- Soft delete index (pola tabel bisnis lain)
CREATE INDEX IF NOT EXISTS idx_anggota_kematian_not_deleted
  ON anggota_kematian(id)
  WHERE deleted_at IS NULL;

-- updated_at trigger (fungsi didefinisikan pada migration 001)
DROP TRIGGER IF EXISTS trg_anggota_kematian_updated_at ON anggota_kematian;
CREATE TRIGGER trg_anggota_kematian_updated_at
  BEFORE UPDATE ON anggota_kematian
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS: akses data selalu lewat Next.js API (service role) — pola migration 027
ALTER TABLE anggota_kematian ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE anggota_kematian IS
  'Registrasi fakta kematian anggota (satu baris per anggota). Single source of truth '
  'tanggal meninggal & surat kematian di level anggota; pengajuan Dana Kematian tetap '
  'menyimpan snapshot per pengajuan pada tabel dana_kematian.';

COMMENT ON COLUMN anggota_kematian.anggota_id IS 'Relasi 1:1 ke anggota (UNIQUE — satu fakta kematian per anggota)';
COMMENT ON COLUMN anggota_kematian.tanggal_meninggal IS 'Tanggal anggota meninggal dunia';
COMMENT ON COLUMN anggota_kematian.file_surat_kematian IS 'URL dokumen surat kematian (bucket anggota, folder surat-kematian) — opsional saat entry';
COMMENT ON COLUMN anggota_kematian.dicatat_oleh IS 'ID user yang mencatat (Prisma User.id)';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
