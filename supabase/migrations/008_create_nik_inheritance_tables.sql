-- Migration: Create nik_master and nik_kepemilikan tables
-- For managing NIK inheritance system when pensioner passes away

-- =========================================================
-- NIK MASTER TABLE
-- =========================================================
-- Stores NIK records when the original pensioner passes away
-- One NIK can be inherited by multiple family members over time

CREATE TABLE nik_master (

    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- NIK dari pensiunan asli (tidak berubah)
    nik VARCHAR(20) NOT NULL UNIQUE,

    --------------------------------------------------
    -- TIMESTAMPS
    --------------------------------------------------

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

--------------------------------------------------
-- INDEXES
--------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_nik_master_nik
ON nik_master(nik);

CREATE INDEX IF NOT EXISTS idx_nik_master_created_at
ON nik_master(created_at DESC);

--------------------------------------------------
-- UPDATED_AT TRIGGER
--------------------------------------------------

CREATE TRIGGER update_nik_master_updated_at
BEFORE UPDATE ON nik_master
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

--------------------------------------------------
-- COMMENTS
--------------------------------------------------

COMMENT ON TABLE nik_master IS 'Master tabel NIK yang diwariskan ketika pensiunan meninggal';
COMMENT ON COLUMN nik_master.id IS 'Primary key UUID';
COMMENT ON COLUMN nik_master.nik IS 'NIK asli dari pensiunan yang tidak berubah ketika diwariskan';

-- =========================================================
-- NIK KEPEMILIKAN TABLE
-- =========================================================
-- Tracks ownership history of each NIK
-- One nik_master can have multiple nik_kepemilikan records over time

CREATE TYPE status_kepemilikan_enum AS ENUM (
    'aktif',
    'non_aktif',
    'meninggal',
    'dicabut'
);

CREATE TABLE nik_kepemilikan (

    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign key to nik_master
    nik_id UUID NOT NULL REFERENCES nik_master(id) ON DELETE CASCADE,

    -- Ahli waris (free text for dummy data)
    anggota_id VARCHAR(255),

    ---------------------------------------------------------
    -- DETAIL KEPEMILIKAN
    ---------------------------------------------------------

    hubungan VARCHAR(50), -- istri, suami, anak_1, anak_2, anak_3, dll
    status status_kepemilikan_enum NOT NULL DEFAULT 'aktif',

    tanggal_mulai DATE NOT NULL, -- Tanggal mulai mewarisi NIK
    tanggal_selesai DATE, -- Tanggal selesai mewarisi (jika sudah tidak aktif)

    is_current BOOLEAN DEFAULT true, -- Apakah ini kepemilikan yang sedang berlaku

    --------------------------------------------------
    -- TIMESTAMPS
    --------------------------------------------------

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

--------------------------------------------------
-- INDEXES
--------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_nik_kepemilikan_nik_id
ON nik_kepemilikan(nik_id);

CREATE INDEX IF NOT EXISTS idx_nik_kepemilikan_anggota_id
ON nik_kepemilikan(anggota_id);

CREATE INDEX IF NOT EXISTS idx_nik_kepemilikan_is_current
ON nik_kepemilikan(is_current);

CREATE INDEX IF NOT EXISTS idx_nik_kepemilikan_status
ON nik_kepemilikan(status);

CREATE INDEX IF NOT EXISTS idx_nik_kepemilikan_created_at
ON nik_kepemilikan(created_at DESC);

--------------------------------------------------
-- UPDATED_AT TRIGGER
--------------------------------------------------

CREATE TRIGGER update_nik_kepemilikan_updated_at
BEFORE UPDATE ON nik_kepemilikan
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

--------------------------------------------------
-- COMMENTS
--------------------------------------------------

COMMENT ON TABLE nik_kepemilikan IS 'Riwayat kepemilikan NIK oleh anggota keluarga';
COMMENT ON COLUMN nik_kepemilikan.id IS 'Primary key UUID';
COMMENT ON COLUMN nik_kepemilikan.nik_id IS 'Foreign key ke nik_master';
COMMENT ON COLUMN nik_kepemilikan.anggota_id IS 'Foreign key ke anggota yang mewarisi NIK';
COMMENT ON COLUMN nik_kepemilikan.hubungan IS 'Hubungan dengan pensiunan asli (istri, suami, anak_1, dll)';
COMMENT ON COLUMN nik_kepemilikan.status IS 'Status kepemilikan NIK (aktif, non_aktif, meninggal, dicabut)';
COMMENT ON COLUMN nik_kepemilikan.tanggal_mulai IS 'Tanggal mulai mewarisi NIK';
COMMENT ON COLUMN nik_kepemilikan.tanggal_selesai IS 'Tanggal selesai mewarisi (jika tidak aktif)';
COMMENT ON COLUMN nik_kepemilikan.is_current IS 'Apakah kepemilikan ini sedang berlaku';
