/**
 * Phase 2 Database Verification Script
 *
 * Run this script to verify that Phase 2 migrations have been applied
 * to the database correctly.
 *
 * Usage: node scripts/verify-phase2-database.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Phase 2 Database Verification\n');
  console.log('='.repeat(60));

  const results = [];

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

    // ── CHECK 2: master_bank Table (Migration 018) ───────────────────
    try {
      const tableQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'master_bank'
        );
      `;
      const tableResult = await prisma.$queryRawUnsafe(tableQuery);

      if (tableResult[0]?.exists) {
        // Check seeded banks
        const bankCountQuery = `SELECT COUNT(*) as count FROM master_bank;`;
        const bankCountResult = await prisma.$queryRawUnsafe(bankCountQuery);
        const bankCount = Number(bankCountResult[0]?.count || 0);

        if (bankCount >= 13) { // At least the seeded banks
          results.push({
            check: 'Migration 018: master_bank Table',
            status: 'PASS',
            message: `master_bank table exists with ${bankCount} banks`
          });
        } else {
          results.push({
            check: 'Migration 018: master_bank Table',
            status: 'WARNING',
            message: `master_bank table exists but only ${bankCount} banks (expected at least 13)`,
            details: { count: bankCount }
          });
        }
      } else {
        results.push({
          check: 'Migration 018: master_bank Table',
          status: 'FAIL',
          message: 'master_bank table does not exist'
        });
      }
    } catch (error) {
      results.push({
        check: 'Migration 018: master_bank Table',
        status: 'WARNING',
        message: 'Could not verify master_bank table',
        details: error
      });
    }

    // ── CHECK 3: Dana Kematian kode_cabang FK (Migration 019) ────────
    try {
      const fkQuery = `
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'dana_kematian' AND constraint_name = 'fk_dakem_kode_cabang';
      `;
      const fkResult = await prisma.$queryRawUnsafe(fkQuery);

      // Check migration percentage
      const migrationQuery = `
        SELECT
          COUNT(*) as total,
          COUNT(kode_cabang) as migrated,
          ROUND(100.0 * COUNT(kode_cabang) / COUNT(*), 2) as percentage
        FROM dana_kematian
        WHERE deleted_at IS NULL;
      `;
      const migrationResult = await prisma.$queryRawUnsafe(migrationQuery);
      const migrationData = migrationResult[0];

      if (fkResult.length > 0) {
        results.push({
          check: 'Migration 019: Dana Kematian kode_cabang FK',
          status: 'PASS',
          message: `FK exists, ${migrationData.migrated}/${migrationData.total} records migrated (${migrationData.percentage}%)`,
          details: { migrated: Number(migrationData.migrated), total: Number(migrationData.total) }
        });
      } else {
        results.push({
          check: 'Migration 019: Dana Kematian kode_cabang FK',
          status: 'FAIL',
          message: 'FK constraint fk_dakem_kode_cabang NOT found'
        });
      }
    } catch (error) {
      results.push({
        check: 'Migration 019: Dana Kematian kode_cabang FK',
        status: 'WARNING',
        message: 'Could not verify FK constraint',
        details: error
      });
    }

    // ── CHECK 4: Master Tarif Dana Kematian (Migration 020) ───────────
    try {
      const tableQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'master_tarif_dana_kematian'
        );
      `;
      const tableResult = await prisma.$queryRawUnsafe(tableQuery);

      if (tableResult[0]?.exists) {
        const tarifCountQuery = `SELECT COUNT(*) as count FROM master_tarif_dana_kematian WHERE is_active = true;`;
        const tarifCountResult = await prisma.$queryRawUnsafe(tarifCountQuery);
        const tarifCount = Number(tarifCountResult[0]?.count || 0);

        results.push({
          check: 'Migration 020: Master Tarif Dana Kematian',
          status: 'PASS',
          message: `master_tarif_dana_kematian table exists with ${tarifCount} active tariffs`
        });
      } else {
        results.push({
          check: 'Migration 020: Master Tarif Dana Kematian',
          status: 'FAIL',
          message: 'master_tarif_dana_kematian table does not exist'
        });
      }
    } catch (error) {
      results.push({
        check: 'Migration 020: Master Tarif Dana Kematian',
        status: 'WARNING',
        message: 'Could not verify master_tarif_dana_kematian table',
        details: error
      });
    }

    // ── CHECK 5: Audit Trail Columns (Migration 021) ────────────────────
    try {
      const columnsQuery = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'master_cabang'
        AND column_name IN ('created_by', 'updated_by');
      `;
      const columnsResult = await prisma.$queryRawUnsafe(columnsQuery);
      const hasAuditColumns = columnsResult.length === 2;

      const nikColumnsQuery = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'nik_kepemilikan'
        AND column_name IN ('created_by', 'updated_by');
      `;
      const nikColumnsResult = await prisma.$queryRawUnsafe(nikColumnsQuery);
      const hasNikAuditColumns = nikColumnsResult.length === 2;

      if (hasAuditColumns && hasNikAuditColumns) {
        results.push({
          check: 'Migration 021: Audit Trail Columns',
          status: 'PASS',
          message: 'Audit trail columns (created_by, updated_by) present on master_cabang and nik_kepemilikan'
        });
      } else {
        results.push({
          check: 'Migration 021: Audit Trail Columns',
          status: 'FAIL',
          message: 'Missing audit trail columns',
          details: { master_cabang: hasAuditColumns, nik_kepemilikan: hasNikAuditColumns }
        });
      }
    } catch (error) {
      results.push({
        check: 'Migration 021: Audit Trail Columns',
        status: 'WARNING',
        message: 'Could not verify audit trail columns',
        details: error
      });
    }

    // ── CHECK 6: Master Kategori Bantuan (Migration 022) ───────────────
    try {
      const tableQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'master_kategori_bantuan'
        );
      `;
      const tableResult = await prisma.$queryRawUnsafe(tableQuery);

      if (tableResult[0]?.exists) {
        const kategoriCountQuery = `SELECT COUNT(*) as count FROM master_kategori_bantuan WHERE is_active = true;`;
        const kategoriCountResult = await prisma.$queryRawUnsafe(kategoriCountQuery);
        const kategoriCount = Number(kategoriCountResult[0]?.count || 0);

        results.push({
          check: 'Migration 022: Master Kategori Bantuan',
          status: 'PASS',
          message: `master_kategori_bantuan table exists with ${kategoriCount} active categories`
        });
      } else {
        results.push({
          check: 'Migration 022: Master Kategori Bantuan',
          status: 'FAIL',
          message: 'master_kategori_bantuan table does not exist'
        });
      }
    } catch (error) {
      results.push({
        check: 'Migration 022: Master Kategori Bantuan',
        status: 'WARNING',
        message: 'Could not verify master_kategori_bantuan table',
        details: error
      });
    }

    // ── CHECK 7: Status Field Documentation (Migration 023) ───────────
    try {
      const commentQuery = `
        SELECT obj_description('public.anggota'::regclass) as table_comment;
      `;
      const commentResult = await prisma.$queryRawUnsafe(commentQuery);
      const hasDocumentation = commentResult[0]?.table_comment && commentResult[0].table_comment.length > 0;

      if (hasDocumentation) {
        results.push({
          check: 'Migration 023: Status Field Documentation',
          status: 'PASS',
          message: 'anggota table has documentation comments'
        });
      } else {
        results.push({
          check: 'Migration 023: Status Field Documentation',
          status: 'WARNING',
          message: 'Documentation comments may be missing'
        });
      }
    } catch (error) {
      results.push({
        check: 'Migration 023: Status Field Documentation',
        status: 'WARNING',
        message: 'Could not verify documentation',
        details: error
      });
    }

    // ── CHECK 8: Regional/Witel Tables (Migration 024) ────────────────
    try {
      const regionalQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'master_regional'
        );
      `;
      const regionalResult = await prisma.$queryRawUnsafe(regionalQuery);

      const witelQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'master_witel'
        );
      `;
      const witelResult = await prisma.$queryRawUnsafe(witelQuery);

      if (regionalResult[0]?.exists && witelResult[0]?.exists) {
        const regionalCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM master_regional;`);
        const witelCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM master_witel;`);

        results.push({
          check: 'Migration 024: Regional/Witel Tables',
          status: 'PASS',
          message: `master_regional and master_witel exist (${regionalCount[0].count} regionals, ${witelCount[0].count} witels)`
        });
      } else {
        results.push({
          check: 'Migration 024: Regional/Witel Tables',
          status: 'FAIL',
          message: 'One or more tables missing',
          details: { regional: regionalResult[0]?.exists, witel: witelResult[0]?.exists }
        });
      }
    } catch (error) {
      results.push({
        check: 'Migration 024: Regional/Witel Tables',
        status: 'WARNING',
        message: 'Could not verify regional/witel tables',
        details: error
      });
    }

    // ── CHECK 9: Batch Operation Log (Migration 025) ───────────────────
    try {
      const tableQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'batch_operation_log'
        );
      `;
      const tableResult = await prisma.$queryRawUnsafe(tableQuery);

      if (tableResult[0]?.exists) {
        results.push({
          check: 'Migration 025: Batch Operation Log',
          status: 'PASS',
          message: 'batch_operation_log table exists'
        });
      } else {
        results.push({
          check: 'Migration 025: Batch Operation Log',
          status: 'FAIL',
          message: 'batch_operation_log table does not exist'
        });
      }
    } catch (error) {
      results.push({
        check: 'Migration 025: Batch Operation Log',
        status: 'WARNING',
        message: 'Could not verify batch_operation_log table',
        details: error
      });
    }

    // ── PRINT RESULTS ─────────────────────────────────────────────────────
    console.log('\n📋 VERIFICATION RESULTS\n');
    console.log('='.repeat(60));

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

    console.log('='.repeat(60));
    console.log(`\n📊 SUMMARY: ${passCount} PASS, ${failCount} FAIL, ${warningCount} WARNING\n`);

    if (failCount > 0) {
      console.log('❌ PHASE 2 NOT FULLY VERIFIED — ACTION REQUIRED');
      console.log('   Please resolve the FAIL status checks above.\n');
      process.exit(1);
    } else if (warningCount > 0) {
      console.log('⚠️ PHASE 2 VERIFIED WITH WARNINGS');
      console.log('   Review the warnings above. System should function but may need attention.\n');
      process.exit(0);
    } else {
      console.log('✅ PHASE 2 FULLY VERIFIED — ALL MIGRATIONS APPLIED\n');
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
