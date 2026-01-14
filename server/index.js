import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { setupRoutes } from './routes/index.js';
import { setupWorker } from './worker/index.js';
import { logger } from './lib/logger.js';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from server directory
const envPath = join(__dirname, '.env');
const envExists = existsSync(envPath);

if (envExists) {
  logger.info(`✅ Found .env file at: ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  logger.warn(`⚠️  .env file not found at: ${envPath}`);
  logger.warn('Attempting to load from default location...');
  dotenv.config(); // Try default location
}

// Log environment variables (masking sensitive ones)
logger.info('🔍 Environment Variables Check:');
logger.info(`📁 .env file path: ${envPath}`);
logger.info(`📄 .env file exists: ${existsSync(envPath) ? '✅ Yes' : '❌ No'}`);

// Check all important env vars
const envVars = {
  TERMII_API_KEY: process.env.TERMII_API_KEY,
  TERMII_BASE_URL: process.env.TERMII_BASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  PORT: process.env.PORT,
  BATCH_DELAY_MS: process.env.BATCH_DELAY_MS,
};

logger.info('📋 Environment Variables Status:');
Object.entries(envVars).forEach(([key, value]) => {
  if (key === 'TERMII_API_KEY') {
    logger.info(`  ${key}: ${value ? '✅ Set (' + value.substring(0, 10) + '...)' : '❌ NOT SET'}`);
  } else {
    logger.info(`  ${key}: ${value ? '✅ ' + value : '❌ NOT SET (using default)'}`);
  }
});

// Log all env vars (for debugging)
logger.info('🔍 All TERMII/REDIS related env vars:', {
  TERMII_API_KEY: process.env.TERMII_API_KEY ? '***masked***' : 'NOT SET',
  TERMII_BASE_URL: process.env.TERMII_BASE_URL || 'NOT SET (using default)',
  REDIS_URL: process.env.REDIS_URL || 'NOT SET (using default)',
  PORT: process.env.PORT || 'NOT SET (using default: 3001)',
  BATCH_DELAY_MS: process.env.BATCH_DELAY_MS || 'NOT SET (using default: 2000)',
});

const app = express();
const server = createServer(app);

const PORT = process.env.PORT || 3001;

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
setupRoutes(app);

// Start server
server.listen(PORT, () => {
  logger.info(`🚀 Server started on port ${PORT}`);
  logger.info(`📡 Redis URL: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
  logger.info(`📧 Termii API: ${process.env.TERMII_BASE_URL || 'https://api.ng.termii.com'}`);
  logger.info(`⏱️  Batch delay: ${process.env.BATCH_DELAY_MS || 2000}ms`);
});

// Start worker
logger.info('🔧 Initializing worker...');
setupWorker();
