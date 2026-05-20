-- ============================================================
-- Notification Routing Config
-- Allows dynamic per-event notification targeting by role.
-- ============================================================

-- 1. Add target_role_slugs to notifications table
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS target_role_slugs TEXT[] DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_target_roles
  ON notifications USING GIN(target_role_slugs);

-- 2. Notification routing rules table
CREATE TABLE IF NOT EXISTS notification_routing (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type       VARCHAR(100) NOT NULL UNIQUE,
  event_label      TEXT         NOT NULL,
  description      TEXT,
  target_role_slugs TEXT[]      NOT NULL DEFAULT '{}',
  is_enabled       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_routing_event
  ON notification_routing (event_type);

ALTER TABLE notification_routing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON notification_routing
  USING (TRUE) WITH CHECK (TRUE);

-- 3. Default routing rules
INSERT INTO notification_routing (event_type, event_label, description, target_role_slugs) VALUES
  ('dana_kematian_created',
   'Data Dana Kematian Dibuat',
   'Dikirim ke PP ketika Staff PC / Kepala PC menambah data pengajuan baru.',
   ARRAY['pp_kepala']),

  ('dana_kematian_proses_pusat',
   'Pengajuan Dikirim ke Pusat',
   'Dikirim ke PP ketika Staff PC / Kepala PC mengajukan berkas ke Pusat.',
   ARRAY['pp_kepala']),

  ('dana_kematian_verified',
   'Pengajuan Disetujui PP',
   'Dikirim ke Keuangan ketika Kepala PP menyetujui pengajuan dana kematian.',
   ARRAY['keuangan']),

  ('dana_kematian_penyaluran',
   'Penyaluran Disetujui Keuangan',
   'Dikirim ke PP ketika Keuangan menyetujui penyaluran dana.',
   ARRAY['pp_kepala']),

  ('dana_kematian_selesai',
   'Transfer Dana Dikonfirmasi',
   'Dikirim ke PC ketika Kepala PP mengkonfirmasi transfer dana ke ahli waris.',
   ARRAY['pc_staff', 'pc_kepala']),

  ('dana_kematian_ditolak',
   'Pengajuan Ditolak',
   'Dikirim ke PC ketika pengajuan dana kematian ditolak.',
   ARRAY['pc_staff', 'pc_kepala']),

  ('dana_kematian_updated',
   'Data Pengajuan Diperbarui',
   'Dikirim ketika data pengajuan diperbarui secara umum.',
   ARRAY[]::TEXT[]),

  ('dokumen_verified',
   'Dokumen Terverifikasi',
   'Dikirim ketika dokumen pengajuan diverifikasi oleh PP.',
   ARRAY['pc_staff', 'pc_kepala'])

ON CONFLICT (event_type) DO NOTHING;
