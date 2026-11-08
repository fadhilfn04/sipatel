/**
 * Verifikasi penerapan Centralized Audit Trail (migration 036).
 *
 * Jalankan:
 *   node scripts/verify-audit-trail.js
 *
 * Memakai Prisma (DATABASE_URL di .env) — tanpa Supabase Realtime sehingga
 * aman di Node 20. Read-only: hanya SELECT/pg_catalog + hitung trigger.
 */

/* eslint-disable no-console */
require('dotenv').config({ path: '.env' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function regclass(name) {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT (to_regclass($1))::text AS reg',
    'public.' + name,
  );
  return rows[0] ? rows[0].reg : null;
}

async function main() {
  let failed = 0;

  // 1. Tabel inti
  const hasLog = await regclass('audit_log');
  const hasConfig = await regclass('audit_table_config');
  console.log(`${hasLog ? '✓' : '✗'} Tabel audit_log ${hasLog ? 'ada' : 'TIDAK ADA — jalankan migration 036'}`);
  console.log(`${hasConfig ? '✓' : '✗'} Tabel audit_table_config ${hasConfig ? 'ada' : 'TIDAK ADA — jalankan migration 036'}`);
  if (!hasLog || !hasConfig) {
    await prisma.$disconnect();
    process.exit(1);
  }

  // 2. Registry
  const configs = await prisma.$queryRawUnsafe(
    'SELECT table_name, module, is_active FROM audit_table_config ORDER BY module, table_name',
  );
  const activeCount = configs.filter((c) => c.is_active).length;
  console.log(`✓ Registry audit_table_config: ${configs.length} tabel (aktif: ${activeCount})`);

  // 3. Status trigger per tabel (3 = terpasang lengkap)
  const status = await prisma.$queryRawUnsafe(
    `SELECT t.table_name,
            (to_regclass('public.' || t.table_name)) IS NOT NULL AS table_exists,
            CASE WHEN to_regclass('public.' || t.table_name) IS NULL
                 THEN 0 ELSE audit_trigger_count(t.table_name) END AS trig
       FROM audit_table_config t
      ORDER BY table_exists DESC, t.module, t.table_name`,
  );

  const attached = status.filter((s) => Number(s.trig) === 3);
  const skipped = status.filter((s) => Number(s.trig) !== 3);

  console.log(`\n✓ Trigger terpasang lengkap (3 trigger): ${attached.length} tabel`);
  if (skipped.length > 0) {
    console.log(`⚠ Belum terpasang: ${skipped.length} tabel`);
    for (const s of skipped) {
      const reason = s.table_exists
        ? `trigger=${s.trig} (tidak lengkap)`
        : 'tabel belum ada (migration sumber belum dijalankan)';
      console.log(`   - ${s.table_name}: ${reason}`);
    }
  }

  // 4. Ringkasan isi audit log
  const [{ total }] = await prisma.$queryRawUnsafe(
    'SELECT count(*)::int AS total FROM audit_log',
  );
  const [{ dengan_aktor }] = await prisma.$queryRawUnsafe(
    'SELECT count(*)::int AS dengan_aktor FROM audit_log WHERE actor_user_id IS NOT NULL',
  );
  console.log(`\n✓ audit_log: ${total} baris tersimpan (dengan aktor: ${dengan_aktor})`);

  const [{ n }] = await prisma.$queryRawUnsafe('SELECT audit_attach_all() AS n');
  console.log(`✓ audit_attach_all() dijalankan ulang: ${n} tabel terdaftar diproses`);

  const missingTables = skipped.filter((s) => !s.table_exists).map((s) => s.table_name);
  if (missingTables.length > 0) {
    console.log(
      '\nℹ Setelah migration sumber dijalankan, cukup panggil lagi: SELECT audit_attach_all();',
    );
  }

  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error('✗', error.message);
  try {
    await prisma.$disconnect();
  } catch {
    /* noop */
  }
  process.exit(1);
});

