const prisma = require('./lib/prisma');

async function checkDatabase() {
  try {
    console.log('Checking database...');
    
    // Check if any roles exist
    const roleCount = await prisma.userRole.count();
    console.log(`Total roles: ${roleCount}`);
    
    // Check for default role
    const defaultRole = await prisma.userRole.findFirst({
      where: { isDefault: true }
    });
    
    if (defaultRole) {
      console.log('✓ Default role found:', defaultRole.name, defaultRole.id);
    } else {
      console.log('✗ No default role found!');
      console.log('You need to create a default role first.');
    }
    
    // List all roles
    const allRoles = await prisma.userRole.findMany();
    console.log('All roles:', allRoles.map(r => ({ name: r.name, isDefault: r.isDefault })));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
