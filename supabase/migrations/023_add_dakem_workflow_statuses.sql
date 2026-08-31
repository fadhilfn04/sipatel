-- =====================================================
-- MIGRATION 023: Add DAKEM UAT workflow statuses
-- =====================================================
-- UAT 2026 introduced a new submission flow:
--   Draft → Verifikasi Pusat → Koreksi/Batal/Ditolak/Valid
--         → Penyaluran → Terima Ahli Waris → Laporan → Selesai
--
-- New enum values:
--   draft             — partially filled form, on going process
--   batal             — submission canceled by the branch (record is KEPT)
--   terima_ahli_waris — funds handed over to the heir (handover doc uploaded,
--                       forwarded to the Finance module)
--   laporan           — branch report uploaded (forwarded to the Archive
--                       Management module)
--
-- Legacy values (dilaporkan, verifikasi_cabang, pending_dokumen, revisi_pusat)
-- are kept and displayed under the new flow labels — no data migration.
-- =====================================================

ALTER TYPE status_proses_dakem_enum ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE status_proses_dakem_enum ADD VALUE IF NOT EXISTS 'batal';
ALTER TYPE status_proses_dakem_enum ADD VALUE IF NOT EXISTS 'terima_ahli_waris';
ALTER TYPE status_proses_dakem_enum ADD VALUE IF NOT EXISTS 'laporan';

-- Notification routing for the new workflow events.
-- NOTE: target_role_slugs is NOT NULL — an empty array would DISABLE the
-- event, so follow the role-target convention used in
-- 20260520_notification_routing.sql.
INSERT INTO notification_routing (event_type, event_label, description, target_role_slugs) VALUES
  ('dana_kematian_terima_ahli_waris', 'Dana Diterima Ahli Waris', 'Dikirim ketika PC mengonfirmasi penyerahan dana ke ahli waris; berkas diteruskan ke modul Keuangan.', ARRAY['pc_staff', 'pc_kepala', 'pp_kepala']),
  ('dana_kematian_laporan', 'Laporan Cabang Diupload', 'Dikirim ketika PC mengupload laporan cabang; laporan diteruskan ke modul Arsip.', ARRAY['pc_staff', 'pc_kepala', 'pp_kepala']),
  ('dana_kematian_batal', 'Pengajuan Dibatalkan', 'Dikirim ketika pengajuan dana kematian dibatalkan oleh cabang; data tetap tersimpan sebagai arsip.', ARRAY['pc_staff', 'pc_kepala', 'pp_kepala'])
ON CONFLICT (event_type) DO NOTHING;

-- Documentation
COMMENT ON TYPE status_proses_dakem_enum IS '
Dana Kematian workflow status enum.

Complete list of valid statuses (must match lib/supabase.ts StatusProsesDakemEnum
and lib/workflow/dana-kematian-status.ts):

  draft             — Partially filled form (on going process)          [NEW]
  dilaporkan        — Legacy: shown under the Draft stage
  verifikasi_cabang — Legacy: shown under the Draft stage
  proses_pusat      — Submitted, being verified by PP (Verifikasi Pusat)
  pending_dokumen   — Legacy: shown as Koreksi
  revisi_pusat      — Legacy: shown as Koreksi
  batal             — Canceled by branch; record kept, no deletion    [NEW]
  ditolak           — Rejected
  verified          — PP validation completed (Valid)
  penyaluran        — Approved, funds being distributed
  terima_ahli_waris — Funds handed to heir, berkas sent to Finance    [NEW]
  laporan           — Branch report uploaded, sent to Archive module  [NEW]
  selesai           — Complete

Migration 023: Added draft, batal, terima_ahli_waris, laporan for the UAT workflow.
';
