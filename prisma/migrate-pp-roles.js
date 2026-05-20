/**
 * One-time migration script: Add PP roles and Dana Kematian capability permissions.
 * Run with: node prisma/migrate-pp-roles.js
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const NEW_ROLES = [
  {
    slug: 'pc_staff',
    name: 'Staff PC',
    description: 'Staff Pengurus Cabang untuk mengelola pengajuan dana kematian.',
  },
  {
    slug: 'pc_kepala',
    name: 'Kepala PC',
    description: 'Kepala Pengurus Cabang dengan akses penuh pengelolaan dana kematian cabang.',
  },
  {
    slug: 'pp_staff',
    name: 'Staff PP',
    description: 'Staff Pusat Pelayanan untuk memverifikasi pengajuan dana kematian.',
  },
  {
    slug: 'pp_kepala',
    name: 'Kepala PP',
    description: 'Kepala Pusat Pelayanan dengan akses verifikasi dan persetujuan dana kematian.',
  },
  {
    slug: 'keuangan',
    name: 'Keuangan',
    description: 'Bagian keuangan yang mengelola penyaluran dana kematian.',
  },
];

const NEW_PERMISSIONS = [
  {
    slug: 'dana_kematian.verify_pp',
    name: 'Verifikasi PP Dana Kematian',
    description: 'Dapat memverifikasi dan menyetujui pengajuan dana kematian sebagai Pusat Pelayanan.',
  },
  {
    slug: 'dana_kematian.manage_pc',
    name: 'Kelola PC Dana Kematian',
    description: 'Dapat membuat, mengelola, dan mengajukan pengajuan dana kematian sebagai Pengurus Cabang.',
  },
  {
    slug: 'dana_kematian.access_keuangan',
    name: 'Akses Keuangan Dana Kematian',
    description: 'Dapat mengakses fitur keuangan dan menyetujui penyaluran dana kematian.',
  },
];

// Which role slugs get which capability permission
const PERMISSION_ASSIGNMENTS = {
  'dana_kematian.verify_pp': ['ketua-1', 'ketua-2', 'admin', 'administrator', 'owner', 'pp_staff', 'pp_kepala'],
  'dana_kematian.manage_pc': ['pc_staff', 'pc_kepala', 'admin', 'administrator', 'owner'],
  'dana_kematian.access_keuangan': ['keuangan', 'admin', 'administrator', 'owner'],
};

async function main() {
  console.log('Starting PP roles and Dana Kematian permissions migration...\n');

  // 1. Upsert new roles
  console.log('Upserting roles...');
  for (const role of NEW_ROLES) {
    await prisma.userRole.upsert({
      where: { slug: role.slug },
      update: {},
      create: { ...role, createdAt: new Date() },
    });
    console.log(`  ✓ Role: ${role.name} (${role.slug})`);
  }

  // 2. Upsert new permissions
  console.log('\nUpserting permissions...');
  for (const perm of NEW_PERMISSIONS) {
    await prisma.userPermission.upsert({
      where: { slug: perm.slug },
      update: {},
      create: { ...perm, createdAt: new Date() },
    });
    console.log(`  ✓ Permission: ${perm.slug}`);
  }

  // 3. Assign permissions to roles
  console.log('\nAssigning permissions to roles...');
  for (const [permSlug, roleSlugs] of Object.entries(PERMISSION_ASSIGNMENTS)) {
    const permission = await prisma.userPermission.findUnique({ where: { slug: permSlug } });
    if (!permission) {
      console.warn(`  ⚠ Permission not found: ${permSlug}`);
      continue;
    }

    for (const roleSlug of roleSlugs) {
      const role = await prisma.userRole.findUnique({ where: { slug: roleSlug } });
      if (!role) {
        console.warn(`  ⚠ Role not found, skipping: ${roleSlug}`);
        continue;
      }

      await prisma.userRolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id, assignedAt: new Date() },
      });
      console.log(`  ✓ ${roleSlug} → ${permSlug}`);
    }
  }

  console.log('\nMigration completed successfully!');
  console.log('Note: Logged-in users must re-login to see updated permissions.');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
