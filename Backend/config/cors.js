// CORS Configuration
// This file contains CORS settings for the IP Tracker Backend

const corsConfig = {
  // Development origins (always allowed)
  developmentOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173', // Vite default
    'http://localhost:5174',
    'http://localhost:8080', // Vue CLI default
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8080'
  ],

  // Production origins (your actual frontend domains)
  productionOrigins: [
    'https://srausiplogger.vercel.app',
    'https://srausiplogger.vercel.app/',
    // Allow any Vercel deployment preview URLs for this domain
    'https://srausiplogger-*.vercel.app'
  ],

  // Allowed methods for CORS
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],

  // Allowed headers for CORS
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Forwarded-For',
    'User-Agent',
    'X-API-Key'
  ],

  // Whether to include credentials in CORS requests
  credentials: true,

  // Status code for successful OPTIONS requests
  optionsSuccessStatus: 200
};

// Function to get CORS options based on environment
const getCorsOptions = () => {
  return {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        console.log('CORS: Request with no origin allowed');
        return callback(null, true);
      }

      const isDevelopment = process.env.NODE_ENV !== 'production';
      
      if (isDevelopment) {
        console.log(`CORS: Development mode - allowing origin: ${origin}`);
        return callback(null, true);
      }

      // TEMPORAL: Permitir todas las conexiones durante pruebas
  console.log(`CORS: Production mode - TEMPORARILY allowing all origins: ${origin}`);
      return callback(null, true);

      // TODO: Restaurar verificación estricta después de pruebas
      /*
      const allowedOrigins = [
        ...corsConfig.developmentOrigins,
        ...corsConfig.productionOrigins
      ];

      // Check exact matches first
      if (allowedOrigins.includes(origin)) {
        console.log(`CORS: Production mode - allowed origin: ${origin}`);
        return callback(null, true);
      }

      // Check wildcard patterns for Vercel preview deployments
      const isVercelPreview = origin.startsWith('https://srausiplogger-') && origin.endsWith('.vercel.app');
      if (isVercelPreview) {
        console.log(`CORS: Production mode - allowed Vercel preview: ${origin}`);
        return callback(null, true);
      }

      // Block unauthorized origins in production
      console.log(`CORS: Production mode - BLOCKED origin: ${origin}`);
      const msg = `Not allowed by CORS policy. Origin ${origin} is not in the allowed list.`;
      return callback(new Error(msg), false);
      */

      // Uncomment this when you want to restrict origins in production:
      // console.log(`CORS: Production mode - blocked origin: ${origin}`);
      // const msg = `Not allowed by CORS policy. Origin ${origin} is not in the allowed list.`;
      // return callback(new Error(msg), false);
    },
    methods: corsConfig.allowedMethods,
    allowedHeaders: corsConfig.allowedHeaders,
    credentials: corsConfig.credentials,
    optionsSuccessStatus: corsConfig.optionsSuccessStatus
  };
};

// Function to add production origins (call this when you have frontend domains)
const addProductionOrigins = (origins) => {
  if (Array.isArray(origins)) {
    corsConfig.productionOrigins.push(...origins);
  } else {
    corsConfig.productionOrigins.push(origins);
  }
  console.log('CORS: Added production origins:', origins);
};

// Function to get current CORS configuration
const getCorsInfo = () => {
  return {
    environment: process.env.NODE_ENV || 'development',
    developmentOrigins: corsConfig.developmentOrigins,
    productionOrigins: corsConfig.productionOrigins,
    allowedMethods: corsConfig.allowedMethods,
    allowedHeaders: corsConfig.allowedHeaders,
    credentials: corsConfig.credentials
  };
};

module.exports = {
  getCorsOptions,
  addProductionOrigins,
  getCorsInfo,
  corsConfig
};