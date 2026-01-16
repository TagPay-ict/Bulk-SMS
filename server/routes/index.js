import multer from 'multer';
import { smsQueue } from '../lib/queue.js';
import redis from '../lib/redis.js';
import { logger } from '../lib/logger.js';

const upload = multer({ storage: multer.memoryStorage() });

export function setupRoutes(app) {
  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Upload CSV and create job
  app.post('/api/upload', upload.single('csv'), async (req, res) => {
    try {
      logger.info('📤 CSV upload request received');
      
      if (!req.file) {
        logger.warn('❌ No CSV file provided in request');
        return res.status(400).json({ error: 'No CSV file provided' });
      }

      const { template, channel = 'dnd' } = req.body;

      logger.info('📋 Upload details:', {
        fileName: req.file.originalname,
        fileSize: `${(req.file.size / 1024).toFixed(2)} KB`,
        senderId: 'N-Alert', // Constant sender ID
        channel,
        templateLength: template?.length || 0,
      });

      if (!template) {
        logger.warn('❌ Template missing in request');
        return res.status(400).json({ error: 'Template is required' });
      }

      const csvContent = req.file.buffer.toString('utf-8');

      // Create job with unique ID based on CSV content hash to prevent duplicates
      const crypto = await import('crypto');
      const csvHash = crypto.createHash('md5').update(csvContent + template + channel).digest('hex');
      const jobId = `sms-${csvHash.substring(0, 16)}`;

      // Check if job already exists
      const existingJob = await smsQueue.getJob(jobId);
      if (existingJob) {
        const existingState = await existingJob.getState();
        if (existingState === 'completed') {
          logger.info(`Job ${jobId} already completed`);
          return res.json({
            jobId: existingJob.id,
            message: 'Job already completed',
            alreadyExists: true,
          });
        } else if (existingState === 'active' || existingState === 'waiting') {
          logger.info(`Job ${jobId} already exists and is ${existingState}`);
          return res.json({
            jobId: existingJob.id,
            message: 'Job already exists and is processing',
            alreadyExists: true,
          });
        }
      }

      // Create job
      logger.info('🔄 Creating BullMQ job...');
      const job = await smsQueue.add('process-sms', {
        csvContent,
        template,
        senderId: 'N-Alert', // Constant sender ID
        channel,
        progress: {
          total: 0,
          processed: 0,
          failed: 0,
          batches: 0,
          currentBatch: 0,
        },
      }, {
        jobId: jobId, // Use custom job ID to prevent duplicates
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 1000,
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      });

      logger.info(`✅ Job created successfully - Job ID: ${job.id}`);
      res.json({
        jobId: job.id,
        message: 'Job created successfully',
      });
    } catch (error) {
      logger.error('❌ Upload error:', error.message, error.stack);
      res.status(500).json({ error: error.message });
    }
  });

  // Get job progress (SSE)
  app.get('/api/jobs/:jobId/progress', async (req, res) => {
    const { jobId } = req.params;
    logger.info(`📊 Progress stream requested for job: ${jobId}`);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Flush headers immediately
    res.flushHeaders();

    let isConnected = true;
    let lastProgress = null;

    const sendProgress = async () => {
      if (!isConnected) return;
      
      try {
        const job = await smsQueue.getJob(jobId);
        
        if (!job) {
          res.write(`data: ${JSON.stringify({ error: 'Job not found' })}\n\n`);
          res.end();
          isConnected = false;
          return;
        }

        const state = await job.getState();
        const progress = job.progress || {};

        // Always send progress update (don't skip if unchanged, client needs to see it)
        const data = JSON.stringify({
          jobId,
          state,
          progress: {
            total: progress.total || 0,
            processed: progress.processed || 0,
            failed: progress.failed || 0,
            batches: progress.batches || 0,
            currentBatch: progress.currentBatch || 0,
            lastBatchTime: progress.lastBatchTime,
          },
          timestamp: new Date().toISOString(),
        });

        // Only skip if data is exactly the same
        if (data !== lastProgress) {
          lastProgress = data;
          res.write(`data: ${data}\n\n`);
          res.flush?.(); // Flush if available (Node.js 18+)
        }

        // If job is completed or failed, close connection after a short delay
        if (state === 'completed' || state === 'failed') {
          setTimeout(() => {
            if (isConnected) {
              res.end();
              isConnected = false;
            }
          }, 1000);
        }
      } catch (error) {
        logger.error(`❌ Error sending progress for job ${jobId}:`, error.message);
        if (isConnected) {
          res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
          res.end();
          isConnected = false;
        }
      }
    };

    // Send initial progress
    await sendProgress();

    // Poll for updates every 500ms for more responsive updates
    const progressInterval = setInterval(async () => {
      if (!isConnected) {
        clearInterval(progressInterval);
        return;
      }
      await sendProgress();
    }, 500);

    // Send keep-alive heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      if (!isConnected) {
        clearInterval(heartbeatInterval);
        return;
      }
      try {
        res.write(': heartbeat\n\n');
        res.flush?.();
      } catch (error) {
        logger.debug('Heartbeat failed, connection may be closed');
        clearInterval(heartbeatInterval);
        clearInterval(progressInterval);
        isConnected = false;
      }
    }, 30000);

    // Cleanup on client disconnect
    req.on('close', () => {
      logger.info(`📊 Progress stream closed for job: ${jobId}`);
      isConnected = false;
      clearInterval(progressInterval);
      clearInterval(heartbeatInterval);
      if (!res.headersSent || res.writable) {
        res.end();
      }
    });

    req.on('error', (error) => {
      logger.error(`📊 Progress stream error for job ${jobId}:`, error.message);
      isConnected = false;
      clearInterval(progressInterval);
      clearInterval(heartbeatInterval);
    });
  });

  // Get failed batches for a job
  app.get('/api/jobs/:jobId/failed', async (req, res) => {
    try {
      const { jobId } = req.params;
      logger.info(`🔍 Fetching failed batches for job: ${jobId}`);
      const failedBatchKeys = await redis.lrange(`failed_batches:${jobId}`, 0, -1);
      logger.info(`Found ${failedBatchKeys.length} failed batch keys`);

      const failedBatches = await Promise.all(
        failedBatchKeys.map(async (key) => {
          const data = await redis.get(key);
          if (data) {
            const batchData = JSON.parse(data);
            return {
              key,
              ...batchData,
            };
          }
          return null;
        })
      );

      const validBatches = failedBatches.filter((b) => b !== null);
      logger.info(`✅ Returning ${validBatches.length} failed batches`);
      res.json({
        failedBatches: validBatches,
      });
    } catch (error) {
      logger.error('❌ Failed batches error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Retry failed batches
  app.post('/api/jobs/:jobId/retry', async (req, res) => {
    try {
      const { jobId } = req.params;
      const { batchKeys } = req.body;
      logger.info(`🔄 Retry request for job: ${jobId}`, { batchCount: batchKeys?.length || 0 });

      if (!Array.isArray(batchKeys) || batchKeys.length === 0) {
        logger.warn('❌ Invalid batchKeys in retry request');
        return res.status(400).json({ error: 'batchKeys array is required' });
      }

      // Get original job data
      const originalJob = await smsQueue.getJob(jobId);
      if (!originalJob) {
        logger.warn(`❌ Job not found: ${jobId}`);
        return res.status(404).json({ error: 'Job not found' });
      }

      const { template, channel } = originalJob.data;
      logger.info('📋 Original job data retrieved:', { senderId: 'N-Alert', channel });

      // Collect all recipients from failed batches
      const allRecipients = [];
      for (const key of batchKeys) {
        const data = await redis.get(key);
        if (data) {
          const batchData = JSON.parse(data);
          allRecipients.push(...batchData.batch);
        }
      }

      logger.info(`📊 Total recipients to retry: ${allRecipients.length}`);

      if (allRecipients.length === 0) {
        logger.warn('❌ No recipients found in selected batches');
        return res.status(400).json({ error: 'No recipients found in selected batches' });
      }

      // Create new job for retry
      logger.info('🔄 Creating retry job...');
      const retryJob = await smsQueue.add('process-sms', {
        csvContent: '', // Not needed for retry
        recipients: allRecipients, // Direct recipients array
        template,
        senderId: 'N-Alert', // Constant sender ID
        channel,
        isRetry: true,
        progress: {
          total: allRecipients.length,
          processed: 0,
          failed: 0,
          batches: Math.ceil(allRecipients.length / 100),
          currentBatch: 0,
        },
      });

      logger.info(`✅ Retry job created - Job ID: ${retryJob.id}`, {
        recipients: allRecipients.length,
      });
      res.json({
        jobId: retryJob.id,
        message: 'Retry job created successfully',
        recipients: allRecipients.length,
      });
    } catch (error) {
      logger.error('❌ Retry error:', error.message, error.stack);
      res.status(500).json({ error: error.message });
    }
  });

  // Get job status
  app.get('/api/jobs/:jobId', async (req, res) => {
    try {
      const { jobId } = req.params;
      const job = await smsQueue.getJob(jobId);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const state = await job.getState();
      const progress = job.progress || {};

      logger.debug(`Job status retrieved: ${jobId}`, { state, progress });
      res.json({
        jobId,
        state,
        progress,
      });
    } catch (error) {
      logger.error('❌ Get job error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });
}
