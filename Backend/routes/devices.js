const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const router = express.Router();
const db = require('../config/database');
const {
  authenticateToken,
  requirePermission,
  requireRole,
  requireOwnershipOrAdmin,
  requireDeviceAccess,
  optionalAuth
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

// Mark devices as offline if they haven't pinged recently
const markOfflineDevices = async () => {
  try {
    const result = await db.query('SELECT mark_offline_devices_simple()');
    return result.rows[0].mark_offline_devices_simple || 0;
  } catch (error) {
    console.error('Error marking offline devices:', error);
    return 0;
  }
};

// Ping endpoint (public, no auth)
router.post('/ping', [
  body('device_name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Device name is required and must be 1-100 characters'),
  body('ip_address')
    .optional()
    .isIP()
    .withMessage('Invalid IP address format'),
  body('public_ip')
    .optional()
    .isIP()
    .withMessage('Invalid public IP address format'),
  body('local_ip')
    .optional()
    .isIP()
    .withMessage('Invalid local IP address format'),
  body('wifi_network')
    .optional()
    .isLength({ max: 100 })
    .withMessage('WiFi network name must be less than 100 characters'),
  body('port')
    .optional()
    .isInt({ min: 1, max: 65535 })
    .withMessage('Port must be a valid port number'),
  body('response_time_ms')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Response time must be a positive integer')
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

    const {
      device_name,
      ip_address,
      public_ip,
      local_ip,
      wifi_network,
      port,
      response_time_ms
    } = req.body;

    // Get client IP if not provided
    const clientIP = ip_address || getClientIP(req);
    const userAgent = req.headers['user-agent'];

    // Find or create device
    let deviceResult = await db.query(
      'SELECT id FROM devices WHERE device_name = $1',
      [device_name]
    );

    let deviceId;
    if (deviceResult.rows.length === 0) {
      // Create new device
      const newDeviceResult = await db.query(
        `INSERT INTO devices (device_name, device_type, description, status, is_active)
         VALUES ($1, 'raspberry_pi', 'Auto-created from ping', 'active', true)
         RETURNING id`,
        [device_name]
      );
      deviceId = newDeviceResult.rows[0].id;
    } else {
      deviceId = deviceResult.rows[0].id;
    }

    // Log the ping
    await db.query(
      `INSERT INTO ip_logs (device_id, ip_address, public_ip, local_ip, wifi_network, port, user_agent, response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [deviceId, clientIP, public_ip, local_ip, wifi_network, port, userAgent, response_time_ms]
    );

    res.json({
      success: true,
      message: 'Ping recorded successfully',
      device_id: deviceId,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Ping error:', error);
    res.status(500).json({
      error: 'Failed to process ping',
      message: error.message
    });
  }
});

// Get all devices (public endpoint with optional auth for enhanced info)
router.get('/', optionalAuth, [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'maintenance', 'retired'])
    .withMessage('Invalid status filter'),
  query('device_type')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Device type filter too long')
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

    // Mark offline devices before querying
    await markOfflineDevices();

    const { limit = 20, offset = 0, status, device_type } = req.query;

    // Build base query
    let selectFields = `
      d.id, d.device_name, d.device_type, d.mac_address, d.description,
      d.is_active, d.created_at, d.updated_at,
      ds.current_ip, ds.current_public_ip, ds.current_local_ip,
      ds.current_wifi_network, ds.last_ping, ds.last_online,
      ds.ping_count, ds.status as connection_status, ds.uptime_percentage,
      CASE 
        WHEN ds.last_ping > CURRENT_TIMESTAMP - INTERVAL '3 minutes' THEN 'online'
        WHEN ds.last_ping IS NOT NULL THEN 'offline'
        ELSE 'never_connected'
      END as real_time_status
    `;

    // Add inventory fields for authenticated users with appropriate permissions
    if (req.user && (req.user.role === 'admin' || req.user.permissions.includes('devices.read'))) {
      selectFields += `, 
        d.serial_number, d.model, d.location, d.notes, d.purchase_date, d.status as device_status
      `;
    }

    // Build WHERE conditions
    let whereConditions = ['d.is_active = true'];
    let queryParams = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      whereConditions.push(`d.status = $${paramCount}`);
      queryParams.push(status);
    }

    if (device_type) {
      paramCount++;
      whereConditions.push(`d.device_type = $${paramCount}`);
      queryParams.push(device_type);
    }

    // Add pagination parameters
    paramCount++;
    const limitParam = paramCount;
    queryParams.push(limit);

    paramCount++;
    const offsetParam = paramCount;
    queryParams.push(offset);

    const countQuery = `
      FROM devices d
      WHERE ${whereConditions.join(' AND ')}
    `;

    const selectQuery = `
      FROM devices d
      LEFT JOIN device_status ds ON d.id = ds.device_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY d.device_name ASC
    `;

    // Get total count (simpler query without JOIN for count)
    const countResult = await db.query(
      `SELECT COUNT(*) ${countQuery}`,
      queryParams.slice(0, -2) // Remove limit and offset for count
    );
    const totalDevices = parseInt(countResult.rows[0].count);

    // Get devices with pagination
    const devicesResult = await db.query(
      `SELECT ${selectFields} ${selectQuery} LIMIT $${limitParam} OFFSET $${offsetParam}`,
      queryParams
    );

    res.json({
      devices: devicesResult.rows,
      pagination: {
        total: totalDevices,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(totalDevices / limit)
      }
    });

  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({
      error: 'Failed to retrieve devices',
      message: error.message
    });
  }
});

// Get device by ID
router.get('/:device_id', requireDeviceAccess, [
  param('device_id')
    .isUUID()
    .withMessage('Invalid device ID format')
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

    const { device_id } = req.params;

    // Mark offline devices before querying
    await markOfflineDevices();

    let selectFields = `
      d.id, d.device_name, d.device_type, d.mac_address, d.description,
      d.is_active, d.created_at, d.updated_at,
      ds.current_ip, ds.current_public_ip, ds.current_local_ip,
      ds.current_wifi_network, ds.last_ping, ds.last_online,
      ds.ping_count, ds.status as connection_status, ds.uptime_percentage,
      CASE 
        WHEN ds.last_ping > CURRENT_TIMESTAMP - INTERVAL '3 minutes' THEN 'online'
        WHEN ds.last_ping IS NOT NULL THEN 'offline'
        ELSE 'never_connected'
      END as real_time_status
    `;

    // Add inventory fields for authenticated users with appropriate permissions
    if (req.user && (req.user.role === 'admin' || req.user.permissions.includes('devices.read'))) {
      selectFields += `, 
        d.serial_number, d.model, d.location, d.notes, d.purchase_date, d.status as device_status
      `;
    }

    const result = await db.query(
      `SELECT ${selectFields}
       FROM devices d
       LEFT JOIN device_status ds ON d.id = ds.device_id
       WHERE d.id = $1 AND d.is_active = true`,
      [device_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Device not found',
        message: 'No active device found with the specified ID'
      });
    }

    res.json({
      device: result.rows[0]
    });

  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({
      error: 'Failed to retrieve device',
      message: error.message
    });
  }
});

// Create new device (inventory management)
router.post('/', authenticateToken, requirePermission('devices.create'), [
  body('device_name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Device name must be 1-100 characters long'),
  body('device_type')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Device type must be less than 50 characters'),
  body('mac_address')
    .optional()
    .matches(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)
    .withMessage('Invalid MAC address format'),
  body('serial_number')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Serial number must be less than 100 characters'),
  body('model')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Model must be less than 100 characters'),
  body('location')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Location must be less than 255 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'maintenance', 'retired'])
    .withMessage('Invalid status')
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

    const {
      device_name,
      device_type = 'raspberry_pi',
      mac_address,
      serial_number,
      model,
      location,
      description,
      notes,
      status = 'active'
    } = req.body;

    // Check if device already exists
    const existingDevice = await db.query(
      'SELECT id, device_name FROM devices WHERE device_name = $1',
      [device_name]
    );

    if (existingDevice.rows.length > 0) {
      return res.status(409).json({
        error: 'Device already exists',
        message: `A device with name "${device_name}" already exists`,
        existing_device_id: existingDevice.rows[0].id
      });
    }

    // Check for MAC address conflicts if provided
    if (mac_address) {
      const macConflict = await db.query(
        'SELECT id, device_name FROM devices WHERE mac_address = $1',
        [mac_address]
      );

      if (macConflict.rows.length > 0) {
        return res.status(409).json({
          error: 'MAC address conflict',
          message: `MAC address "${mac_address}" is already assigned to device "${macConflict.rows[0].device_name}"`
        });
      }
    }

    // Check for serial number conflicts if provided
    if (serial_number) {
      const serialConflict = await db.query(
        'SELECT id, device_name FROM devices WHERE serial_number = $1',
        [serial_number]
      );

      if (serialConflict.rows.length > 0) {
        return res.status(409).json({
          error: 'Serial number conflict',
          message: `Serial number "${serial_number}" is already assigned to device "${serialConflict.rows[0].device_name}"`
        });
      }
    }

    // Insert new device
    const result = await db.query(
      `INSERT INTO devices (
        device_name, device_type, mac_address, serial_number, model, location,
        description, notes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING id, device_name, device_type, mac_address, serial_number, model, 
                 location, description, notes, status, created_at`,
      [device_name, device_type, mac_address, serial_number, model, location,
       description, notes, status]
    );

    const newDevice = result.rows[0];

    // Log audit event
    await logAuditEvent(req.user.id, 'device.create', 'device', newDevice.id, {
      device_name: newDevice.device_name,
      device_type: newDevice.device_type
    }, req);

    res.status(201).json({
      message: 'Device created successfully',
      device: newDevice
    });

  } catch (error) {
    console.error('Create device error:', error);
    res.status(500).json({
      error: 'Failed to create device',
      message: error.message
    });
  }
});

// Update device
router.put('/:device_id', authenticateToken, requirePermission('devices.update'), [
  param('device_id')
    .isUUID()
    .withMessage('Invalid device ID format'),
  body('device_name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Device name must be 1-100 characters long'),
  body('device_type')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Device type must be less than 50 characters'),
  body('mac_address')
    .optional()
    .matches(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)
    .withMessage('Invalid MAC address format'),
  body('serial_number')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Serial number must be less than 100 characters'),
  body('model')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Model must be less than 100 characters'),
  body('location')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Location must be less than 255 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'maintenance', 'retired'])
    .withMessage('Invalid status')
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

    const { device_id } = req.params;
    const updates = req.body;

    // Check if device exists
    const deviceCheck = await db.query(
      'SELECT id, device_name, is_active FROM devices WHERE id = $1',
      [device_id]
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Device not found'
      });
    }

    if (!deviceCheck.rows[0].is_active) {
      return res.status(404).json({
        error: 'Device not found',
        message: 'Device has been deleted'
      });
    }

    // Check for conflicts if updating unique fields
    if (updates.device_name) {
      const nameConflict = await db.query(
        'SELECT id FROM devices WHERE device_name = $1 AND id != $2',
        [updates.device_name, device_id]
      );

      if (nameConflict.rows.length > 0) {
        return res.status(409).json({
          error: 'Device name conflict',
          message: `A device with name "${updates.device_name}" already exists`
        });
      }
    }

    if (updates.mac_address) {
      const macConflict = await db.query(
        'SELECT id, device_name FROM devices WHERE mac_address = $1 AND id != $2',
        [updates.mac_address, device_id]
      );

      if (macConflict.rows.length > 0) {
        return res.status(409).json({
          error: 'MAC address conflict',
          message: `MAC address "${updates.mac_address}" is already assigned to another device`
        });
      }
    }

    if (updates.serial_number) {
      const serialConflict = await db.query(
        'SELECT id, device_name FROM devices WHERE serial_number = $1 AND id != $2',
        [updates.serial_number, device_id]
      );

      if (serialConflict.rows.length > 0) {
        return res.status(409).json({
          error: 'Serial number conflict',
          message: `Serial number "${updates.serial_number}" is already assigned to another device`
        });
      }
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 0;

    const allowedFields = [
      'device_name', 'device_type', 'mac_address', 'serial_number', 
      'model', 'location', 'description', 'notes', 'status'
    ];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        paramCount++;
        updateFields.push(`${key} = $${paramCount}`);
        updateValues.push(value);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update'
      });
    }

    // Add updated_at timestamp
    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    updateValues.push(new Date());

    // Add device_id for WHERE clause
    paramCount++;
    updateValues.push(device_id);

    const result = await db.query(
      `UPDATE devices 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount} AND is_active = true
       RETURNING id, device_name, device_type, mac_address, serial_number, model, 
                 location, description, notes, status, created_at, updated_at`,
      updateValues
    );

    const updatedDevice = result.rows[0];

    // Log audit event
    await logAuditEvent(req.user.id, 'device.update', 'device', device_id, updates, req);

    res.json({
      message: 'Device updated successfully',
      device: updatedDevice
    });

  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({
      error: 'Failed to update device',
      message: error.message
    });
  }
});

// Delete device (hard delete)
router.delete('/:device_id', authenticateToken, requirePermission('devices.delete'), [
  param('device_id')
    .isUUID()
    .withMessage('Invalid device ID format')
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

    const { device_id } = req.params;

    // Check if device exists
    const deviceCheck = await db.query(
      'SELECT id, device_name, is_active FROM devices WHERE id = $1',
      [device_id]
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Device not found'
      });
    }

    if (!deviceCheck.rows[0].is_active) {
      return res.status(404).json({
        error: 'Device not found',
        message: 'Device has already been deleted'
      });
    }

    const deviceName = deviceCheck.rows[0].device_name;

    // Hard delete - first delete related records
    // Delete device assignments
    await db.query(
      'DELETE FROM user_device_assignments WHERE device_id = $1',
      [device_id]
    );

    // Delete device status
    await db.query(
      'DELETE FROM device_status WHERE device_id = $1',
      [device_id]
    );

    // Delete IP logs
    await db.query(
      'DELETE FROM ip_logs WHERE device_id = $1',
      [device_id]
    );

    // Finally delete the device itself
    await db.query(
      'DELETE FROM devices WHERE id = $1',
      [device_id]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'device.delete', 'device', device_id, {
      device_name: deviceName
    }, req);

    res.json({
      message: 'Device permanently deleted',
      device_id: device_id,
      device_name: deviceName
    });

  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({
      error: 'Failed to delete device',
      message: error.message
    });
  }
});

module.exports = router;