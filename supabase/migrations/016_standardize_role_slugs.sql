-- =====================================================
-- MIGRATION 016: Standardize role slugs (ketua_i → ketua-1)
-- =====================================================
-- The codebase uses hyphenated slugs (ketua-1, ketua-2) in:
--   - lib/rbac.ts (ROLES constant)
--   - scripts/setup-rbac.ts
--   - scripts/assign-ketua-permissions.ts
--   - scripts/check-rbac-setup.ts
--
-- But migration 013 and scripts/setup-dana-kematian-rbac.ts (before fix)
-- created roles with underscore slugs (ketua_i, ketua_ii).
--
-- This migration renames existing underscore slugs to the canonical
-- hyphen slugs so that all code references resolve correctly.
--
-- SAFE: Uses UPDATE, not DELETE. Preserves role IDs, permissions, and user assignments.
-- Only affects roles that match the old underscore slug pattern.
-- =====================================================

-- Rename ketua_i → ketua-1 (if the underscore version exists and hyphen doesn't)
UPDATE "UserRole"
SET slug = 'ketua-1'
WHERE slug = 'ketua_i'
  AND NOT EXISTS (SELECT 1 FROM "UserRole" WHERE slug = 'ketua-1');

-- Rename ketua_ii → ketua-2 (if the underscore version exists and hyphen doesn't)
UPDATE "UserRole"
SET slug = 'ketua-2'
WHERE slug = 'ketua_ii'
  AND NOT EXISTS (SELECT 1 FROM "UserRole" WHERE slug = 'ketua-2');

-- If BOTH underscore and hyphen versions exist (unlikely but possible),
-- the hyphen version takes precedence. We leave the underscore version as-is
-- to avoid breaking existing references. The administrator should manually
-- merge/duplicate permissions and reassign users.

-- Verification queries (commented out for production):
-- SELECT id, slug, name FROM "UserRole" WHERE slug IN ('ketua_i', 'ketua_ii', 'ketua-1', 'ketua-2') ORDER BY slug;