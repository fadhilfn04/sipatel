-- Migration: Enable Row Level Security (RLS) on all business tables
-- Security Fix: Prevent unauthenticated public access via anon key

-- Enable RLS on core tables
ALTER TABLE anggota ENABLE ROW LEVEL SECURITY;
ALTER TABLE anggota_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE dana_kematian ENABLE ROW LEVEL SECURITY;
ALTER TABLE dana_sosial ENABLE ROW LEVEL SECURITY;
ALTER TABLE pembayaran_sumbangan ENABLE ROW LEVEL SECURITY;
ALTER TABLE arus_kas ENABLE ROW LEVEL SECURITY;
ALTER TABLE laporan_periode ENABLE ROW LEVEL SECURITY;

-- By default, when RLS is enabled and NO policies exist, access is DENIED for all roles
-- except superusers and roles with bypassrls attribute (like service_role).
-- This perfectly matches the architecture where all data access should go through
-- the Next.js API using supabaseAdmin (service_role) or custom auth logic, 
-- and frontend should NOT query Supabase directly using the anon key.

-- (Optional) If you DO want the frontend to read some public config tables directly:
-- CREATE POLICY "Public read access to master_cabang" ON master_cabang FOR SELECT USING (true);
