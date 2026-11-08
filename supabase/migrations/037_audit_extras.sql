-- =====================================================
-- MIGRATION 037: AUDIT EXTRA — notification_routing
-- =====================================================
-- Melengkapi coverage audit trail (migration 036) untuk tabel konfigurasi
-- routing notifikasi yang dikelola admin. Additive & idempotent.
--
-- Catatan: tabel notifications & chat_messages TIDAK didaftarkan karena
-- volume tinggi (insert otomatis) — dipertimbangkan kebisingan, bukan data
-- yang perlu ditelusuri per perubahan.
-- =====================================================

INSERT INTO audit_table_config (table_name, module, anggota_column, mask_columns, exclude_columns, note)
VALUES
  ('notification_routing', 'sistem', NULL, ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'Konfigurasi routing notifikasi')
ON CONFLICT (table_name) DO UPDATE
  SET module          = EXCLUDED.module,
      anggota_column  = EXCLUDED.anggota_column,
      mask_columns    = EXCLUDED.mask_columns,
      exclude_columns = EXCLUDED.exclude_columns,
      note            = EXCLUDED.note;

-- Pasang trigger ke tabel yang baru didaftarkan.
SELECT audit_attach_all();

-- =====================================================
-- END OF MIGRATION 037
-- =====================================================
