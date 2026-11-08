-- =====================================================
-- MIGRATION 036: CENTRALIZED AUDIT TRAIL (audit_log)
-- =====================================================
-- Latar belakang (docs/audit-trail-history-audit.md):
--  - Riwayat perubahan data sebelumnya tersebar & tidak lengkap:
--    anggota_history.changed_by selalu NULL (auth.uid() tidak dipakai),
--    master data & modul keuangan tidak punya history sama sekali,
--    batch_operation_log tidak pernah dipakai.
--  - Diperlukan satu mekanisme audit terpusat yang otomatis (trigger DB),
--    konsisten dengan transaksi, menyimpan old/new value, aktor + role,
--    modul asal, dan melakukan masking data sensitif.
--
-- Desain:
--  1) audit_log          — satu tabel audit untuk seluruh modul.
--  2) audit_table_config — daftar tabel yang diaudit + modul + kolom anggota
--                          + kolom yang dimasking/dikecualikan.
--  3) audit_log_row()    — trigger generik (INSERT/UPDATE/DELETE).
--  4) audit_attach_all() — memasang trigger ke semua tabel terdaftar.
--  5) Actor context dibaca dari header request (PostgREST `request.headers`):
--     x-app-user-id, x-app-user-name, x-app-user-role, x-app-reason, x-app-ip.
--
-- Migration ini ADDITIVE & idempotent — tidak mengubah data lama dan TIDAK
-- menghapus mekanisme history existing (anggota_history, audit_dana_kematian,
-- riwayat_proses_dakem, dst.) yang tetap dipakai sebagai domain history.
-- =====================================================

-- =====================================================
-- 1. TABEL AUDIT LOG TERPUSAT
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  -- Konteks aktivitas
  module          VARCHAR(50) NOT NULL,   -- keanggotaan, dana_kematian, keuangan, master_data, user_management
  table_name      VARCHAR(63) NOT NULL,   -- tabel fisik yang berubah
  entity_id       VARCHAR(64),            -- PK baris yang berubah
  anggota_id      UUID,                   -- opsional: penelusuran lintas tabel per anggota
  action          VARCHAR(20) NOT NULL,   -- CREATE | UPDATE | DELETE | RESTORE | APPROVE | REJECT | VERIFY | LOGIN | LOGOUT | OTHER

  -- Nilai data
  old_values      JSONB,                  -- kondisi SEBELUM (sudah dimasking)
  new_values      JSONB,                  -- kondisi SESUDAH (sudah dimasking)
  changed_fields  TEXT[],                 -- diff seluruh kolom yang berubah

  -- Pelaku (snapshot agar tetap terbaca walau user berubah/dihapus)
  actor_user_id   UUID,                   -- "User".id (Prisma); NULL = system
  actor_name      VARCHAR(255),
  actor_role_slug VARCHAR(50),
  reason          TEXT,

  -- Metadata teknis
  source          VARCHAR(20) NOT NULL DEFAULT 'api', -- api | job | system | migration
  ip_address      VARCHAR(45),
  user_agent      TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_time    ON audit_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor   ON audit_log(actor_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity  ON audit_log(table_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_anggota ON audit_log(anggota_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_module  ON audit_log(module, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action  ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed ON audit_log USING GIN(changed_fields);

-- Akses hanya lewat Next.js API (service role) — pola migration 027/029/032.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE audit_log IS
  'Audit trail terpusat seluruh modul SIPATEL (trigger-based). Menyimpan aktor, role, '
  'modul, aksi, nilai sebelum/sesudah (masked), dan diff per field.';

-- =====================================================
-- 2. KONFIGURASI AUDIT PER TABEL
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_table_config (
  table_name      VARCHAR(63) PRIMARY KEY,
  module          VARCHAR(50) NOT NULL,
  anggota_column  VARCHAR(63),                        -- kolom FK anggota (untuk audit_log.anggota_id)
  mask_columns    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],   -- kolom yang dimasking (mis. norek_bank)
  exclude_columns TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],   -- kolom yang tidak boleh dicatat (kredensial)
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE audit_table_config ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE audit_table_config IS
  'Registry tabel yang diaudit oleh audit_log_row(): modul, kolom anggota, kolom masking/exclude.';

-- =====================================================
-- 3. SEED REGISTRY TABEL YANG DIAUDIT
-- =====================================================

INSERT INTO audit_table_config (table_name, module, anggota_column, mask_columns, exclude_columns, note)
VALUES
  -- Keanggotaan
  ('anggota',                  'keanggotaan',     'id',         ARRAY['norek_bank']::TEXT[], ARRAY[]::TEXT[], 'Data induk anggota'),
  ('anggota_kematian',         'keanggotaan',     'anggota_id', ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Entry meninggal dunia'),
  ('anggota_kepengurusan',     'keanggotaan',     'anggota_id', ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Perubahan kepengurusan'),
  ('anggota_mutasi',           'keanggotaan',     'anggota_id', ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Riwayat mutasi cabang'),
  ('anggota_perubahan',        'keanggotaan',     'anggota_id', ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Usulan approval perubahan anggota'),
  ('anggota_rekening',         'keanggotaan',     'anggota_id', ARRAY['norek_bank','norek_bank_lama']::TEXT[], ARRAY[]::TEXT[], 'Histori penggantian rekening (masking norek)'),
  ('pengakhiran_keanggotaan',  'keanggotaan',     'anggota_id', ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Pengakhiran keanggotaan'),
  ('pengajuan_mutasi_cabang',  'keanggotaan',     'anggota_id', ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Pengajuan mutasi cabang (self-service)'),

  -- Pewarisan NIK (event legal)
  ('nik_master',               'pewarisan_nik',   NULL,         ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'NIK eligible untuk pewarisan'),
  ('nik_kepemilikan',          'pewarisan_nik',   NULL,         ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Kepemilikan NIK'),

  -- Dana Kematian
  ('dana_kematian',            'dana_kematian',   'anggota_id', ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Pengajuan dana kematian'),
  ('dana_kematian_config',     'dana_kematian',   NULL,         ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Konfigurasi dana kematian'),
  ('dokumen_kematian',         'dana_kematian',   NULL,         ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Dokumen pengajuan dana kematian'),
  ('perhitungan_dana_kematian','dana_kematian',   NULL,         ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Perhitungan dana kematian'),

  -- Pelayanan & Keuangan
  ('dana_sosial',              'pelayanan',       'anggota_id', ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Dana sosial'),
  ('pembayaran_sumbangan',     'keuangan',        'anggota_id', ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Pembayaran sumbangan/iuran'),
  ('arus_kas',                 'keuangan',        'anggota_id', ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Arus kas'),
  ('laporan_periode',          'keuangan',        NULL,         ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Laporan periode'),
  ('laporan_periode_dakem',    'keuangan',        NULL,         ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Laporan periode dakem'),

  -- Master data
  ('master_cabang',            'master_data',     NULL,         ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Master cabang'),
  ('master_bank',              'master_data',     NULL,         ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Master bank'),
  ('master_kategori_bantuan',  'master_data',     NULL,         ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Master kategori bantuan'),
  ('master_tarif_dana_kematian','master_data',    NULL,         ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Master tarif dana kematian'),
  ('master_regional',          'master_data',     NULL,         ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Master regional'),
  ('master_witel',             'master_data',     NULL,         ARRAY[]::TEXT[],            ARRAY[]::TEXT[], 'Master witel')
ON CONFLICT (table_name) DO UPDATE
  SET module          = EXCLUDED.module,
      anggota_column  = EXCLUDED.anggota_column,
      mask_columns    = EXCLUDED.mask_columns,
      exclude_columns = EXCLUDED.exclude_columns,
      note            = EXCLUDED.note;

-- =====================================================
-- 4. FUNGSI HELPER: MASKING & TRANSFORMASI NILAI
-- =====================================================

-- Masking nilai sensitif: hanya 4 karakter terakhir + panjang.
-- Contoh: '1234567890123456' -> '****3456 (16)'
CREATE OR REPLACE FUNCTION audit_mask_text(p_value TEXT)
RETURNS TEXT AS $$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN p_value;
  END IF;
  IF length(p_value) <= 4 THEN
    RETURN '****';
  END IF;
  RETURN '****' || right(p_value, 4) || ' (' || length(p_value) || ')';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Salin row (jsonb) dengan: (1) membuang kolom exclude (kredensial dsb.),
-- (2) memasking kolom mask (mis. norek_bank).
CREATE OR REPLACE FUNCTION audit_transform_row(p_row JSONB, p_mask TEXT[], p_exclude TEXT[])
RETURNS JSONB AS $$
DECLARE
  k TEXT;
  v JSONB;
  v_result JSONB := '{}'::JSONB;
BEGIN
  IF p_row IS NULL THEN
    RETURN NULL;
  END IF;

  FOR k, v IN SELECT key, value FROM jsonb_each(p_row) LOOP
    IF p_exclude IS NOT NULL AND k = ANY(p_exclude) THEN
      CONTINUE;
    ELSIF p_mask IS NOT NULL AND k = ANY(p_mask) AND jsonb_typeof(v) = 'string' THEN
      v_result := v_result || jsonb_build_object(k, audit_mask_text(v #>> '{}'));
    ELSE
      v_result := v_result || jsonb_build_object(k, v);
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Hitung daftar kolom yang nilainya berbeda (diff seluruh kolom, bukan hard-coded).
CREATE OR REPLACE FUNCTION audit_changed_fields(p_old JSONB, p_new JSONB)
RETURNS TEXT[] AS $$
DECLARE
  v_result TEXT[];
BEGIN
  SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::TEXT[]) INTO v_result
  FROM (
    SELECT COALESCE(o.key, n.key) AS key
    FROM jsonb_each(COALESCE(p_old, '{}'::JSONB)) o
    FULL JOIN jsonb_each(COALESCE(p_new, '{}'::JSONB)) n ON o.key = n.key
    WHERE o.value IS DISTINCT FROM n.value
  ) diff;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Baca konteks request (header) yang diekspos PostgREST sebagai GUC.
-- Aplikasi mengirim header: x-app-user-id, x-app-user-name, x-app-user-role,
-- x-app-reason, x-app-ip — dibaca oleh lib/supabase-actor.ts.
CREATE OR REPLACE FUNCTION audit_request_context()
RETURNS JSONB AS $$
DECLARE
  v_raw TEXT;
BEGIN
  v_raw := current_setting('request.headers', true);
  IF v_raw IS NULL OR btrim(v_raw) = '' THEN
    RETURN '{}'::JSONB;
  END IF;
  RETURN v_raw::JSONB;
EXCEPTION WHEN others THEN
  RETURN '{}'::JSONB;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 5. TRIGGER GENERIK audit_log_row()
-- =====================================================
-- Dipasang ke setiap tabel di audit_table_config. Berjalan di transaksi yang
-- sama dengan perubahan data (ACID) sehingga data & audit tidak terpisah.

CREATE OR REPLACE FUNCTION audit_log_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg      RECORD;
  v_ctx      JSONB;
  v_old      JSONB;
  v_new      JSONB;
  v_changed  TEXT[];
  v_entity   VARCHAR(64);
  v_anggota  UUID;
  v_action   VARCHAR(20);
  v_actor    UUID;
  v_source   VARCHAR(20);
BEGIN
  SELECT * INTO v_cfg
    FROM audit_table_config
   WHERE table_name = TG_TABLE_NAME;

  -- Tabel tidak terdaftar / dinonaktifkan → tidak diaudit.
  IF NOT FOUND OR v_cfg.is_active IS NOT TRUE THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_ctx := audit_request_context();

  IF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := audit_transform_row(to_jsonb(NEW), v_cfg.mask_columns, v_cfg.exclude_columns);
    v_action := 'CREATE';
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := audit_transform_row(to_jsonb(OLD), v_cfg.mask_columns, v_cfg.exclude_columns);
    v_new := audit_transform_row(to_jsonb(NEW), v_cfg.mask_columns, v_cfg.exclude_columns);
    v_action := 'UPDATE';
  ELSE
    v_old := audit_transform_row(to_jsonb(OLD), v_cfg.mask_columns, v_cfg.exclude_columns);
    v_new := NULL;
    v_action := 'DELETE';
  END IF;

  v_changed := audit_changed_fields(v_old, v_new);

  -- UPDATE tanpa perubahan berarti → tidak perlu dicatat.
  IF TG_OP = 'UPDATE' AND COALESCE(array_length(v_changed, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;

  v_entity := COALESCE(v_new ->> 'id', v_old ->> 'id');

  -- Soft delete / restore dipetakan ke aksi domain agar mudah dibaca.
  IF TG_OP = 'UPDATE' AND 'deleted_at' = ANY (v_changed) THEN
    IF (v_new ->> 'deleted_at') IS NOT NULL AND (v_old ->> 'deleted_at') IS NULL THEN
      v_action := 'DELETE';
    ELSIF (v_new ->> 'deleted_at') IS NULL AND (v_old ->> 'deleted_at') IS NOT NULL THEN
      v_action := 'RESTORE';
    END IF;
  END IF;

  -- Referensi anggota (untuk penelusuran lintas tabel per anggota).
  v_anggota := NULL;
  IF v_cfg.anggota_column IS NOT NULL THEN
    BEGIN
      v_anggota := COALESCE(
        NULLIF(v_new ->> v_cfg.anggota_column, ''),
        NULLIF(v_old ->> v_cfg.anggota_column, '')
      )::UUID;
    EXCEPTION WHEN others THEN
      v_anggota := NULL;
    END;
  END IF;

  -- Aktor dari header request (session server, bukan request body).
  BEGIN
    v_actor := NULLIF(btrim(COALESCE(v_ctx ->> 'x-app-user-id', '')), '')::UUID;
  EXCEPTION WHEN others THEN
    v_actor := NULL;
  END;

  v_source := CASE WHEN v_actor IS NULL THEN 'system' ELSE 'api' END;

  INSERT INTO audit_log (
    module, table_name, entity_id, anggota_id, action,
    old_values, new_values, changed_fields,
    actor_user_id, actor_name, actor_role_slug, reason,
    source, ip_address
  ) VALUES (
    v_cfg.module, TG_TABLE_NAME, v_entity, v_anggota, v_action,
    v_old, v_new, v_changed,
    v_actor,
    NULLIF(btrim(COALESCE(v_ctx ->> 'x-app-user-name', '')), ''),
    NULLIF(btrim(COALESCE(v_ctx ->> 'x-app-user-role', '')), ''),
    NULLIF(btrim(COALESCE(v_ctx ->> 'x-app-reason', '')), ''),
    v_source,
    NULLIF(btrim(COALESCE(v_ctx ->> 'x-app-ip', '')), '')
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION audit_log_row() IS
  'Trigger generik audit trail: mencatat CREATE/UPDATE/DELETE (termasuk soft delete/restore) '
  'ke audit_log dengan old/new values (masked), diff kolom, dan aktor dari header request.';

-- =====================================================
-- 6. PEMASANGAN TRIGGER (attach / detach / attach_all)
-- =====================================================

CREATE OR REPLACE FUNCTION audit_attach(p_table TEXT)
RETURNS void AS $$
BEGIN
  IF to_regclass(format('public.%I', p_table)) IS NULL THEN
    RAISE NOTICE 'audit_attach: tabel % tidak ditemukan — dilewati', p_table;
    RETURN;
  END IF;

  EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_log_ins ON %I', p_table);
  EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_log_upd ON %I', p_table);
  EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_log_del ON %I', p_table);

  EXECUTE format(
    'CREATE TRIGGER trg_audit_log_ins AFTER INSERT ON %I FOR EACH ROW EXECUTE FUNCTION audit_log_row()',
    p_table
  );
  EXECUTE format(
    'CREATE TRIGGER trg_audit_log_upd AFTER UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION audit_log_row()',
    p_table
  );
  EXECUTE format(
    'CREATE TRIGGER trg_audit_log_del AFTER DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_log_row()',
    p_table
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION audit_detach(p_table TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_log_ins ON %I', p_table);
  EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_log_upd ON %I', p_table);
  EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_log_del ON %I', p_table);
END;
$$ LANGUAGE plpgsql;

-- Pasang trigger ke SEMUA tabel yang terdaftar & aktif.
CREATE OR REPLACE FUNCTION audit_attach_all()
RETURNS INT AS $$
DECLARE
  v_tbl RECORD;
  v_n   INT := 0;
BEGIN
  FOR v_tbl IN SELECT table_name FROM audit_table_config WHERE is_active IS TRUE LOOP
    PERFORM audit_attach(v_tbl.table_name);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$ LANGUAGE plpgsql;

-- Jumlah trigger audit yang terpasang pada sebuah tabel (untuk script verifikasi).
-- Aman untuk tabel yang belum ada (mengembalikan 0).
CREATE OR REPLACE FUNCTION audit_trigger_count(p_table TEXT)
RETURNS INT AS $$
DECLARE
  v_n INT := 0;
  v_rel REGCLASS;
BEGIN
  v_rel := to_regclass(format('public.%I', p_table));
  IF v_rel IS NULL THEN
    RETURN 0; -- tabel tidak ada (migration sumber belum dijalankan)
  END IF;

  SELECT count(*) INTO v_n
    FROM pg_trigger
   WHERE tgname IN ('trg_audit_log_ins', 'trg_audit_log_upd', 'trg_audit_log_del')
     AND tgrelid = v_rel;
  RETURN v_n;
END;
$$ LANGUAGE plpgsql STABLE;

-- Pasang sekarang.
SELECT audit_attach_all();

-- =====================================================
-- 7. PERBAIKAN FK batch_operation_log (GUARDED)
-- =====================================================
-- performed_by menyimpan ID user Prisma ("User".id), BUKAN auth.users.id,
-- sehingga FK ke auth.users membuat INSERT gagal. FK dihapus (additive);
-- nilai disimpan bebas + metadata JSONB tetap menyimpan detail.
-- CATATAN: migration 025 (batch_operation_log) mungkin belum dijalankan —
-- oleh karena itu ALTER dibungkus guard agar migration ini tetap berhasil.
DO $$
BEGIN
  IF to_regclass('public.batch_operation_log') IS NOT NULL THEN
    ALTER TABLE batch_operation_log
      DROP CONSTRAINT IF EXISTS batch_operation_log_performed_by_fkey;
    RAISE NOTICE 'audit: FK batch_operation_log.performed_by dilepas';
  ELSE
    RAISE NOTICE 'audit: tabel batch_operation_log belum ada — perbaikan FK dilewati';
  END IF;
END $$;

-- =====================================================
-- 8. RPC TRANSAKSIONAL: apply_penggantian_rekening
-- =====================================================
-- Membungkus 3 langkah (update anggota, nonaktifkan rekening lama, insert
-- histori) menjadi SATU transaksi atomik — menutup gap "history bisa gagal
-- tanpa rollback data utama" (lib/server/anggota-rekening-service.ts).

CREATE OR REPLACE FUNCTION apply_penggantian_rekening(
  p_anggota_id              UUID,
  p_nama_bank               TEXT,
  p_norek_bank              TEXT,
  p_nama_pemilik_rekening   TEXT,
  p_kode_bank               TEXT,
  p_tanggal_efektif         DATE,
  p_dokumen_pendukung       TEXT,
  p_alasan                  TEXT,
  p_diajukan_oleh           TEXT,
  p_disetujui_oleh          TEXT,
  p_diputuskan_pada         TIMESTAMPTZ
) RETURNS SETOF anggota
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_before RECORD;
  v_now    TIMESTAMPTZ := COALESCE(p_diputuskan_pada, timezone('utc', now()));
BEGIN
  SELECT * INTO v_before
    FROM anggota
   WHERE id = p_anggota_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anggota tidak ditemukan atau sudah dihapus';
  END IF;

  -- 1) Rekening baru menjadi aktif.
  UPDATE anggota
     SET nama_bank             = p_nama_bank,
         norek_bank            = p_norek_bank,
         nama_pemilik_rekening = p_nama_pemilik_rekening,
         updated_at            = timezone('utc', now())
   WHERE id = p_anggota_id;

  -- 2) Nonaktifkan rekening aktif lama pada histori.
  UPDATE anggota_rekening
     SET status = 'non_aktif'
   WHERE anggota_id = p_anggota_id
     AND status = 'aktif';

  -- 3) Simpan histori lengkap (lama -> baru), append-only.
  INSERT INTO anggota_rekening (
    anggota_id,
    nama_bank_lama, norek_bank_lama, nama_pemilik_rekening_lama,
    kode_bank, nama_bank, norek_bank, nama_pemilik_rekening, status,
    tanggal_efektif, dokumen_pendukung, alasan,
    diajukan_oleh, disetujui_oleh, diputuskan_pada
  ) VALUES (
    p_anggota_id,
    v_before.nama_bank, v_before.norek_bank, v_before.nama_pemilik_rekening,
    NULLIF(btrim(COALESCE(p_kode_bank, '')), ''), p_nama_bank, p_norek_bank, p_nama_pemilik_rekening, 'aktif',
    p_tanggal_efektif, p_dokumen_pendukung, p_alasan,
    p_diajukan_oleh, p_disetujui_oleh, v_now
  );

  RETURN QUERY SELECT * FROM anggota WHERE id = p_anggota_id;
END;
$$;

COMMENT ON FUNCTION apply_penggantian_rekening(UUID, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) IS
  'Terapkan penggantian rekening anggota secara atomik (rekening aktif + histori append-only dalam satu transaksi).';

-- =====================================================
-- END OF MIGRATION 036
-- =====================================================




