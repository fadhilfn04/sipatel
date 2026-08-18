/**
 * Phase 1 Database Verification Script
 *
 * Run this script to verify that Phase 1 migrations have been applied
 * to the database correctly.
 *
 * Usage: npx ts-node scripts/verify-phase1-database.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface VerificationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  details?: any;
}

const results: VerificationResult[] = [];

async function main() {
  console.log('🔍 Phase 1 Database Verification\n');
  console.log('=' .repeat(60));

  try {
    // ── CHECK 1: Database Connection ────────────────────────────────
    try {
      await prisma.$connect();
      results.push({
        check: 'Database Connection',
        status: 'PASS',
        message: 'Successfully connected to database'
      });
    } catch (error) {
      results.push({
        check: 'Database Connection',
        status: 'FAIL',
        message: 'Failed to connect to database',
        details: error
      });
      console.log('❌ Cannot proceed without database connection');
      return;
    }

    // ── CHECK 2: Dana Kematian Enum Values (Migration 015) ───────────
    try {
      const enumQuery = `
        SELECT unnest(enum_label) as status
        FROM pg_enum
        WHERE enumtypid = 'status_proses_dakem_enum'::regtype
        ORDER BY status;
      `;
      const enumResult = await prisma.$queryRawUnsafe<Array<{ status: string }>>(enumQuery);
      const enumValues = enumResult.map(r => r.status);

      const expectedValues = ['verified', 'revisi_pusat'];
      const missing = expectedValues.filter(v => !enumValues.includes(v));

      if (missing.length === 0) {
        results.push({
          check: 'Migration 015: Dana Kematian Enum',
          status: 'PASS',
          message: 'All expected enum values present (verified, revisi_pusat)'
        });
      } else {
        results.push({
          check: 'Migration 015: Dana Kematian Enum',
          status: 'FAIL',
          message: `Missing enum values: ${missing.join(', ')}`,
          details: { current: enumValues, missing }
        });
      }
    } catch (error) {
      results.push({
        check: 'Migration 015: Dana Kematian Enum',
        status: 'WARNING',
        message: 'Could not verify enum values (query failed)',
        details: error
      });
    }

    // ── CHECK 3: kode_cabang Foreign Key (Migration 017) ───────────────
    try {
      const fkQuery = `
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'anggota' AND constraint_name = 'fk_anggota_kode_cabang';
      `;
      const fkResult = await prisma.$queryRawUnsafe<Array<{ constraint_name: string }>>(fkQuery);

      if (fkResult.length > 0) {
        results.push({
          check: 'Migration 017: kode_cabang FK',
          status: 'PASS',
          message: 'Foreign key constraint fk_anggota_kode_cabang exists'
        });
      } else {
        results.push({
          check: 'Migration 017: kode_cabang FK',
          status: 'FAIL',
          message: 'Foreign key constraint fk_anggota_kode_cabang NOT found'
        });
      }
    } catch (error) {
      results.push({
        check: 'Migration 017: kode_cabang FK',
        status: 'WARNING',
        message: 'Could not verify FK constraint (query failed)',
        details: error
      });
    }

    // ── CHECK 4: Orphaned kode_cabang References ───────────────────────
    try {
      const orphanQuery = `
        SELECT COUNT(*) as count
        FROM anggota a
        LEFT JOIN master_cabang mc ON a.kode_cabang = mc.kode_cabang
        WHERE a.kode_cabang IS NOT NULL
          AND a.kode_cabang != ''
          AND a.deleted_at IS NULL
          AND mc.kode_cabang IS NULL;
      `;
      const orphanResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(orphanQuery);
      const orphanCount = Number(orphanResult[0]?.count || 0);

      if (orphanCount === 0) {
        results.push({
          check: 'Data Integrity: Orphaned kode_cabang',
          status: 'PASS',
          message: 'No orphaned kode_cabang references found'
        });
      } else {
        results.push({
          check: 'Data Integrity: Orphaned kode_cabang',
          status: 'FAIL',
          message: `Found ${orphanCount} anggota with invalid kode_cabang`,
          details: { count: orphanCount }
        });
      }
    } catch (error) {
      results.push({
        check: 'Data Integrity: Orphaned kode_cabang',
        status: 'WARNING',
        message: 'Could not check for orphaned kode_cabang',
        details: error
      });
    }

    // ── CHECK 5: Role Slug Consistency (Migrations 013/016) ────────────
    try {
      const roleQuery = `
        SELECT slug, name
        FROM "UserRole"
        WHERE slug IN ('ketua-1', 'ketua-2', 'ketua_i', 'ketua_ii')
        ORDER BY slug;
      `;
      const roleResult = await prisma.$queryRawUnsafe<Array<{ slug: string; name: string }>>(roleQuery);
      const roles = roleResult.map(r => ({ slug: r.slug, name: r.name }));

      const hasHyphenated = roles.some(r => r.slug === 'ketua-1' || r.slug === 'ketua-2');
      const hasUnderscore = roles.some(r => r.slug === 'ketua_i' || r.slug === 'ketua_ii');

      if (hasHyphenated && !hasUnderscore) {
        results.push({
          check: 'Migration 013/016: Role Slugs',
          status: 'PASS',
          message: 'Role slugs use canonical hyphenated format (ketua-1, ketua-2)',
          details: { roles }
        });
      } else if (hasUnderscore) {
        results.push({
          check: 'Migration 013/016: Role Slugs',
          status: 'FAIL',
          message: 'Role slugs still use underscore format (ketua_i, ketua_ii)',
          details: { roles, note: 'Run migration 016 to fix' }
        });
      } else {
        results.push({
          check: 'Migration 013/016: Role Slugs',
          status: 'WARNING',
          message: 'Expected roles not found in database',
          details: { roles }
        });
      }
    } catch (error) {
      results.push({
        check: 'Migration 013/016: Role Slugs',
        status: 'WARNING',
        message: 'Could not verify role slugs (query failed)',
        details: error
      });
    }

    // ── CHECK 6: master_cabang Table Exists ────────────────────────────
    try {
      const tableQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'master_cabang'
        );
      `;
      const tableResult = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(tableQuery);

      if (tableResult[0]?.exists) {
        results.push({
          check: 'master_cabang Table',
          status: 'PASS',
          message: 'master_cabang table exists'
        });
      } else {
        results.push({
          check: 'master_cabang Table',
          status: 'FAIL',
          message: 'master_cabang table does not exist'
        });
      }
    } catch (error) {
      results.push({
        check: 'master_cabang Table',
        status: 'WARNING',
        message: 'Could not verify master_cabang table',
        details: error
      });
    }

    // ── CHECK 7: nik_kepemilikan Table Structure ────────────────────────
    try {
      const columnsQuery = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'nik_kepemilikan'
        AND column_name IN ('source_anggota_id', 'heir_anggota_id')
        ORDER BY column_name;
      `;
      const columnsResult = await prisma.$queryRawUnsafe<Array<{ column_name: string; data_type: string }>>(columnsQuery);

      const hasSource = columnsResult.some(c => c.column_name === 'source_anggota_id');
      const hasHeir = columnsResult.some(c => c.column_name === 'heir_anggota_id');

      if (hasSource && hasHeir) {
        results.push({
          check: 'NIK Inheritance Table Structure',
          status: 'PASS',
          message: 'nik_kepemilikan has source_anggota_id and heir_anggota_id columns'
        });
      } else {
        results.push({
          check: 'NIK Inheritance Table Structure',
          status: 'FAIL',
          message: 'nik_kepemilikan missing expected columns',
          details: { hasSource, hasHeir, found: columnsResult }
        });
      }
    } catch (error) {
      results.push({
        check: 'NIK Inheritance Table Structure',
        status: 'WARNING',
        message: 'Could not verify nik_kepemilikan structure',
        details: error
      });
    }

    // ── PRINT RESULTS ─────────────────────────────────────────────────────
    console.log('\n📋 VERIFICATION RESULTS\n');
    console.log('=' .repeat(60));

    let passCount = 0;
    let failCount = 0;
    let warningCount = 0;

    for (const result of results) {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${icon} ${result.check}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Message: ${result.message}`);
      if (result.details && (result.status === 'FAIL' || result.status === 'WARNING')) {
        console.log(`   Details:`, JSON.stringify(result.details, null, 2));
      }
      console.log();

      if (result.status === 'PASS') passCount++;
      else if (result.status === 'FAIL') failCount++;
      else warningCount++;
    }

    console.log('=' .repeat(60));
    console.log(`\n📊 SUMMARY: ${passCount} PASS, ${failCount} FAIL, ${warningCount} WARNING\n`);

    if (failCount > 0) {
      console.log('❌ PHASE 1 NOT FULLY VERIFIED — ACTION REQUIRED');
      console.log('   Please resolve the FAIL status checks above.\n');
      process.exit(1);
    } else if (warningCount > 0) {
      console.log('⚠️ PHASE 1 VERIFIED WITH WARNINGS');
      console.log('   Review the warnings above. System should function but may need attention.\n');
      process.exit(0);
    } else {
      console.log('✅ PHASE 1 FULLY VERIFIED — READY FOR PHASE 2\n');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Verification script error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
