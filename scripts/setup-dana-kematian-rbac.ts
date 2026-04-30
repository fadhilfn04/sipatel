/**
 * Setup Dana Kematian RBAC Roles and Permissions
 *
 * This script creates the necessary roles and permissions for the
 * Dana Kematian (Death Benefit) system.
 *
 * Usage:
 *   npx ts-node scripts/setup-dana-kematian-rbac.ts
 */

import prisma from '@/lib/prisma';

async function setupDanaKematianRBAC() {
  console.log('🔧 Setting up Dana Kematian RBAC...');

  try {
    // ============================================
    // 1. CREATE PERMISSIONS
    // ============================================
    console.log('📝 Creating permissions...');

    const permissions = [
      // PC permissions
      { slug: 'dana_kematian_pc_create', name: 'PC Create', description: 'Create new Dana Kematian applications at PC level' },
      { slug: 'dana_kematian_pc_edit', name: 'PC Edit', description: 'Edit Dana Kematian applications at PC level' },
      { slug: 'dana_kematian_pc_delete', name: 'PC Delete', description: 'Delete Dana Kematian applications at PC level' },
      { slug: 'dana_kematian_pc_view', name: 'PC View', description: 'View Dana Kematian applications at PC level' },
      { slug: 'dana_kematian_pc_submit_to_pp', name: 'PC Submit to PP', description: 'Submit validated applications to PP (Pusat)' },
      { slug: 'dana_kematian_pc_validate_family', name: 'PC Validate Family', description: 'Validate family and heir information' },
      { slug: 'dana_kematian_pc_communicate_heir', name: 'PC Communicate Heir', description: 'Communicate with heirs regarding their claims' },
      { slug: 'dana_kematian_pc_deliver_funds', name: 'PC Deliver Funds', description: 'Deliver funds to heirs' },
      { slug: 'dana_kematian_pc_create_reports', name: 'PC Create Reports', description: 'Create reports for fund delivery' },

      // PP permissions
      { slug: 'dana_kematian_pp_view_all', name: 'PP View All', description: 'View all Dana Kematian applications at PP level' },
      { slug: 'dana_kematian_pp_verify_documents', name: 'PP Verify Documents', description: 'Verify submitted documents' },
      { slug: 'dana_kematian_pp_verify_eligibility', name: 'PP Verify Eligibility', description: 'Verify eligibility requirements' },
      { slug: 'dana_kematian_pp_calculate_benefit', name: 'PP Calculate Benefit', description: 'Calculate benefit amounts' },
      { slug: 'dana_kematian_pp_approve_claim', name: 'PP Approve Claim', description: 'Approve Dana Kematian claims' },
      { slug: 'dana_kematian_pp_reject_claim', name: 'PP Reject Claim', description: 'Reject Dana Kematian claims' },
      { slug: 'dana_kematian_pp_return_claim', name: 'PP Return Claim', description: 'Return claims to PC for corrections' },
      { slug: 'dana_kematian_pp_process_funds', name: 'PP Process Funds', description: 'Process fund transfers' },

      // Admin permissions
      { slug: 'dana_kematian_admin_full_access', name: 'Admin Full Access', description: 'Full access to all Dana Kematian features' },
    ];

    const createdPermissions = [];
    for (const permission of permissions) {
      const existing = await prisma.userPermission.findUnique({
        where: { slug: permission.slug }
      });

      if (!existing) {
        const created = await prisma.userPermission.create({
          data: permission
        });
        createdPermissions.push(created);
        console.log(`  ✅ Created permission: ${created.slug}`);
      } else {
        createdPermissions.push(existing);
        console.log(`  ℹ️  Permission already exists: ${existing.slug}`);
      }
    }

    // ============================================
    // 2. CREATE ROLES
    // ============================================
    console.log('👥 Creating roles...');

    const roles = [
      {
        slug: 'ketua_i',
        name: 'Ketua I',
        description: 'Pimpinan Pusat - Level 1, full access ke verifikasi PP',
        isProtected: true,
        permissionSlugs: [
          'dana_kematian_pp_view_all',
          'dana_kematian_pp_verify_documents',
          'dana_kematian_pp_verify_eligibility',
          'dana_kematian_pp_calculate_benefit',
          'dana_kematian_pp_approve_claim',
          'dana_kematian_pp_reject_claim',
          'dana_kematian_pp_return_claim',
          'dana_kematian_pp_process_funds'
        ]
      },
      {
        slug: 'ketua_ii',
        name: 'Ketua II',
        description: 'Pimpinan Pusat - Level 2, dapat verifikasi tapi butuh approval Ketua I untuk amounts > Rp 100 juta',
        isProtected: true,
        permissionSlugs: [
          'dana_kematian_pp_view_all',
          'dana_kematian_pp_verify_documents',
          'dana_kematian_pp_verify_eligibility',
          'dana_kematian_pp_calculate_benefit',
          'dana_kematian_pp_approve_claim',
          'dana_kematian_pp_return_claim'
        ]
      },
      {
        slug: 'pc_staff',
        name: 'Staff PC',
        description: 'Staff Pengurus Cabang, dapat mengelola pengajuan di tingkat cabang',
        isProtected: true,
        permissionSlugs: [
          'dana_kematian_pc_view',
          'dana_kematian_pc_create',
          'dana_kematian_pc_edit',
          'dana_kematian_pc_validate_family',
          'dana_kematian_pc_communicate_heir',
          'dana_kematian_pc_submit_to_pp',
          'dana_kematian_pc_deliver_funds',
          'dana_kematian_pc_create_reports'
        ]
      },
      {
        slug: 'pc_kepala',
        name: 'Kepala PC',
        description: 'Kepala Pengurus Cabang, sama dengan staff PC plus bisa delete',
        isProtected: true,
        permissionSlugs: [
          'dana_kematian_pc_view',
          'dana_kematian_pc_create',
          'dana_kematian_pc_edit',
          'dana_kematian_pc_delete',
          'dana_kematian_pc_validate_family',
          'dana_kematian_pc_communicate_heir',
          'dana_kematian_pc_submit_to_pp',
          'dana_kematian_pc_deliver_funds',
          'dana_kematian_pc_create_reports'
        ]
      }
    ];

    const createdRoles = [];
    for (const roleData of roles) {
      // Check by slug first
      let existing = await prisma.userRole.findUnique({
        where: { slug: roleData.slug }
      });

      // If not found by slug, check by name
      if (!existing) {
        existing = await prisma.userRole.findFirst({
          where: { name: roleData.name }
        });
      }

      let role;
      if (!existing) {
        role = await prisma.userRole.create({
          data: {
            slug: roleData.slug,
            name: roleData.name,
            description: roleData.description,
            isProtected: roleData.isProtected,
            isDefault: false
          }
        });
        console.log(`  ✅ Created role: ${role.slug}`);
      } else {
        role = existing;
        console.log(`  ℹ️  Role already exists: ${role.slug} (checking permissions...)`);
      }

      // Assign permissions to role
      for (const permissionSlug of roleData.permissionSlugs) {
        const permission = createdPermissions.find(p => p.slug === permissionSlug);
        if (permission) {
          const existingAssignment = await prisma.userRolePermission.findUnique({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId: permission.id
              }
            }
          });

          if (!existingAssignment) {
            await prisma.userRolePermission.create({
              data: {
                roleId: role.id,
                permissionId: permission.id
              }
            });
            console.log(`    ✅ Assigned permission ${permissionSlug} to role ${role.slug}`);
          } else {
            console.log(`    ℹ️  Permission ${permissionSlug} already assigned to role ${role.slug}`);
          }
        }
      }

      createdRoles.push(role);
    }

    // ============================================
    // 3. DISPLAY SUMMARY
    // ============================================
    console.log('\n📊 Setup Summary:');
    console.log(`  ✅ Permissions: ${createdPermissions.length} total`);
    console.log(`  ✅ Roles: ${createdRoles.length} total`);

    console.log('\n📋 Available Roles:');
    for (const role of createdRoles) {
      const permissionCount = await prisma.userRolePermission.count({
        where: { roleId: role.id }
      });
      console.log(`  • ${role.name} (${role.slug}): ${permissionCount} permissions`);
    }

    console.log('\n✅ Dana Kematian RBAC setup completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('  1. Assign roles to users using the admin panel or directly in the database');
    console.log('  2. Test the verification page with different user roles');
    console.log('  3. Ensure the permission system is working correctly');

  } catch (error) {
    console.error('❌ Error setting up Dana Kematian RBAC:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
setupDanaKematianRBAC();
