/**
 * Seed permission audit trail (audit_trail_view/export/manage) ke database
 * dan assign ke role administrator. Idempotent — aman dijalankan berulang.
 *
 * Jalankan:
 *   node scripts/seed-audit-permissions.js
 */

/* eslint-disable no-console */
require('dotenv').config({ path: '.env' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const AUDIT_PERMISSIONS = [
  {
    slug: 'audit_trail_view',
    name: 'Lihat Riwayat Aktivitas',
    description: 'Melihat audit trail / riwayat aktivitas seluruh modul',
  },
  {
    slug: 'audit_trail_export',
    name: 'Ekspor Riwayat Aktivitas',
    description: 'Mengekspor audit trail ke CSV',
  },
  {
    slug: 'audit_trail_manage',
    name: 'Kelola Audit Trail',
    description: 'Mengelola konfigurasi audit trail (retensi/masking)',
  },
];

async function main() {
  // 1. Upsert permission.
  for (const p of AUDIT_PERMISSIONS) {
    await prisma.userPermission.upsert({
      where: { slug: p.slug },
      update: { name: p.name, description: p.description },
      create: { ...p },
    });
    console.log(`✓ Permission ${p.slug} tersedia`);
  }

  // 2. Assign ke role administrator (view + export + manage).
  const adminRole = await prisma.userRole.findFirst({
    where: { slug: 'administrator' },
  });

  if (adminRole) {
    for (const p of AUDIT_PERMISSIONS) {
      const perm = await prisma.userPermission.findUnique({ where: { slug: p.slug } });
      if (!perm) continue;
      await prisma.userRolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: adminRole.id, permissionId: perm.id },
      });
    }
    console.log('✓ Role administrator: 3 permission audit ter-assign');
  } else {
    console.log('⚠ Role "administrator" tidak ditemukan — hanya permission yang dibuat.');
  }

  // 3. Ringkasan.
  const total = await prisma.userPermission.count({
    where: { slug: { in: AUDIT_PERMISSIONS.map((p) => p.slug) } },
  });
  console.log(`Selesai. Permission audit tersedia: ${total}/3`);
}

main()
  .catch((e) => {
    console.error('✗', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
