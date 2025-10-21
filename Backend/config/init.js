const bcrypt = require('bcryptjs');
const db = require('../config/database');

/**
 * Initialize system with default admin user if it doesn't exist
 */
async function initializeSystem() {
  try {
    console.log('🔧 Checking system initialization...');
    
    // Check if admin user exists
    const adminCheck = await db.query(
      `SELECT u.id FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE r.name = 'admin' AND u.is_active = true`
    );

    if (adminCheck.rows.length === 0) {
      console.log('🔐 No admin user found, creating default admin...');
      
      // Get admin role ID
      const roleResult = await db.query(
        'SELECT id FROM roles WHERE name = $1',
        ['admin']
      );

      if (roleResult.rows.length === 0) {
        console.error('❌ Admin role not found in database. Please run the database setup script.');
        return false;
      }

      const adminRoleId = roleResult.rows[0].id;

      // Create default admin user
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash('admin123', saltRounds);

      await db.query(
        `INSERT INTO users (username, email, password_hash, first_name, last_name, role_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['admin', 'admin@localhost', passwordHash, 'System', 'Administrator', adminRoleId]
      );

      console.log('✅ Default admin user created successfully');
      console.log('   Username: admin');
      console.log('   Email: admin@localhost');
      console.log('   Password: admin123');
      console.log('   ⚠️  IMPORTANT: Change this password immediately!');
    } else {
      console.log('✅ Admin user already exists');
    }

    return true;
  } catch (error) {
    console.error('❌ Error during system initialization:', error.message);
    return false;
  }
}

/**
 * Check database schema version and required tables
 */
async function checkDatabaseSchema() {
  try {
    console.log('📊 Checking database schema...');

    // Check for required tables
    const requiredTables = ['users', 'roles', 'devices', 'user_device_assignments', 'audit_logs'];
    const existingTables = await db.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [requiredTables]
    );

    const existingTableNames = existingTables.rows.map(row => row.table_name);
    const missingTables = requiredTables.filter(table => !existingTableNames.includes(table));

    if (missingTables.length > 0) {
      console.error('❌ Missing required database tables:', missingTables);
      console.error('   Please run the database setup script:');
      console.error('   npm run setup-db');
      return false;
    }

    console.log('✅ All required database tables found');
    return true;
  } catch (error) {
    console.error('❌ Error checking database schema:', error.message);
    return false;
  }
}

/**
 * Ensure default roles exist
 */
async function ensureDefaultRoles() {
  try {
    console.log('👥 Checking default roles...');

    const defaultRoles = [
      {
        name: 'admin',
        description: 'Full system administrator',
        permissions: [
          'users.create', 'users.read', 'users.update', 'users.delete',
          'devices.create', 'devices.read', 'devices.update', 'devices.delete',
          'assignments.create', 'assignments.read', 'assignments.update', 'assignments.delete',
          'system.manage', 'audit.read'
        ]
      },
      {
        name: 'manager',
        description: 'Device and user manager',
        permissions: [
          'users.read', 'users.update',
          'devices.create', 'devices.read', 'devices.update',
          'assignments.create', 'assignments.read', 'assignments.update', 'assignments.delete'
        ]
      },
      {
        name: 'user',
        description: 'Regular user with assigned devices',
        permissions: ['devices.read.assigned', 'profile.read', 'profile.update']
      },
      {
        name: 'viewer',
        description: 'Read-only access to assigned devices',
        permissions: ['devices.read.assigned', 'profile.read']
      }
    ];

    for (const role of defaultRoles) {
      const existingRole = await db.query(
        'SELECT id FROM roles WHERE name = $1',
        [role.name]
      );

      if (existingRole.rows.length === 0) {
        await db.query(
          'INSERT INTO roles (name, description, permissions) VALUES ($1, $2, $3)',
          [role.name, role.description, role.permissions]
        );
        console.log(`✅ Created role: ${role.name}`);
      }
    }

    console.log('✅ Default roles verified');
    return true;
  } catch (error) {
    console.error('❌ Error ensuring default roles:', error.message);
    return false;
  }
}

/**
 * Run complete system initialization
 */
async function runSystemInit() {
  console.log('🚀 Starting system initialization...');
  
  try {
    // Test database connection
    await db.testConnection();
    
    // Check database schema
    const schemaOk = await checkDatabaseSchema();
    if (!schemaOk) {
      return false;
    }

    // Ensure default roles exist
    const rolesOk = await ensureDefaultRoles();
    if (!rolesOk) {
      return false;
    }

    // Initialize system (create admin if needed)
    const initOk = await initializeSystem();
    if (!initOk) {
      return false;
    }

    console.log('✨ System initialization completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ System initialization failed:', error.message);
    return false;
  }
}

module.exports = {
  initializeSystem,
  checkDatabaseSchema,
  ensureDefaultRoles,
  runSystemInit
};