-- Migration: Create anggota (members) table
-- Stores all pensioners union member information

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--------------------------------------------------
-- ENUM TYPES
--------------------------------------------------

CREATE TYPE kategori_anggota_enum AS ENUM (
    'biasa',
    'luar_biasa',
    'kehormatan',
);

CREATE TYPE status_anggota_enum AS ENUM (
    'pegawai',
    'istri',
    'suami',
    'anak',
    'meninggal'
);

CREATE TYPE status_mps_enum AS ENUM (
    'mps',
    'non_mps'
);

CREATE TYPE status_iuran_enum AS ENUM (
    'iuran',
    'tidak_iuran'
);

CREATE TYPE jenis_kelamin_enum AS ENUM (
    'laki_laki',
    'perempuan'
);

CREATE TYPE status_perkawinan_enum AS ENUM (
    'belum_kawin',
    'kawin',
    'cerai_hidup',
    'cerai_mati'
);

CREATE TYPE posisi_kepengurusan_enum AS ENUM (
    'anggota',
    'pengurus',
);

CREATE TYPE sk_pensiun_enum AS ENUM (
    'ada',
    'tidak_ada',
);

CREATE TYPE agama_enum AS ENUM (
    'islam',
    'kristen',
    'katolik',
    'hindu',
    'buddha',
    'konghucu'
);

CREATE TYPE golongan_darah_enum AS ENUM (
    'A',
    'B',
    'AB',
    'O'
);

-- =========================================================
-- TABLE
-- =========================================================

CREATE TABLE anggota (

    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Supabase user relation
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    ---------------------------------------------------------
    -- IDENTITAS
    ---------------------------------------------------------

    nik VARCHAR(20) UNIQUE NOT NULL,
    nama_anggota VARCHAR(255) NOT NULL,

    ---------------------------------------------------------
    -- STATUS KEANGGOTAAN
    ---------------------------------------------------------

    kategori_anggota kategori_anggota_enum NOT NULL,
    status_anggota status_anggota_enum NOT NULL,
    status_mps status_mps_enum NOT NULL,
    status_iuran status_iuran_enum NOT NULL,
    status_kepesertaan VARCHAR(50),

    ---------------------------------------------------------
    -- ORGANISASI
    ---------------------------------------------------------

    nama_cabang VARCHAR(120) NOT NULL,
    posisi_kepengurusan VARCHAR(120) DEFAULT 'Anggota',

    cabang_kelas VARCHAR(10),
    cabang_area_regional VARCHAR(50),
    cabang_area_witel VARCHAR(50),

    ---------------------------------------------------------
    -- HUBUNGAN KELUARGA
    ---------------------------------------------------------

    pasutri VARCHAR(100),
    status_perkawinan status_perkawinan_enum,

    ---------------------------------------------------------
    -- DATA PENSIUN
    ---------------------------------------------------------

    sk_pensiun sk_pensiun_enum,
    nomor_sk_pensiun VARCHAR(120),

    ---------------------------------------------------------
    -- ALAMAT
    ---------------------------------------------------------

    alamat TEXT,
    rt VARCHAR(5),
    rw VARCHAR(5),
    kelurahan VARCHAR(100),
    kecamatan VARCHAR(100),
    kota VARCHAR(100),
    provinsi VARCHAR(100),
    kode_pos VARCHAR(10),

    ---------------------------------------------------------
    -- KONTAK
    ---------------------------------------------------------

    nomor_handphone VARCHAR(20),
    nomor_telepon VARCHAR(20),
    email VARCHAR(255),

    sosial_media VARCHAR(100),

    ---------------------------------------------------------
    -- IDENTITAS RESMI
    ---------------------------------------------------------

    e_ktp VARCHAR(30),
    kartu_keluarga VARCHAR(30),
    npwp VARCHAR(30),

    ---------------------------------------------------------
    -- DATA PRIBADI
    ---------------------------------------------------------

    tempat_lahir VARCHAR(100),
    tanggal_lahir DATE,

    jenis_kelamin jenis_kelamin_enum,
    agama agama_enum,
    golongan_darah golongan_darah_enum,

    ---------------------------------------------------------
    -- DATA IURAN
    ---------------------------------------------------------

    besaran_iuran NUMERIC(12,2),
    form_kesediaan_iuran BOOLEAN,

    ---------------------------------------------------------
    -- BANK
    ---------------------------------------------------------

    nama_bank VARCHAR(100),
    norek_bank VARCHAR(50),

    ---------------------------------------------------------
    -- DATA BANTUAN SOSIAL
    ---------------------------------------------------------

    kategori_bantuan VARCHAR(100),
    tanggal_terima_bantuan DATE,
    gambar_kondisi_tempat_tinggal TEXT,

    ---------------------------------------------------------
    -- MUTASI
    ---------------------------------------------------------

    alasan_mutasi VARCHAR(255),
    tanggal_mutasi DATE,
    cabang_pengajuan_mutasi VARCHAR(100),
    pusat_pengesahan_mutasi VARCHAR(100),

    ---------------------------------------------------------
    -- BPJS
    ---------------------------------------------------------

    status_bpjs BOOLEAN,
    bpjs_kelas VARCHAR(10),
    bpjs_insentif BOOLEAN,

    ---------------------------------------------------------
    -- DATUL
    ---------------------------------------------------------

    kategori_datul VARCHAR(50),
    media_datul VARCHAR(50),

    --------------------------------------------------
    -- TIMESTAMPS
    --------------------------------------------------

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

--------------------------------------------------
-- INDEXES
--------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_anggota_nik
ON anggota(nik);

CREATE INDEX IF NOT EXISTS idx_anggota_kategori_anggota
ON anggota(kategori_anggota);

CREATE INDEX IF NOT EXISTS idx_anggota_status_anggota
ON anggota(status_anggota);

CREATE INDEX IF NOT EXISTS idx_anggota_status_mps
ON anggota(status_mps);

CREATE INDEX IF NOT EXISTS idx_anggota_status_iuran
ON anggota(status_iuran);

CREATE INDEX IF NOT EXISTS idx_anggota_cabang
ON anggota(nama_cabang);

CREATE INDEX IF NOT EXISTS idx_anggota_created_at
ON anggota(created_at DESC);

--------------------------------------------------
-- FULL TEXT SEARCH (nama anggota)
--------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_anggota_nama_search
ON anggota
USING gin(to_tsvector('indonesian', nama_anggota));

--------------------------------------------------
-- SOFT DELETE INDEX
--------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_anggota_deleted_at
ON anggota(deleted_at)
WHERE deleted_at IS NULL;

--------------------------------------------------
-- UPDATED_AT TRIGGER
--------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_anggota_updated_at
BEFORE UPDATE ON anggota
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

--------------------------------------------------
-- COMMENTS
--------------------------------------------------

COMMENT ON TABLE anggota IS 'Tabel data anggota pensiunan';

COMMENT ON COLUMN anggota.id IS 'Primary key UUID anggota';
COMMENT ON COLUMN anggota.user_id IS 'Relasi ke auth.users Supabase';
COMMENT ON COLUMN anggota.nik IS 'Nomor Induk Anggota';
COMMENT ON COLUMN anggota.nama_anggota IS 'Nama lengkap anggota';

COMMENT ON COLUMN anggota.kategori_anggota IS 'Kategori anggota (biasa, luar biasa, kehormatan, bukan anggota)';
COMMENT ON COLUMN anggota.status_anggota IS 'Status anggota (pegawai, pasangan, anak, meninggal)';
COMMENT ON COLUMN anggota.status_mps IS 'Status MPS (Manfaat Pensiun Sekaligus)';
COMMENT ON COLUMN anggota.status_iuran IS 'Status pembayaran iuran';

COMMENT ON COLUMN anggota.nama_cabang IS 'Cabang organisasi anggota';

COMMENT ON COLUMN anggota.deleted_at IS 'Timestamp soft delete';