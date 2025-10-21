const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const deviceRoutes = require('./routes/devices');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const assignmentRoutes = require('./routes/assignments');
const { getCorsOptions, getCorsInfo } = require('./config/cors');
const { runSystemInit } = require('./config/init');

const app = express();
const PORT = process.env.PORT || 3000;

// Get CORS options from configuration
const corsOptions = getCorsOptions();

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Disable for CORS compatibility
  contentSecurityPolicy: false // Disable for development
}));

// Apply CORS with options
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

console.log('CORS Configuration applied:', {
  environment: process.env.NODE_ENV || 'development',
  mode: process.env.NODE_ENV === 'production' ? 'permissive (temporary)' : 'development'
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/devices', deviceRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'IP Tracker Backend'
  });
});

// CORS test endpoint
app.get('/cors-test', (req, res) => {
  res.status(200).json({
    message: 'CORS is working!',
    origin: req.headers.origin || 'No origin header',
    timestamp: new Date().toISOString(),
    headers: {
      'user-agent': req.headers['user-agent'],
      'referer': req.headers.referer || 'No referer',
      'x-forwarded-for': req.headers['x-forwarded-for'] || 'No forwarded IP'
    }
  });
});

// CORS configuration info endpoint
app.get('/cors-info', (req, res) => {
  res.status(200).json({
    message: 'CORS configuration information',
    cors_config: getCorsInfo(),
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'IP Tracker Backend API with Authentication & Device Management',
    version: '2.0.0',
    endpoints: {
      health: '/health',
      cors_test: '/cors-test',
      cors_info: '/cors-info',
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        refresh: 'POST /api/auth/refresh',
        logout: 'POST /api/auth/logout',
        profile: 'GET /api/auth/profile'
      },
      users: {
        list: 'GET /api/users',
        get: 'GET /api/users/:id',
        create: 'POST /api/users',
        update: 'PUT /api/users/:id',
        delete: 'DELETE /api/users/:id',
        devices: 'GET /api/users/:id/devices'
      },
      devices: {
        list: 'GET /api/devices',
        get: 'GET /api/devices/:id',
        create: 'POST /api/devices',
        update: 'PUT /api/devices/:id',
        delete: 'DELETE /api/devices/:id',
        register: 'POST /api/devices/register',
        ping: 'POST /api/devices/ping',
        stats: 'GET /api/devices/stats/overview'
      },
      assignments: {
        list: 'GET /api/assignments',
        get: 'GET /api/assignments/:id',
        create: 'POST /api/assignments',
        update: 'PUT /api/assignments/:id',
        delete: 'DELETE /api/assignments/:id',
        bulk: 'POST /api/assignments/bulk',
        stats: 'GET /api/assignments/stats/overview'
      }
    },
    features: {
      authentication: 'JWT-based authentication with refresh tokens',
      authorization: 'Role-based access control (admin, manager, user, viewer)',
      device_management: 'Full CRUD operations for device inventory',
      user_management: 'User accounts with role assignments',
      device_assignments: 'Assign devices to users with tracking',
      ip_logging: 'Device IP address tracking and history',
      audit_logging: 'Complete audit trail of system actions'
    },
    cors: {
      enabled: true,
      mode: process.env.NODE_ENV === 'production' ? 'permissive' : 'development',
      note: 'All origins allowed for development. Configure production origins in config/cors.js'
    },
    offline_detection: {
      enabled: true,
      mode: 'on-demand',
      trigger: 'GET requests to /api/devices',
      offline_threshold: '3 minutes',
      note: 'Devices are checked for offline status when data is requested'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Only start the server if not in Vercel environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  // Initialize system on startup
  runSystemInit().then((success) => {
    if (success) {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Backend URL: ${process.env.BACKEND_URL || `http://localhost:${PORT}`}`);
        console.log('Authentication: Enabled');
        console.log('Device Management: Enabled');
        console.log('User Management: Enabled');
        console.log('Device Assignments: Enabled');
        console.log('Audit Logging: Enabled');
        console.log('Offline detection: On-demand (triggered by GET requests)');
      });
    } else {
      console.error('Server startup aborted due to initialization failure');
      process.exit(1);
    }
  }).catch((error) => {
    console.error('Fatal error during system initialization:', error);
    process.exit(1);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

module.exports = app;