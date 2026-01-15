import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { setupRoutes } from './routes/index.js';
import { setupWorker } from './worker/index.js';
import { logger } from './lib/logger.js';

// Load environment variables (from system env vars in production)
dotenv.config();

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
});

// Start worker
logger.info('🔧 Initializing worker...');
setupWorker();
