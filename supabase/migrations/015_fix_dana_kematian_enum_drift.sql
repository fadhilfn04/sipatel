-- =====================================================
-- MIGRATION 015: Fix Dana Kematian enum drift
-- =====================================================
-- The TypeScript types and frontend state machine use status values
-- 'verified' and 'revisi_pusat', but these were never added to the
-- PostgreSQL enum type. This causes runtime errors when the backend
-- or frontend attempts to set these statuses.
--
-- This migration adds the missing enum values without touching existing data.
-- =====================================================

-- Add missing status values to the Dana Kematian status enum
-- These values are used by the state machine:
--   'verified'      — PP has validated the claim (Waktu-3 → Waktu-4)
--   'revisi_pusat'  — PP rejected documents, cabang must re-upload (Waktu-2)
ALTER TYPE status_proses_dakem_enum ADD VALUE IF NOT EXISTS 'verified';
ALTER TYPE status_proses_dakem_enum ADD VALUE IF NOT EXISTS 'revisi_pusat';

-- Documentation
COMMENT ON TYPE status_proses_dakem_enum IS '
Dana Kematian workflow status enum.

Complete list of valid statuses (must match lib/supabase.ts StatusProsesDakemEnum
and lib/workflow/dana-kematian-state-machine.ts DanaKematianStatus):

  dilaporkan        — Death reported (initial state)
  verifikasi_cabang — PC validation in progress
  pending_dokumen   — Documents incomplete, awaiting re-upload
  revisi_pusat      — PP rejected documents, cabang must re-upload (Waktu-2)
  proses_pusat      — Submitted to PP for validation (Waktu-3)
  verified          — PP validation completed successfully (Waktu-4)
  penyaluran        — Approved, funds being distributed (Waktu-5 → Waktu-6)
  selesai           — Complete, funds delivered and reported (Waktu-7)
  ditolak           — Rejected

Migration 015: Added verified + revisi_pusat to fix enum drift.
';