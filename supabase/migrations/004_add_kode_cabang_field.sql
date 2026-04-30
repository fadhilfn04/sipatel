-- Migration: Add kode_cabang field to anggota table
-- This adds a branch code field for system reference and improved data management

-- Add kode_cabang column
ALTER TABLE anggota ADD COLUMN kode_cabang VARCHAR(20);

-- Add index for kode_cabang to improve query performance
CREATE INDEX IF NOT EXISTS idx_anggota_kode_cabang
ON anggota(kode_cabang);

-- Add comment for documentation
COMMENT ON COLUMN anggota.kode_cabang IS 'Kode cabang untuk referensi sistem';

-- Optional: Populate with existing cabang codes if you have a mapping function
-- This is commented out as it requires a mapping function that you may need to create
-- UPDATE anggota SET kode_cabang = generate_kode_cabang(nama_cabang);