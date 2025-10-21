const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const db = require('../config/database');
const {
  authenticateToken,
  generateTokens,
  verifyRefreshToken,
  saveRefreshToken,
  revokeRefreshToken
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

// Register new user
router.post('/register', [
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
    .optional()
    .isIn(['admin', 'manager', 'user', 'viewer'])
    .withMessage('Invalid role specified')
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

    const { username, email, password, first_name, last_name, role = 'user' } = req.body;

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
      `INSERT INTO users (username, email, password_hash, first_name, last_name, role_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, first_name, last_name, created_at`,
      [username, email, passwordHash, first_name, last_name, roleId]
    );

    const newUser = userResult.rows[0];

    // Log audit event
    await logAuditEvent(newUser.id, 'user.register', 'user', newUser.id, {
      username: newUser.username,
      email: newUser.email,
      role
    }, req);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        role,
        created_at: newUser.created_at
      }
    });

  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({
      error: 'Failed to register user',
      message: error.message
    });
  }
});

// Login
router.post('/login', [
  body('username_or_email')
    .notEmpty()
    .withMessage('Username or email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
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

    const { username_or_email, password } = req.body;

    // Find user by username or email
    const userResult = await db.query(
      `SELECT u.id, u.username, u.email, u.password_hash, u.first_name, u.last_name, u.is_active,
              r.name as role_name, r.permissions
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE (u.username = $1 OR u.email = $1) AND u.is_active = true`,
      [username_or_email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Username/email or password is incorrect'
      });
    }

    const user = userResult.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      // Log failed login attempt
      await logAuditEvent(user.id, 'auth.login.failed', 'user', user.id, {
        reason: 'invalid_password'
      }, req);

      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Username/email or password is incorrect'
      });
    }

    // Generate tokens
    const tokens = generateTokens(user);

    // Save refresh token
    await saveRefreshToken(user.id, tokens.refresh_token);

    // Update last login
    await db.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Log successful login
    await logAuditEvent(user.id, 'auth.login.success', 'user', user.id, {
      username: user.username
    }, req);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role_name,
        permissions: user.permissions
      },
      tokens
    });

  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      error: 'Login failed',
      message: error.message
    });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        error: 'Refresh token required',
        message: 'Please provide a refresh token'
      });
    }

    // Verify refresh token
    const user = await verifyRefreshToken(refresh_token);

    // Generate new tokens
    const tokens = generateTokens(user);

    // Revoke old refresh token
    await revokeRefreshToken(refresh_token);

    // Save new refresh token
    await saveRefreshToken(user.id, tokens.refresh_token);

    // Log token refresh
    await logAuditEvent(user.id, 'auth.token.refresh', 'user', user.id, null, req);

    res.json({
      message: 'Token refreshed successfully',
      tokens
    });

  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(401).json({
      error: 'Invalid refresh token',
      message: error.message
    });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (refresh_token) {
      // Revoke refresh token
      await revokeRefreshToken(refresh_token);
    }

    // Log logout
    await logAuditEvent(req.user.id, 'auth.logout', 'user', req.user.id, null, req);

    res.json({
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: error.message
    });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userResult = await db.query(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.last_login, u.created_at,
              r.name as role_name, r.description as role_description, r.permissions
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Get assigned devices count
    const deviceCountResult = await db.query(
      `SELECT COUNT(*) as device_count
       FROM user_device_assignments
       WHERE user_id = $1 AND is_active = true`,
      [req.user.id]
    );

    const deviceCount = parseInt(deviceCountResult.rows[0].device_count);

    res.json({
      profile: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role_name,
        role_description: user.role_description,
        permissions: user.permissions,
        last_login: user.last_login,
        created_at: user.created_at,
        assigned_devices_count: deviceCount
      }
    });

  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({
      error: 'Failed to get user profile',
      message: error.message
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, [
  body('first_name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('First name must be less than 100 characters'),
  body('last_name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Last name must be less than 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
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

    const { first_name, last_name, email } = req.body;
    const updates = {};
    const params = [];
    let paramIndex = 1;

    // Build dynamic update query
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

    if (email !== undefined) {
      // Check if email is already taken by another user
      const emailCheck = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, req.user.id]
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

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'No updates provided',
        message: 'Please provide at least one field to update'
      });
    }

    // Add user ID and timestamp
    params.push(req.user.id);
    const whereClause = `$${paramIndex}`;

    const updateQuery = `
      UPDATE users 
      SET ${Object.values(updates).join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${whereClause}
      RETURNING id, username, email, first_name, last_name, updated_at
    `;

    const result = await db.query(updateQuery, params);
    const updatedUser = result.rows[0];

    // Log profile update
    await logAuditEvent(req.user.id, 'user.profile.update', 'user', req.user.id, {
      updated_fields: Object.keys(updates)
    }, req);

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: error.message
    });
  }
});

// Change password
router.put('/change-password', authenticateToken, [
  body('current_password')
    .notEmpty()
    .withMessage('Current password is required'),
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

    const { current_password, new_password } = req.body;

    // Get current password hash
    const userResult = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({
        error: 'Invalid current password',
        message: 'The current password you provided is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(new_password, saltRounds);

    // Update password
    await db.query(
      `UPDATE users 
       SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newPasswordHash, req.user.id]
    );

    // Revoke all existing refresh tokens for security
    await db.query(
      'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1',
      [req.user.id]
    );

    // Log password change
    await logAuditEvent(req.user.id, 'user.password.change', 'user', req.user.id, null, req);

    res.json({
      message: 'Password changed successfully',
      note: 'All existing sessions have been invalidated. Please log in again.'
    });

  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      error: 'Failed to change password',
      message: error.message
    });
  }
});

module.exports = router;