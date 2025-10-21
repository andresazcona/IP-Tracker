const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param, query, validationResult } = require('express-validator');
const router = express.Router();
const db = require('../config/database');
const {
  authenticateToken,
  requirePermission,
  requireRole,
  requireOwnershipOrAdmin,
  requireDeviceAccess
} = require('../middleware/auth');

// Helper function to get client IP
const getClientIP = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null);
};

// Helper function to log audit events
const logAuditEvent = async (userId, action, resourceType = null, resourceId = null, details = null, req = null) => {
  try {
    const ip = req ? getClientIP(req) : null;
    const userAgent = req ? req.headers['user-agent'] : null;
    
    await db.query(
      `SELECT log_audit_event($1, $2, $3, $4, $5, $6, $7)`,
      [userId, action, resourceType, resourceId, details ? JSON.stringify(details) : null, ip, userAgent]
    );
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
};

// Get all users (with pagination and filtering)
router.get('/', authenticateToken, requirePermission('users.read'), [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('role')
    .optional()
    .isIn(['admin', 'manager', 'user', 'viewer'])
    .withMessage('Invalid role filter'),
  query('search')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { role, search, is_active } = req.query;

    // Build dynamic WHERE clause
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (role) {
      conditions.push(`r.name = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(u.username ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (is_active !== undefined) {
      conditions.push(`u.is_active = $${paramIndex}`);
      params.push(is_active === 'true');
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get users with pagination
    const usersQuery = `
      SELECT 
        u.id, u.username, u.email, u.first_name, u.last_name, u.is_active, 
        u.last_login, u.created_at, u.updated_at,
        r.name as role_name, r.description as role_description,
        (SELECT COUNT(*) FROM user_device_assignments uda WHERE uda.user_id = u.id AND uda.is_active = true) as assigned_devices_count
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const usersResult = await db.query(usersQuery, params);

    const totalPages = Math.ceil(total / limit);

    res.json({
      users: usersResult.rows,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_items: total,
        items_per_page: limit,
        has_next: page < totalPages,
        has_prev: page > 1
      },
      filters: {
        role,
        search,
        is_active
      }
    });

  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({
      error: 'Failed to get users',
      message: error.message
    });
  }
});

// Get user by ID
router.get('/:user_id', authenticateToken, requirePermission('users.read'), [
  param('user_id')
    .isUUID()
    .withMessage('Invalid user ID format')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { user_id } = req.params;

    const userResult = await db.query(
      `SELECT 
        u.id, u.username, u.email, u.first_name, u.last_name, u.is_active, 
        u.last_login, u.password_changed_at, u.created_at, u.updated_at,
        r.name as role_name, r.description as role_description, r.permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1`,
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The specified user does not exist'
      });
    }

    const user = userResult.rows[0];

    // Get assigned devices
    const devicesResult = await db.query(
      `SELECT 
        d.id, d.device_name, d.device_type, d.mac_address, d.serial_number, d.model, d.location,
        uda.assigned_at, uda.notes as assignment_notes,
        ds.status as connection_status, ds.last_ping, ds.current_ip
      FROM user_device_assignments uda
      JOIN devices d ON uda.device_id = d.id
      LEFT JOIN device_status ds ON d.id = ds.device_id
      WHERE uda.user_id = $1 AND uda.is_active = true AND d.is_active = true
      ORDER BY uda.assigned_at DESC`,
      [user_id]
    );

    res.json({
      user: {
        ...user,
        assigned_devices: devicesResult.rows,
        assigned_devices_count: devicesResult.rows.length
      }
    });

  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({
      error: 'Failed to get user',
      message: error.message
    });
  }
});

// Create new user
router.post('/', authenticateToken, requirePermission('users.create'), [
  body('username')
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-50 characters long and contain only letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('first_name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('First name must be less than 100 characters'),
  body('last_name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Last name must be less than 100 characters'),
  body('role')
    .isIn(['admin', 'manager', 'user', 'viewer'])
    .withMessage('Invalid role specified'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { username, email, password, first_name, last_name, role, is_active = true } = req.body;

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id, username, email FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      const existing = existingUser.rows[0];
      const field = existing.username === username ? 'username' : 'email';
      return res.status(409).json({
        error: 'User already exists',
        message: `A user with this ${field} already exists`,
        field
      });
    }

    // Get role ID
    const roleResult = await db.query(
      'SELECT id FROM roles WHERE name = $1',
      [role]
    );

    if (roleResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid role',
        message: 'The specified role does not exist'
      });
    }

    const roleId = roleResult.rows[0].id;

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userResult = await db.query(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, role_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, username, email, first_name, last_name, is_active, created_at`,
      [username, email, passwordHash, first_name, last_name, roleId, is_active]
    );

    const newUser = userResult.rows[0];

    // Log audit event
    await logAuditEvent(req.user.id, 'user.create', 'user', newUser.id, {
      username: newUser.username,
      email: newUser.email,
      role,
      created_by: req.user.username
    }, req);

    res.status(201).json({
      message: 'User created successfully',
      user: {
        ...newUser,
        role_name: role
      }
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      error: 'Failed to create user',
      message: error.message
    });
  }
});

// Update user
router.put('/:user_id', authenticateToken, requirePermission('users.update'), [
  param('user_id')
    .isUUID()
    .withMessage('Invalid user ID format'),
  body('username')
    .optional()
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-50 characters long and contain only letters, numbers, and underscores'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('first_name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('First name must be less than 100 characters'),
  body('last_name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Last name must be less than 100 characters'),
  body('role')
    .optional()
    .isIn(['admin', 'manager', 'user', 'viewer'])
    .withMessage('Invalid role specified'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { user_id } = req.params;
    const { username, email, first_name, last_name, role, is_active } = req.body;

    // Check if user exists
    const existingUser = await db.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [user_id]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The specified user does not exist'
      });
    }

    // Prevent users from deactivating themselves
    if (req.user.id === user_id && is_active === false) {
      return res.status(400).json({
        error: 'Cannot deactivate yourself',
        message: 'You cannot deactivate your own account'
      });
    }

    const updates = {};
    const params = [];
    let paramIndex = 1;

    // Build dynamic update query
    if (username !== undefined) {
      // Check if username is already taken
      const usernameCheck = await db.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, user_id]
      );

      if (usernameCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'Username already taken',
          message: 'This username is already used by another user'
        });
      }

      updates.username = `username = $${paramIndex}`;
      params.push(username);
      paramIndex++;
    }

    if (email !== undefined) {
      // Check if email is already taken
      const emailCheck = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, user_id]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'Email already taken',
          message: 'This email is already used by another user'
        });
      }

      updates.email = `email = $${paramIndex}`;
      params.push(email);
      paramIndex++;
    }

    if (first_name !== undefined) {
      updates.first_name = `first_name = $${paramIndex}`;
      params.push(first_name);
      paramIndex++;
    }

    if (last_name !== undefined) {
      updates.last_name = `last_name = $${paramIndex}`;
      params.push(last_name);
      paramIndex++;
    }

    if (role !== undefined) {
      // Get role ID
      const roleResult = await db.query(
        'SELECT id FROM roles WHERE name = $1',
        [role]
      );

      if (roleResult.rows.length === 0) {
        return res.status(400).json({
          error: 'Invalid role',
          message: 'The specified role does not exist'
        });
      }

      updates.role_id = `role_id = $${paramIndex}`;
      params.push(roleResult.rows[0].id);
      paramIndex++;
    }

    if (is_active !== undefined) {
      updates.is_active = `is_active = $${paramIndex}`;
      params.push(is_active);
      paramIndex++;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'No updates provided',
        message: 'Please provide at least one field to update'
      });
    }

    // Add user ID and timestamp
    params.push(user_id);
    const whereClause = `$${paramIndex}`;

    const updateQuery = `
      UPDATE users 
      SET ${Object.values(updates).join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${whereClause}
      RETURNING id, username, email, first_name, last_name, is_active, updated_at
    `;

    const result = await db.query(updateQuery, params);
    const updatedUser = result.rows[0];

    // Log audit event
    await logAuditEvent(req.user.id, 'user.update', 'user', user_id, {
      updated_fields: Object.keys(updates),
      updated_by: req.user.username
    }, req);

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      error: 'Failed to update user',
      message: error.message
    });
  }
});

// Delete user (hard delete - permanent removal)
router.delete('/:user_id', authenticateToken, requirePermission('users.delete'), [
  param('user_id')
    .isUUID()
    .withMessage('Invalid user ID format')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { user_id } = req.params;

    // Prevent users from deleting themselves
    if (req.user.id === user_id) {
      return res.status(400).json({
        error: 'Cannot delete yourself',
        message: 'You cannot delete your own account'
      });
    }

    // Check if user exists
    const userResult = await db.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The specified user does not exist'
      });
    }

    const user = userResult.rows[0];

    // Hard delete - delete all related records first
    // Delete user device assignments
    await db.query(
      'DELETE FROM user_device_assignments WHERE user_id = $1',
      [user_id]
    );

    // Delete refresh tokens
    await db.query(
      'DELETE FROM refresh_tokens WHERE user_id = $1',
      [user_id]
    );

    // Delete audit logs for this user (optional - might want to keep for compliance)
    // await db.query(
    //   'DELETE FROM audit_logs WHERE user_id = $1',
    //   [user_id]
    // );

    // Finally delete the user
    await db.query(
      'DELETE FROM users WHERE id = $1',
      [user_id]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'user.delete', 'user', user_id, {
      username: user.username,
      email: user.email,
      deleted_by: req.user.username
    }, req);

    res.json({
      message: 'User deleted permanently',
      note: 'User and all related data have been permanently removed from the database',
      deleted_user: {
        id: user_id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      error: 'Failed to delete user',
      message: error.message
    });
  }
});

// Reset user password
router.post('/:user_id/reset-password', authenticateToken, requirePermission('users.update'), [
  param('user_id')
    .isUUID()
    .withMessage('Invalid user ID format'),
  body('new_password')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { user_id } = req.params;
    const { new_password } = req.body;

    // Check if user exists
    const userResult = await db.query(
      'SELECT id, username FROM users WHERE id = $1',
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The specified user does not exist'
      });
    }

    const user = userResult.rows[0];

    // Hash new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(new_password, saltRounds);

    // Update password
    await db.query(
      `UPDATE users 
       SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [passwordHash, user_id]
    );

    // Revoke all existing refresh tokens for security
    await db.query(
      'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1',
      [user_id]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'user.password.reset', 'user', user_id, {
      username: user.username,
      reset_by: req.user.username
    }, req);

    res.json({
      message: 'Password reset successfully',
      note: 'All existing sessions for this user have been invalidated'
    });

  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({
      error: 'Failed to reset password',
      message: error.message
    });
  }
});

// Get user's assigned devices
router.get('/:user_id/devices', authenticateToken, requireDeviceAccess, [
  param('user_id')
    .isUUID()
    .withMessage('Invalid user ID format')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { user_id } = req.params;

    // Check access - users can only see their own devices unless they're admin
    if (req.user.role !== 'admin' && req.user.id !== user_id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own assigned devices'
      });
    }

    const devicesResult = await db.query(
      `SELECT 
        d.id, d.device_name, d.device_type, d.mac_address, d.serial_number, 
        d.model, d.location, d.description, d.status as device_status,
        uda.assigned_at, uda.notes as assignment_notes,
        ds.status as connection_status, ds.last_ping, ds.current_ip, ds.last_online,
        ds.ping_count, ds.uptime_percentage
      FROM user_device_assignments uda
      JOIN devices d ON uda.device_id = d.id
      LEFT JOIN device_status ds ON d.id = ds.device_id
      WHERE uda.user_id = $1 AND uda.is_active = true AND d.is_active = true
      ORDER BY uda.assigned_at DESC`,
      [user_id]
    );

    res.json({
      devices: devicesResult.rows,
      total_devices: devicesResult.rows.length
    });

  } catch (error) {
    console.error('Error getting user devices:', error);
    res.status(500).json({
      error: 'Failed to get user devices',
      message: error.message
    });
  }
});

module.exports = router;