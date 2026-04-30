/**
 * Check Dana Kematian RBAC Setup
 *
 * This script verifies that the roles and permissions are properly set up.
 */

import prisma from '@/lib/prisma';

async function checkRBACSetup() {
  console.log('🔍 Checking Dana Kematian RBAC Setup...\n');

  try {
    // Check permissions
    console.log('📝 Dana Kematian Permissions:');
    const permissions = await prisma.userPermission.findMany({
      where: {
        slug: {
          startsWith: 'dana_kematian_'
        }
      },
      orderBy: {
        slug: 'asc'
      }
    });

    if (permissions.length === 0) {
      console.log('  ❌ No Dana Kematian permissions found!');
    } else {
      console.log(`  ✅ Found ${permissions.length} permissions:`);
      permissions.forEach(p => {
        console.log(`     • ${p.slug}: ${p.name}`);
      });
    }

    console.log('\n👥 Dana Kematian Roles:');
    const roles = await prisma.userRole.findMany({
      where: {
        slug: {
          in: ['ketua-1', 'ketua-2', 'pc_staff', 'pc_kepala']
        }
      },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    if (roles.length === 0) {
      console.log('  ❌ No Dana Kematian roles found!');
    } else {
      console.log(`  ✅ Found ${roles.length} roles:\n`);
      roles.forEach(role => {
        console.log(`  📋 ${role.name} (${role.slug})`);
        console.log(`     Description: ${role.description}`);
        console.log(`     Permissions: ${role.permissions.length} total`);
        role.permissions.forEach(rp => {
          console.log(`       • ${rp.permission.slug}`);
        });
        console.log('');
      });
    }

    // Check for existing users
    console.log('👤 Current Users and Their Roles:');
    const users = await prisma.user.findMany({
      where: {
        isTrashed: false
      },
      include: {
        role: true
      },
      orderBy: {
        email: 'asc'
      },
      take: 10
    });

    if (users.length === 0) {
      console.log('  ℹ️  No users found in the system.');
    } else {
      console.log(`  ℹ️  Found ${users.length} users (showing first 10):\n`);
      users.forEach(user => {
        const roleInfo = user.role ? `${user.role.name} (${user.role.slug})` : 'No role assigned';
        console.log(`     • ${user.email} - ${roleInfo}`);
      });
    }

    console.log('\n✅ RBAC setup check completed!');

  } catch (error) {
    console.error('❌ Error checking RBAC setup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkRBACSetup();
