-- ============================================================
-- SIPATEL Chat Messages Table
-- Run this in your Supabase SQL editor
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT         NOT NULL,
  user_name   TEXT         NOT NULL,
  user_avatar TEXT,
  user_email  TEXT,
  message     TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages (created_at ASC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access" ON chat_messages
  USING (TRUE)
  WITH CHECK (TRUE);
