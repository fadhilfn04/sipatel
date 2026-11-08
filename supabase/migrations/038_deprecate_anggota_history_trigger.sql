-- =====================================================
-- MIGRATION 038: DEPRECATE TRIGGER AUDIT LAMA (anggota_history)
-- =====================================================
-- Sejak migration 036, seluruh perubahan `anggota` dicatat ke `audit_log`
-- (aktor + role + diff semua kolom, transaksional). Trigger lama
-- `track_anggota_changes` (migration 003) menulis DUPLIKAT ke
-- `anggota_history` dengan `changed_by` yang selalu NULL (auth.uid() tidak
-- dipakai aplikasi).
--
-- Migration ini MENGHENTIKAN trigger lama — TIDAK menghapus data historis.
-- Tabel `anggota_history` dipertahankan sebagai arsip; API riwayat anggota
-- (`GET /api/anggota/[id]/history`) kini membaca `audit_log`.
--
-- Idempotent & additive.
-- =====================================================

DROP TRIGGER IF EXISTS track_anggota_insert ON anggota;
DROP TRIGGER IF EXISTS track_anggota_update ON anggota;
DROP TRIGGER IF EXISTS track_anggota_delete ON anggota;

COMMENT ON TABLE anggota_history IS
  'ARSIP: audit trail lama anggota (migration 003). Trigger dihentikan oleh migration 038; '
  'sumber riwayat aktif = audit_log (migration 036).';

-- Pastikan trigger audit terpusat tetap terpasang di semua tabel terdaftar.
SELECT audit_attach_all();

-- =====================================================
-- END OF MIGRATION 038
-- =====================================================
