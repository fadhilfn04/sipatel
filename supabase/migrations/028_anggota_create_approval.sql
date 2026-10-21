-- =====================================================
-- MIGRATION 028: Approval pembuatan anggota (Create)
-- =====================================================
-- Keputusan bisnis: Create anggota oleh non-admin juga
-- harus melalui persetujuan admin (selaras Edit/Hapus).
--
-- Menambahkan nilai 'create' pada enum jenis usulan.
-- Idempotent, tidak mengubah data lama.
-- =====================================================

ALTER TYPE anggota_perubahan_jenis_enum ADD VALUE IF NOT EXISTS 'create';

COMMENT ON TYPE anggota_perubahan_jenis_enum IS 'Jenis usulan perubahan data anggota: create (usulan anggota baru), edit, hapus';

-- Usulan 'create' belum memiliki baris anggota → anggota_id harus bisa NULL.
ALTER TABLE anggota_perubahan ALTER COLUMN anggota_id DROP NOT NULL;

-- Riwayat usulan tidak ikut terhapus bila baris anggota dihapus secara fisik.
ALTER TABLE anggota_perubahan DROP CONSTRAINT IF EXISTS anggota_perubahan_anggota_id_fkey;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'anggota_perubahan_anggota_id_fkey'
  ) THEN
    ALTER TABLE anggota_perubahan
      ADD CONSTRAINT anggota_perubahan_anggota_id_fkey
      FOREIGN KEY (anggota_id) REFERENCES anggota(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN anggota_perubahan.anggota_id IS 'Anggota terkait — NULL untuk usulan create (anggota belum dibuat)';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
