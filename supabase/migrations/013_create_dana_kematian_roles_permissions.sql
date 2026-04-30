-- ============================================
-- Dana Kematian Roles and Permissions Setup
-- ============================================

-- This migration creates the necessary roles and permissions
-- for the Dana Kematian (Death Benefit) system RBAC

-- ============================================
-- 1. CREATE DANA KEMATIAN PERMISSIONS
-- ============================================

-- PC (Pengurus Cabang) permissions
INSERT INTO "UserPermission" (id, slug, name, description, "createdAt")
VALUES
  -- PC permissions
  (gen_random_uuid(), 'dana_kematian_pc_create', 'PC Create', 'Create new Dana Kematian applications at PC level', NOW()),
  (gen_random_uuid(), 'dana_kematian_pc_edit', 'PC Edit', 'Edit Dana Kematian applications at PC level', NOW()),
  (gen_random_uuid(), 'dana_kematian_pc_delete', 'PC Delete', 'Delete Dana Kematian applications at PC level', NOW()),
  (gen_random_uuid(), 'dana_kematian_pc_view', 'PC View', 'View Dana Kematian applications at PC level', NOW()),
  (gen_random_uuid(), 'dana_kematian_pc_submit_to_pp', 'PC Submit to PP', 'Submit validated applications to PP (Pusat)', NOW()),
  (gen_random_uuid(), 'dana_kematian_pc_validate_family', 'PC Validate Family', 'Validate family and heir information', NOW()),
  (gen_random_uuid(), 'dana_kematian_pc_communicate_heir', 'PC Communicate Heir', 'Communicate with heirs regarding their claims', NOW()),
  (gen_random_uuid(), 'dana_kematian_pc_deliver_funds', 'PC Deliver Funds', 'Deliver funds to heirs', NOW()),
  (gen_random_uuid(), 'dana_kematian_pc_create_reports', 'PC Create Reports', 'Create reports for fund delivery', NOW()),

  -- PP (Pengurus Pusat) permissions
  (gen_random_uuid(), 'dana_kematian_pp_view_all', 'PP View All', 'View all Dana Kematian applications at PP level', NOW()),
  (gen_random_uuid(), 'dana_kematian_pp_verify_documents', 'PP Verify Documents', 'Verify submitted documents', NOW()),
  (gen_random_uuid(), 'dana_kematian_pp_verify_eligibility', 'PP Verify Eligibility', 'Verify eligibility requirements', NOW()),
  (gen_random_uuid(), 'dana_kematian_pp_calculate_benefit', 'PP Calculate Benefit', 'Calculate benefit amounts', NOW()),
  (gen_random_uuid(), 'dana_kematian_pp_approve_claim', 'PP Approve Claim', 'Approve Dana Kematian claims', NOW()),
  (gen_random_uuid(), 'dana_kematian_pp_reject_claim', 'PP Reject Claim', 'Reject Dana Kematian claims', NOW()),
  (gen_random_uuid(), 'dana_kematian_pp_return_claim', 'PP Return Claim', 'Return claims to PC for corrections', NOW()),
  (gen_random_uuid(), 'dana_kematian_pp_process_funds', 'PP Process Funds', 'Process fund transfers', NOW()),

  -- Admin permissions
  (gen_random_uuid(), 'dana_kematian_admin_full_access', 'Admin Full Access', 'Full access to all Dana Kematian features', NOW())
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 2. CREATE DANA KEMATIAN ROLES
-- ============================================

-- Create Ketua I role
INSERT INTO "UserRole" (id, slug, name, description, "isProtected", "isDefault", "createdAt")
VALUES (
  gen_random_uuid(),
  'ketua_i',
  'Ketua I',
  'Pimpinan Pusat - Level 1, full access ke verifikasi PP',
  true,
  false,
  NOW()
)
ON CONFLICT (slug) DO NOTHING;

-- Create Ketua II role
INSERT INTO "UserRole" (id, slug, name, description, "isProtected", "isDefault", "createdAt")
VALUES (
  gen_random_uuid(),
  'ketua_ii',
  'Ketua II',
  'Pimpinan Pusat - Level 2, dapat verifikasi tapi butuh approval Ketua I untuk amounts > Rp 100 juta',
  true,
  false,
  NOW()
)
ON CONFLICT (slug) DO NOTHING;

-- Create PC Staff role
INSERT INTO "UserRole" (id, slug, name, description, "isProtected", "isDefault", "createdAt")
VALUES (
  gen_random_uuid(),
  'pc_staff',
  'Staff PC',
  'Staff Pengurus Cabang, dapat mengelola pengajuan di tingkat cabang',
  true,
  false,
  NOW()
)
ON CONFLICT (slug) DO NOTHING;

-- Create PC Kepala role
INSERT INTO "UserRole" (id, slug, name, description, "isProtected", "isDefault", "createdAt")
VALUES (
  gen_random_uuid(),
  'pc_kepala',
  'Kepala PC',
  'Kepala Pengurus Cabang, sama dengan staff PC plus bisa delete',
  true,
  false,
  NOW()
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 3. ASSIGN PERMISSIONS TO ROLES
-- ============================================

-- Ketua I permissions (full PP access)
INSERT INTO "UserRolePermission" ("roleId", "permissionId", "assignedAt")
SELECT
  (SELECT id FROM "UserRole" WHERE slug = 'ketua_i'),
  id,
  NOW()
FROM "UserPermission"
WHERE slug IN (
  'dana_kematian_pp_view_all',
  'dana_kematian_pp_verify_documents',
  'dana_kematian_pp_verify_eligibility',
  'dana_kematian_pp_calculate_benefit',
  'dana_kematian_pp_approve_claim',
  'dana_kematian_pp_reject_claim',
  'dana_kematian_pp_return_claim',
  'dana_kematian_pp_process_funds'
)
ON CONFLICT DO NOTHING;

-- Ketua II permissions (limited PP access)
INSERT INTO "UserRolePermission" ("roleId", "permissionId", "assignedAt")
SELECT
  (SELECT id FROM "UserRole" WHERE slug = 'ketua_ii'),
  id,
  NOW()
FROM "UserPermission"
WHERE slug IN (
  'dana_kematian_pp_view_all',
  'dana_kematian_pp_verify_documents',
  'dana_kematian_pp_verify_eligibility',
  'dana_kematian_pp_calculate_benefit',
  'dana_kematian_pp_approve_claim',
  'dana_kematian_pp_return_claim'
)
ON CONFLICT DO NOTHING;

-- PC Staff permissions
INSERT INTO "UserRolePermission" ("roleId", "permissionId", "assignedAt")
SELECT
  (SELECT id FROM "UserRole" WHERE slug = 'pc_staff'),
  id,
  NOW()
FROM "UserPermission"
WHERE slug IN (
  'dana_kematian_pc_view',
  'dana_kematian_pc_create',
  'dana_kematian_pc_edit',
  'dana_kematian_pc_validate_family',
  'dana_kematian_pc_communicate_heir',
  'dana_kematian_pc_submit_to_pp',
  'dana_kematian_pc_deliver_funds',
  'dana_kematian_pc_create_reports'
)
ON CONFLICT DO NOTHING;

-- PC Kepala permissions (same as staff + delete)
INSERT INTO "UserRolePermission" ("roleId", "permissionId", "assignedAt")
SELECT
  (SELECT id FROM "UserRole" WHERE slug = 'pc_kepala'),
  id,
  NOW()
FROM "UserPermission"
WHERE slug IN (
  'dana_kematian_pc_view',
  'dana_kematian_pc_create',
  'dana_kematian_pc_edit',
  'dana_kematian_pc_delete',
  'dana_kematian_pc_validate_family',
  'dana_kematian_pc_communicate_heir',
  'dana_kematian_pc_submit_to_pp',
  'dana_kematian_pc_deliver_funds',
  'dana_kematian_pc_create_reports'
)
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. UPDATE EXISTING USERS IF NEEDED
-- ============================================

-- Note: This section is commented out to avoid accidentally modifying existing users.
-- Uncomment and modify if you need to update existing users to new roles.

-- UPDATE "User"
-- SET "roleId" = (SELECT id FROM "UserRole" WHERE slug = 'ketua_i')
-- WHERE email = 'ketua1@example.com';

-- ============================================
-- 5. VERIFICATION QUERIES
-- ============================================

-- Verify permissions were created
-- SELECT slug, name FROM "UserPermission" WHERE slug LIKE 'dana_kematian_%' ORDER BY slug;

-- Verify roles were created
-- SELECT slug, name, description FROM "UserRole" WHERE slug IN ('ketua_i', 'ketua_ii', 'pc_staff', 'pc_kepala') ORDER BY slug;

-- Verify role permissions
-- SELECT
--   r.slug as role_slug,
--   r.name as role_name,
--   p.slug as permission_slug,
--   p.name as permission_name
-- FROM "UserRole" r
-- JOIN "UserRolePermission" urp ON r.id = urp."roleId"
-- JOIN "UserPermission" p ON urp."permissionId" = p.id
-- WHERE r.slug IN ('ketua_i', 'ketua_ii', 'pc_staff', 'pc_kepala')
-- ORDER BY r.slug, p.slug;

-- ============================================
-- END OF MIGRATION
-- ============================================
