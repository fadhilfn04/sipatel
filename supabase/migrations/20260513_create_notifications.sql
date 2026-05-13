-- ============================================================
-- SIPATEL Notifications Table
-- Run this in your Supabase SQL editor
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT         NOT NULL,
  message     TEXT         NOT NULL,
  type        VARCHAR(20)  NOT NULL DEFAULT 'info',   -- info | success | warning | error
  category    VARCHAR(50)  NOT NULL DEFAULT 'system', -- dana_kematian | dana_sosial | keanggotaan | system
  event_type  VARCHAR(100),                           -- dana_kematian_created | dana_kematian_selesai | ...
  link        TEXT,                                   -- e.g. /pelayanan/dana-kematian?id=xxx
  metadata    JSONB        NOT NULL DEFAULT '{}',
  is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read     ON notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at  ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_category    ON notifications (category);

-- Allow service role full access (used by Next.js API routes via supabaseAdmin)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access" ON notifications
  USING (TRUE)
  WITH CHECK (TRUE);

-- Optional: auto-delete notifications older than 90 days
-- You can set up a Supabase cron job for this:
-- DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '90 days';
