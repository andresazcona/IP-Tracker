const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Get JWT secret from environment
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        message: 'Please provide a valid access token in the Authorization header'
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user details from database
    const userResult = await db.query(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.is_active,
              r.name as role_name, r.permissions
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1 AND u.is_active = true`,
      [decoded.user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'User not found or inactive'
      });
    }

    const user = userResult.rows[0];
    
    // Add user info to request object
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role_name,
      permissions: user.permissions || []
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is invalid'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'The provided token has expired'
      });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      message: 'Internal server error during authentication'
    });
  }
};

// Middleware to check permissions
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please authenticate first'
      });
    }

    // Admin has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user has the required permission
    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({
        error: 'Permission denied',
        message: `You don't have permission to perform this action`,
        required_permission: permission,
        your_permissions: req.user.permissions
      });
    }

    next();
  };
};

// Middleware to check role
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please authenticate first'
      });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Access denied',
        message: `Your role (${req.user.role}) is not authorized for this action`,
        required_roles: allowedRoles
      });
    }

    next();
  };
};

// Middleware to allow access to own resources or admin
const requireOwnershipOrAdmin = (userIdParam = 'user_id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please authenticate first'
      });
    }

    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user is accessing their own resource
    const targetUserId = req.params[userIdParam] || req.body[userIdParam];
    
    if (req.user.id !== targetUserId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own resources'
      });
    }

    next();
  };
};

// Middleware for device access control
const requireDeviceAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please authenticate first'
      });
    }

    // Admin can access all devices
    if (req.user.role === 'admin' || req.user.permissions.includes('devices.read')) {
      return next();
    }

    // Check if user has access to assigned devices
    if (req.user.permissions.includes('devices.read.assigned')) {
      const deviceId = req.params.device_id || req.params.id;
      
      if (deviceId) {
        // Check if device is assigned to user
        const assignmentResult = await db.query(
          `SELECT id FROM user_device_assignments 
           WHERE user_id = $1 AND device_id = $2 AND is_active = true`,
          [req.user.id, deviceId]
        );

        if (assignmentResult.rows.length === 0) {
          return res.status(403).json({
            error: 'Device access denied',
            message: 'You do not have access to this device'
          });
        }
      }
      
      return next();
    }

    return res.status(403).json({
      error: 'Permission denied',
      message: 'You do not have permission to access devices'
    });

  } catch (error) {
    console.error('Device access control error:', error);
    return res.status(500).json({
      error: 'Access control failed',
      message: 'Internal server error during access control check'
    });
  }
};

// Generate JWT tokens
const generateTokens = (user) => {
  const payload = {
    user_id: user.id,
    username: user.username,
    role: user.role_name || user.role
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: JWT_EXPIRES_IN
  };
};

// Verify refresh token
const verifyRefreshToken = async (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if refresh token exists in database and is not revoked
    const tokenResult = await db.query(
      `SELECT rt.id, rt.user_id, rt.expires_at, rt.is_revoked,
              u.username, u.email, u.is_active,
              r.name as role_name, r.permissions
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       JOIN roles r ON u.role_id = r.id
       WHERE rt.token_hash = $1 AND rt.is_revoked = false AND rt.expires_at > CURRENT_TIMESTAMP`,
      [require('crypto').createHash('sha256').update(token).digest('hex')]
    );

    if (tokenResult.rows.length === 0) {
      throw new Error('Invalid or expired refresh token');
    }

    const tokenData = tokenResult.rows[0];
    
    if (!tokenData.is_active) {
      throw new Error('User account is inactive');
    }

    return {
      id: tokenData.user_id,
      username: tokenData.username,
      email: tokenData.email,
      role_name: tokenData.role_name,
      permissions: tokenData.permissions
    };
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

// Save refresh token to database
const saveRefreshToken = async (userId, token) => {
  const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
};

// Revoke refresh token
const revokeRefreshToken = async (token) => {
  const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
  
  await db.query(
    `UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1`,
    [tokenHash]
  );
};

// Optional middleware for public endpoints
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      const userResult = await db.query(
        `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.is_active,
                r.name as role_name, r.permissions
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1 AND u.is_active = true`,
        [decoded.user_id]
      );

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        req.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role_name,
          permissions: user.permissions || []
        };
      }
    }

    next();
  } catch (error) {
    // For optional auth, we don't return an error, just continue without user
    next();
  }
};

module.exports = {
  authenticateToken,
  requirePermission,
  requireRole,
  requireOwnershipOrAdmin,
  requireDeviceAccess,
  generateTokens,
  verifyRefreshToken,
  saveRefreshToken,
  revokeRefreshToken,
  optionalAuth,
  JWT_SECRET
};