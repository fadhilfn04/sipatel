/**
 * Assign Dana Kematian Permissions to Existing Ketua Roles
 *
 * This script assigns the Dana Kematian permissions to the existing
 * Ketua I and Ketua II roles in the database.
 */

import prisma from '@/lib/prisma';

async function assignKetuaPermissions() {
  console.log('🔧 Assigning Dana Kematian permissions to Ketua roles...\n');

  try {
    // Find the existing Ketua roles
    const ketua1 = await prisma.userRole.findFirst({
      where: { slug: 'ketua-1' }
    });

    const ketua2 = await prisma.userRole.findFirst({
      where: { slug: 'ketua-2' }
    });

    if (!ketua1) {
      console.log('❌ Ketua I role not found!');
    } else {
      console.log(`✅ Found Ketua I role: ${ketua1.name} (${ketua1.slug})`);
    }

    if (!ketua2) {
      console.log('❌ Ketua II role not found!');
    } else {
      console.log(`✅ Found Ketua II role: ${ketua2.name} (${ketua2.slug})`);
    }

    // Get all Dana Kematian permissions
    const permissions = await prisma.userPermission.findMany({
      where: {
        slug: {
          startsWith: 'dana_kematian_'
        }
      }
    });

    console.log(`\n✅ Found ${permissions.length} Dana Kematian permissions`);

    // Define permissions for each role
    const ketua1PermissionSlugs = [
      'dana_kematian_pp_view_all',
      'dana_kematian_pp_verify_documents',
      'dana_kematian_pp_verify_eligibility',
      'dana_kematian_pp_calculate_benefit',
      'dana_kematian_pp_approve_claim',
      'dana_kematian_pp_reject_claim',
      'dana_kematian_pp_return_claim',
      'dana_kematian_pp_process_funds'
    ];

    const ketua2PermissionSlugs = [
      'dana_kematian_pp_view_all',
      'dana_kematian_pp_verify_documents',
      'dana_kematian_pp_verify_eligibility',
      'dana_kematian_pp_calculate_benefit',
      'dana_kematian_pp_approve_claim',
      'dana_kematian_pp_return_claim'
    ];

    // Assign permissions to Ketua I
    if (ketua1) {
      console.log(`\n📋 Assigning permissions to Ketua I...`);
      let assignedCount = 0;

      for (const permissionSlug of ketua1PermissionSlugs) {
        const permission = permissions.find(p => p.slug === permissionSlug);
        if (permission) {
          const existing = await prisma.userRolePermission.findUnique({
            where: {
              roleId_permissionId: {
                roleId: ketua1.id,
                permissionId: permission.id
              }
            }
          });

          if (!existing) {
            await prisma.userRolePermission.create({
              data: {
                roleId: ketua1.id,
                permissionId: permission.id
              }
            });
            console.log(`  ✅ Assigned: ${permissionSlug}`);
            assignedCount++;
          } else {
            console.log(`  ℹ️  Already assigned: ${permissionSlug}`);
          }
        }
      }

      console.log(`\n  Summary: ${assignedCount} new permissions assigned to Ketua I`);
    }

    // Assign permissions to Ketua II
    if (ketua2) {
      console.log(`\n📋 Assigning permissions to Ketua II...`);
      let assignedCount = 0;

      for (const permissionSlug of ketua2PermissionSlugs) {
        const permission = permissions.find(p => p.slug === permissionSlug);
        if (permission) {
          const existing = await prisma.userRolePermission.findUnique({
            where: {
              roleId_permissionId: {
                roleId: ketua2.id,
                permissionId: permission.id
              }
            }
          });

          if (!existing) {
            await prisma.userRolePermission.create({
              data: {
                roleId: ketua2.id,
                permissionId: permission.id
              }
            });
            console.log(`  ✅ Assigned: ${permissionSlug}`);
            assignedCount++;
          } else {
            console.log(`  ℹ️  Already assigned: ${permissionSlug}`);
          }
        }
      }

      console.log(`\n  Summary: ${assignedCount} new permissions assigned to Ketua II`);
    }

    // Verify assignments
    console.log(`\n🔍 Verifying permission assignments...`);

    if (ketua1) {
      const ketua1Permissions = await prisma.userRolePermission.count({
        where: {
          roleId: ketua1.id,
          permission: {
            slug: {
              startsWith: 'dana_kematian_'
            }
          }
        }
      });
      console.log(`  • Ketua I: ${ketua1Permissions} Dana Kematian permissions`);
    }

    if (ketua2) {
      const ketua2Permissions = await prisma.userRolePermission.count({
        where: {
          roleId: ketua2.id,
          permission: {
            slug: {
              startsWith: 'dana_kematian_'
            }
          }
        }
      });
      console.log(`  • Ketua II: ${ketua2Permissions} Dana Kematian permissions`);
    }

    console.log('\n✅ Permission assignment completed successfully!');

  } catch (error) {
    console.error('❌ Error assigning permissions:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

assignKetuaPermissions();
