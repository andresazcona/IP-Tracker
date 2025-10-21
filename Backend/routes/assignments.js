const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const router = express.Router();
const db = require('../config/database');
const {
  authenticateToken,
  requirePermission,
  requireRole
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

// Get all device assignments
router.get('/', authenticateToken, requirePermission('assignments.read'), [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('user_id')
    .optional()
    .isUUID()
    .withMessage('Invalid user ID format'),
  query('device_id')
    .optional()
    .isUUID()
    .withMessage('Invalid device ID format'),
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
    const { user_id, device_id, is_active } = req.query;

    // Build dynamic WHERE clause
    const conditions = ['u.is_active = true', 'd.is_active = true'];
    const params = [];
    let paramIndex = 1;

    if (user_id) {
      conditions.push(`uda.user_id = $${paramIndex}`);
      params.push(user_id);
      paramIndex++;
    }

    if (device_id) {
      conditions.push(`uda.device_id = $${paramIndex}`);
      params.push(device_id);
      paramIndex++;
    }

    if (is_active !== undefined) {
      conditions.push(`uda.is_active = $${paramIndex}`);
      params.push(is_active === 'true');
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM user_device_assignments uda
      JOIN users u ON uda.user_id = u.id
      JOIN devices d ON uda.device_id = d.id
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get assignments with pagination
    const assignmentsQuery = `
      SELECT 
        uda.id as assignment_id,
        uda.assigned_at,
        uda.notes as assignment_notes,
        uda.is_active as assignment_active,
        u.id as user_id,
        u.username,
        u.first_name,
        u.last_name,
        u.email,
        d.id as device_id,
        d.device_name,
        d.device_type,
        d.mac_address,
        d.serial_number,
        d.model,
        d.location,
        d.description as device_description,
        d.status as device_status,
        ds.status as connection_status,
        ds.last_ping,
        ds.current_ip,
        assigned_by_user.username as assigned_by_username
      FROM user_device_assignments uda
      JOIN users u ON uda.user_id = u.id
      JOIN devices d ON uda.device_id = d.id
      LEFT JOIN device_status ds ON d.id = ds.device_id
      LEFT JOIN users assigned_by_user ON uda.assigned_by = assigned_by_user.id
      ${whereClause}
      ORDER BY uda.assigned_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const assignmentsResult = await db.query(assignmentsQuery, params);

    const totalPages = Math.ceil(total / limit);

    res.json({
      assignments: assignmentsResult.rows,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_items: total,
        items_per_page: limit,
        has_next: page < totalPages,
        has_prev: page > 1
      },
      filters: {
        user_id,
        device_id,
        is_active
      }
    });

  } catch (error) {
    console.error('Error getting assignments:', error);
    res.status(500).json({
      error: 'Failed to get assignments',
      message: error.message
    });
  }
});

// Get assignment by ID
router.get('/:assignment_id', authenticateToken, requirePermission('assignments.read'), [
  param('assignment_id')
    .isUUID()
    .withMessage('Invalid assignment ID format')
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

    const { assignment_id } = req.params;

    const assignmentResult = await db.query(
      `SELECT 
        uda.id as assignment_id,
        uda.assigned_at,
        uda.notes as assignment_notes,
        uda.is_active as assignment_active,
        u.id as user_id,
        u.username,
        u.first_name,
        u.last_name,
        u.email,
        d.id as device_id,
        d.device_name,
        d.device_type,
        d.mac_address,
        d.serial_number,
        d.model,
        d.location,
        d.description as device_description,
        d.status as device_status,
        ds.status as connection_status,
        ds.last_ping,
        ds.current_ip,
        ds.last_online,
        ds.ping_count,
        ds.uptime_percentage,
        assigned_by_user.username as assigned_by_username,
        assigned_by_user.first_name as assigned_by_first_name,
        assigned_by_user.last_name as assigned_by_last_name
      FROM user_device_assignments uda
      JOIN users u ON uda.user_id = u.id
      JOIN devices d ON uda.device_id = d.id
      LEFT JOIN device_status ds ON d.id = ds.device_id
      LEFT JOIN users assigned_by_user ON uda.assigned_by = assigned_by_user.id
      WHERE uda.id = $1`,
      [assignment_id]
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Assignment not found',
        message: 'The specified assignment does not exist'
      });
    }

    res.json({
      assignment: assignmentResult.rows[0]
    });

  } catch (error) {
    console.error('Error getting assignment:', error);
    res.status(500).json({
      error: 'Failed to get assignment',
      message: error.message
    });
  }
});

// Create new device assignment
router.post('/', authenticateToken, requirePermission('assignments.create'), [
  body('user_id')
    .isUUID()
    .withMessage('Invalid user ID format'),
  body('device_id')
    .isUUID()
    .withMessage('Invalid device ID format'),
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters')
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

    const { user_id, device_id, notes } = req.body;

    // Check if user exists and is active
    const userResult = await db.query(
      'SELECT id, username, first_name, last_name FROM users WHERE id = $1 AND is_active = true',
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The specified user does not exist or is inactive'
      });
    }

    const user = userResult.rows[0];

    // Check if device exists and is active
    const deviceResult = await db.query(
      'SELECT id, device_name, device_type FROM devices WHERE id = $1 AND is_active = true',
      [device_id]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Device not found',
        message: 'The specified device does not exist or is inactive'
      });
    }

    const device = deviceResult.rows[0];

    // Check if assignment already exists
    const existingAssignment = await db.query(
      'SELECT id, is_active FROM user_device_assignments WHERE user_id = $1 AND device_id = $2',
      [user_id, device_id]
    );

    if (existingAssignment.rows.length > 0) {
      const existing = existingAssignment.rows[0];
      if (existing.is_active) {
        return res.status(409).json({
          error: 'Assignment already exists',
          message: 'This device is already assigned to this user',
          assignment_id: existing.id
        });
      } else {
        // Reactivate existing assignment
        const reactivatedResult = await db.query(
          `UPDATE user_device_assignments 
           SET is_active = true, assigned_at = CURRENT_TIMESTAMP, assigned_by = $1, notes = $2
           WHERE id = $3
           RETURNING id, assigned_at`,
          [req.user.id, notes, existing.id]
        );

        const reactivatedAssignment = reactivatedResult.rows[0];

        // Log audit event
        await logAuditEvent(req.user.id, 'assignment.reactivate', 'assignment', reactivatedAssignment.id, {
          user_username: user.username,
          device_name: device.device_name,
          assigned_by: req.user.username
        }, req);

        return res.status(200).json({
          message: 'Assignment reactivated successfully',
          assignment: {
            id: reactivatedAssignment.id,
            user_id,
            device_id,
            assigned_at: reactivatedAssignment.assigned_at,
            notes,
            user: user,
            device: device
          }
        });
      }
    }

    // Create new assignment
    const assignmentResult = await db.query(
      `INSERT INTO user_device_assignments (user_id, device_id, assigned_by, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING id, assigned_at, is_active`,
      [user_id, device_id, req.user.id, notes]
    );

    const newAssignment = assignmentResult.rows[0];

    // Log audit event
    await logAuditEvent(req.user.id, 'assignment.create', 'assignment', newAssignment.id, {
      user_username: user.username,
      device_name: device.device_name,
      assigned_by: req.user.username
    }, req);

    res.status(201).json({
      message: 'Device assigned successfully',
      assignment: {
        id: newAssignment.id,
        user_id,
        device_id,
        assigned_at: newAssignment.assigned_at,
        is_active: newAssignment.is_active,
        notes,
        user: user,
        device: device
      }
    });

  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({
      error: 'Failed to create assignment',
      message: error.message
    });
  }
});

// Update device assignment
router.put('/:assignment_id', authenticateToken, requirePermission('assignments.update'), [
  param('assignment_id')
    .isUUID()
    .withMessage('Invalid assignment ID format'),
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters'),
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

    const { assignment_id } = req.params;
    const { notes, is_active } = req.body;

    // Check if assignment exists
    const assignmentResult = await db.query(
      `SELECT uda.id, uda.notes, uda.is_active, uda.user_id, uda.device_id,
              u.username, d.device_name
       FROM user_device_assignments uda
       JOIN users u ON uda.user_id = u.id
       JOIN devices d ON uda.device_id = d.id
       WHERE uda.id = $1`,
      [assignment_id]
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Assignment not found',
        message: 'The specified assignment does not exist'
      });
    }

    const assignment = assignmentResult.rows[0];

    const updates = {};
    const params = [];
    let paramIndex = 1;

    // Build dynamic update query
    if (notes !== undefined) {
      updates.notes = `notes = $${paramIndex}`;
      params.push(notes);
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

    // Add assignment ID
    params.push(assignment_id);
    const whereClause = `$${paramIndex}`;

    const updateQuery = `
      UPDATE user_device_assignments 
      SET ${Object.values(updates).join(', ')}
      WHERE id = ${whereClause}
      RETURNING id, user_id, device_id, assigned_at, notes, is_active
    `;

    const result = await db.query(updateQuery, params);
    const updatedAssignment = result.rows[0];

    // Log audit event
    const action = is_active === false ? 'assignment.deactivate' : 'assignment.update';
    await logAuditEvent(req.user.id, action, 'assignment', assignment_id, {
      user_username: assignment.username,
      device_name: assignment.device_name,
      updated_fields: Object.keys(updates),
      updated_by: req.user.username
    }, req);

    res.json({
      message: 'Assignment updated successfully',
      assignment: updatedAssignment
    });

  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({
      error: 'Failed to update assignment',
      message: error.message
    });
  }
});

// Delete device assignment
router.delete('/:assignment_id', authenticateToken, requirePermission('assignments.delete'), [
  param('assignment_id')
    .isUUID()
    .withMessage('Invalid assignment ID format')
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

    const { assignment_id } = req.params;

    // Check if assignment exists
    const assignmentResult = await db.query(
      `SELECT uda.id, uda.user_id, uda.device_id,
              u.username, d.device_name
       FROM user_device_assignments uda
       JOIN users u ON uda.user_id = u.id
       JOIN devices d ON uda.device_id = d.id
       WHERE uda.id = $1`,
      [assignment_id]
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Assignment not found',
        message: 'The specified assignment does not exist'
      });
    }

    const assignment = assignmentResult.rows[0];

    // Soft delete - deactivate assignment
    await db.query(
      'UPDATE user_device_assignments SET is_active = false WHERE id = $1',
      [assignment_id]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'assignment.delete', 'assignment', assignment_id, {
      user_username: assignment.username,
      device_name: assignment.device_name,
      deleted_by: req.user.username
    }, req);

    res.json({
      message: 'Assignment deleted successfully',
      note: 'Assignment has been deactivated'
    });

  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({
      error: 'Failed to delete assignment',
      message: error.message
    });
  }
});

// Assign multiple devices to a user
router.post('/bulk', authenticateToken, requirePermission('assignments.create'), [
  body('user_id')
    .isUUID()
    .withMessage('Invalid user ID format'),
  body('device_ids')
    .isArray({ min: 1 })
    .withMessage('device_ids must be a non-empty array'),
  body('device_ids.*')
    .isUUID()
    .withMessage('Each device ID must be a valid UUID'),
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters')
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

    const { user_id, device_ids, notes } = req.body;

    // Start transaction
    await db.query('BEGIN');

    try {
      // Check if user exists and is active
      const userResult = await db.query(
        'SELECT id, username, first_name, last_name FROM users WHERE id = $1 AND is_active = true',
        [user_id]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found or inactive');
      }

      const user = userResult.rows[0];

      // Check if all devices exist and are active
      const devicesResult = await db.query(
        'SELECT id, device_name, device_type FROM devices WHERE id = ANY($1) AND is_active = true',
        [device_ids]
      );

      if (devicesResult.rows.length !== device_ids.length) {
        const foundDeviceIds = devicesResult.rows.map(d => d.id);
        const missingDeviceIds = device_ids.filter(id => !foundDeviceIds.includes(id));
        throw new Error(`Some devices not found or inactive: ${missingDeviceIds.join(', ')}`);
      }

      const devices = devicesResult.rows;
      const assignments = [];
      const skipped = [];

      for (const device of devices) {
        // Check if assignment already exists
        const existingAssignment = await db.query(
          'SELECT id, is_active FROM user_device_assignments WHERE user_id = $1 AND device_id = $2',
          [user_id, device.id]
        );

        if (existingAssignment.rows.length > 0) {
          const existing = existingAssignment.rows[0];
          if (existing.is_active) {
            skipped.push({
              device_id: device.id,
              device_name: device.device_name,
              reason: 'Already assigned'
            });
            continue;
          } else {
            // Reactivate existing assignment
            const reactivatedResult = await db.query(
              `UPDATE user_device_assignments 
               SET is_active = true, assigned_at = CURRENT_TIMESTAMP, assigned_by = $1, notes = $2
               WHERE id = $3
               RETURNING id, assigned_at`,
              [req.user.id, notes, existing.id]
            );

            assignments.push({
              id: reactivatedResult.rows[0].id,
              user_id,
              device_id: device.id,
              assigned_at: reactivatedResult.rows[0].assigned_at,
              notes,
              device_name: device.device_name,
              action: 'reactivated'
            });
          }
        } else {
          // Create new assignment
          const assignmentResult = await db.query(
            `INSERT INTO user_device_assignments (user_id, device_id, assigned_by, notes)
             VALUES ($1, $2, $3, $4)
             RETURNING id, assigned_at`,
            [user_id, device.id, req.user.id, notes]
          );

          assignments.push({
            id: assignmentResult.rows[0].id,
            user_id,
            device_id: device.id,
            assigned_at: assignmentResult.rows[0].assigned_at,
            notes,
            device_name: device.device_name,
            action: 'created'
          });
        }
      }

      // Commit transaction
      await db.query('COMMIT');

      // Log audit event for bulk assignment
      await logAuditEvent(req.user.id, 'assignment.bulk.create', 'assignment', null, {
        user_username: user.username,
        assigned_devices: assignments.map(a => a.device_name),
        skipped_devices: skipped.map(s => s.device_name),
        assigned_by: req.user.username
      }, req);

      res.status(201).json({
        message: 'Bulk assignment completed',
        assignments,
        skipped,
        summary: {
          total_requested: device_ids.length,
          successful_assignments: assignments.length,
          skipped_assignments: skipped.length
        }
      });

    } catch (error) {
      // Rollback transaction
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error creating bulk assignments:', error);
    res.status(500).json({
      error: 'Failed to create bulk assignments',
      message: error.message
    });
  }
});

// Get assignment statistics
router.get('/stats/overview', authenticateToken, requirePermission('assignments.read'), async (req, res) => {
  try {
    // Get assignment statistics
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) as total_assignments,
        COUNT(*) FILTER (WHERE is_active = true) as active_assignments,
        COUNT(*) FILTER (WHERE is_active = false) as inactive_assignments,
        COUNT(DISTINCT user_id) FILTER (WHERE is_active = true) as users_with_devices,
        COUNT(DISTINCT device_id) FILTER (WHERE is_active = true) as assigned_devices
      FROM user_device_assignments
    `);

    const stats = statsResult.rows[0];

    // Get device statistics
    const deviceStatsResult = await db.query(`
      SELECT 
        COUNT(*) as total_devices,
        COUNT(*) FILTER (WHERE is_active = true) as active_devices,
        COUNT(*) FILTER (WHERE id NOT IN (
          SELECT device_id FROM user_device_assignments WHERE is_active = true
        )) as unassigned_devices
      FROM devices
      WHERE is_active = true
    `);

    const deviceStats = deviceStatsResult.rows[0];

    // Get user statistics
    const userStatsResult = await db.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE is_active = true) as active_users,
        COUNT(*) FILTER (WHERE id NOT IN (
          SELECT user_id FROM user_device_assignments WHERE is_active = true
        )) as users_without_devices
      FROM users
      WHERE is_active = true
    `);

    const userStats = userStatsResult.rows[0];

    res.json({
      assignment_stats: {
        total_assignments: parseInt(stats.total_assignments),
        active_assignments: parseInt(stats.active_assignments),
        inactive_assignments: parseInt(stats.inactive_assignments),
        users_with_devices: parseInt(stats.users_with_devices),
        assigned_devices: parseInt(stats.assigned_devices)
      },
      device_stats: {
        total_devices: parseInt(deviceStats.total_devices),
        active_devices: parseInt(deviceStats.active_devices),
        unassigned_devices: parseInt(deviceStats.unassigned_devices)
      },
      user_stats: {
        total_users: parseInt(userStats.total_users),
        active_users: parseInt(userStats.active_users),
        users_without_devices: parseInt(userStats.users_without_devices)
      }
    });

  } catch (error) {
    console.error('Error getting assignment statistics:', error);
    res.status(500).json({
      error: 'Failed to get assignment statistics',
      message: error.message
    });
  }
});

module.exports = router;