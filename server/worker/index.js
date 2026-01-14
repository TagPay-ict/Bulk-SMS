import { Worker } from 'bullmq';
import redis from '../lib/redis.js';
import { parseCSV, normalizeCSVData } from '../lib/csvParser.js';
import { processTemplate, hasPlaceholders } from '../lib/template.js';
import { sendBulkSMS, sendSingleSMS } from '../lib/termii.js';
import { logger } from '../lib/logger.js';
import { normalizePhoneNumber } from '../lib/phoneNormalizer.js';

const BATCH_SIZE = 100;
const BATCH_DELAY_MS = parseInt(process.env.BATCH_DELAY_MS || '2000', 10);
const INDIVIDUAL_DELAY_MS = 100; // Delay between individual SMS sends

/**
 * Process a single batch of recipients
 * If template has placeholders, send individual messages for personalization
 * Otherwise, use bulk endpoint for efficiency
 */
async function processBatch(batch, template, senderId, channel, job, batchIndex, totalBatches) {
  const needsPersonalization = hasPlaceholders(template);
  const failedRecipients = [];

  logger.info(`📦 Processing batch ${batchIndex + 1}/${totalBatches}`, {
    recipients: batch.length,
    personalized: needsPersonalization,
  });

  if (needsPersonalization) {
    // Send individual messages for personalization
    logger.info(`✨ Using personalized sending (individual SMS)`);
    let successCount = 0;
    for (let i = 0; i < batch.length; i++) {
      const recipient = batch[i];
      
      // Find phone number dynamically (could be phoneNumber, phone, number, etc.)
      const phoneNumberRaw = recipient.phoneNumber || 
                            recipient.phone || 
                            Object.values(recipient).find(val => 
                              val && typeof val === 'string' && val.length > 5 && /^[\d+]/.test(val)
                            ) || '';
      
      if (!phoneNumberRaw) {
        logger.warn(`⚠️  No phone number found for recipient at index ${recipient.originalIndex}`);
        failedRecipients.push({ ...recipient, error: 'No phone number found' });
        const currentProgress = job.progress || {};
        await job.updateProgress({
          ...currentProgress,
          processed: (currentProgress.processed || 0) + 1,
          failed: (currentProgress.failed || 0) + 1,
          currentBatch: 1,
          lastBatchTime: new Date().toISOString(),
        });
        continue;
      }
      
      // Normalize phone number at point of send
      const phoneNumber = normalizePhoneNumber(phoneNumberRaw);
      
      if (!phoneNumber) {
        logger.warn(`⚠️  Invalid phone number format: ${phoneNumberRaw} (recipient index: ${recipient.originalIndex})`);
        failedRecipients.push({ ...recipient, error: `Invalid phone number format: ${phoneNumberRaw}` });
        const currentProgress = job.progress || {};
        await job.updateProgress({
          ...currentProgress,
          processed: (currentProgress.processed || 0) + 1,
          failed: (currentProgress.failed || 0) + 1,
          currentBatch: 1,
          lastBatchTime: new Date().toISOString(),
        });
        continue;
      }
      
      // Log normalization if different from original
      if (phoneNumber !== phoneNumberRaw.replace(/\D/g, '')) {
        logger.debug(`📞 Normalized phone: ${phoneNumberRaw} → ${phoneNumber}`);
      }
      
      try {
        const personalizedMessage = processTemplate(template, recipient);
        await sendSingleSMS(phoneNumber, personalizedMessage, channel);
        successCount++;
        
        // Update progress after each successful send
        const currentProgress = job.progress || {};
        await job.updateProgress({
          ...currentProgress,
          processed: (currentProgress.processed || 0) + 1,
          currentBatch: 1,
          lastBatchTime: new Date().toISOString(),
        });

        if ((i + 1) % 10 === 0) {
          logger.debug(`Progress: ${i + 1}/${batch.length} sent in this batch`);
        }

        // Small delay between individual sends to avoid rate limits
        await delay(INDIVIDUAL_DELAY_MS);
      } catch (error) {
        failedRecipients.push({ ...recipient, error: error.message });
        logger.warn(`⚠️  Failed to send to ${phoneNumber}:`, error.message);
        
        const currentProgress = job.progress || {};
        await job.updateProgress({
          ...currentProgress,
          processed: (currentProgress.processed || 0) + 1,
          failed: (currentProgress.failed || 0) + 1,
          currentBatch: 1,
          lastBatchTime: new Date().toISOString(),
        });
      }
    }
    logger.info(`✅ Batch ${batchIndex + 1} completed: ${successCount} sent, ${failedRecipients.length} failed`);
  } else {
    // No personalization needed, use bulk endpoint
    logger.info(`📨 Using bulk sending (same message to all)`);
    
    // Normalize phone numbers at point of send
    const phoneNumbersWithErrors = batch.map((recipient) => {
      // Find phone number dynamically
      const phoneNumberRaw = recipient.phoneNumber || 
                            recipient.phone || 
                            Object.values(recipient).find(val => 
                              val && typeof val === 'string' && val.length > 5 && /^[\d+]/.test(val)
                            ) || '';
      
      if (!phoneNumberRaw) {
        return { recipient, phoneNumber: null, error: 'No phone number found' };
      }
      
      // Normalize phone number
      const phoneNumber = normalizePhoneNumber(phoneNumberRaw);
      
      if (!phoneNumber) {
        return { recipient, phoneNumber: null, error: `Invalid phone number format: ${phoneNumberRaw}` };
      }
      
      // Log normalization if different
      if (phoneNumber !== phoneNumberRaw.replace(/\D/g, '')) {
        logger.debug(`📞 Normalized phone: ${phoneNumberRaw} → ${phoneNumber}`);
      }
      
      return { recipient, phoneNumber, error: null };
    });
    
    // Separate valid and invalid phone numbers
    const validPhones = phoneNumbersWithErrors
      .filter(item => item.phoneNumber)
      .map(item => item.phoneNumber);
    
    const invalidItems = phoneNumbersWithErrors.filter(item => !item.phoneNumber);
    
    if (validPhones.length === 0) {
      logger.error('❌ No valid phone numbers found in batch after normalization');
      failedRecipients.push(...invalidItems.map(item => ({ ...item.recipient, error: item.error })));
      const currentProgress = job.progress || {};
      await job.updateProgress({
        ...currentProgress,
        processed: (currentProgress.processed || 0) + batch.length,
        failed: (currentProgress.failed || 0) + batch.length,
        currentBatch: batch.length,
        lastBatchTime: new Date().toISOString(),
      });
      return {
        success: false,
        batch: batch,
        failedCount: batch.length,
      };
    }
    
    // Add invalid recipients to failed list
    if (invalidItems.length > 0) {
      failedRecipients.push(...invalidItems.map(item => ({ ...item.recipient, error: item.error })));
      logger.warn(`⚠️  ${invalidItems.length} invalid phone number(s) in batch, ${validPhones.length} valid`);
    }
    
    const message = template; // No placeholders, use template as-is

    try {
      const result = await sendBulkSMS(validPhones, message, channel);
      
      // Update progress (only count successfully sent)
      const currentProgress = job.progress || {};
      await job.updateProgress({
        ...currentProgress,
        processed: (currentProgress.processed || 0) + validPhones.length,
        failed: (currentProgress.failed || 0) + invalidItems.length,
        currentBatch: validPhones.length,
        lastBatchTime: new Date().toISOString(),
      });

      logger.info(`✅ Batch ${batchIndex + 1} completed: ${validPhones.length} sent successfully${invalidItems.length > 0 ? `, ${invalidItems.length} failed normalization` : ''}`);
      return {
        success: true,
        batch,
        result,
      };
    } catch (error) {
      // If bulk fails, mark entire batch as failed
      failedRecipients.push(...batch.map(r => ({ ...r, error: error.message })));
      logger.error(`❌ Batch ${batchIndex + 1} failed:`, error.message);
    }
  }

  // Handle failed recipients
  if (failedRecipients.length > 0) {
    logger.warn(`⚠️  Storing ${failedRecipients.length} failed recipients`);
    const failedBatchKey = `failed_batch:${job.id}:${Date.now()}`;
    await redis.setex(
      failedBatchKey,
      86400 * 7, // Store for 7 days
      JSON.stringify({
        batch: failedRecipients,
        error: failedRecipients[0].error,
        timestamp: new Date().toISOString(),
        jobId: job.id,
      })
    );

    // Add to failed batches list
    await redis.lpush(`failed_batches:${job.id}`, failedBatchKey);
    logger.info(`💾 Failed batch stored: ${failedBatchKey}`);
  }

  return {
    success: failedRecipients.length === 0,
    batch: needsPersonalization ? batch : batch,
    failedCount: failedRecipients.length,
  };
}

/**
 * Delay function for rate limiting
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function setupWorker() {
  const worker = new Worker(
    'sms-processing',
    async (job) => {
      const startTime = Date.now();
      const { csvContent, template, senderId, channel, recipients, isRetry } = job.data;

      logger.info(`🚀 Starting job ${job.id} (${isRetry ? 'RETRY' : 'NEW'})`, {
        senderId,
        channel,
        templateLength: template.length,
      });

      let normalizedData;
      
      if (isRetry && recipients) {
        // Retry job: use direct recipients array
        logger.info(`🔄 Retry job: using ${recipients.length} recipients from failed batches`);
        normalizedData = recipients;
      } else {
        // New job: parse CSV
        logger.info('📄 Parsing CSV file...');
        const parsedData = await parseCSV(csvContent);
        normalizedData = normalizeCSVData(parsedData);
      }

      const totalRecipients = normalizedData.length;
      logger.info(`📊 Total recipients: ${totalRecipients}`);

      // Check if template needs personalization
      const needsPersonalization = hasPlaceholders(template);
      logger.info(`📝 Template analysis:`, {
        hasPlaceholders: needsPersonalization,
        mode: needsPersonalization ? 'PERSONALIZED (individual SMS)' : 'BULK (same message)',
      });

      // Initialize progress
      const totalBatches = Math.ceil(totalRecipients / BATCH_SIZE);
      await job.updateProgress({
        total: totalRecipients,
        processed: 0,
        failed: 0,
        batches: totalBatches,
        currentBatch: 0,
      });

      // Create batches of 100 recipients
      const batches = [];
      for (let i = 0; i < normalizedData.length; i += BATCH_SIZE) {
        batches.push(normalizedData.slice(i, i + BATCH_SIZE));
      }

      logger.info(`📦 Created ${batches.length} batch(es) of up to ${BATCH_SIZE} recipients each`);

      // Process batches sequentially with rate limiting
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchStartTime = Date.now();

        await processBatch(batch, template, senderId, channel, job, i, batches.length);

        const batchDuration = Date.now() - batchStartTime;
        logger.info(`⏱️  Batch ${i + 1}/${batches.length} completed in ${batchDuration}ms`);

        // Rate limiting: delay between batches (except for the last one)
        if (i < batches.length - 1) {
          logger.debug(`⏳ Waiting ${BATCH_DELAY_MS}ms before next batch...`);
          await delay(BATCH_DELAY_MS);
        }
      }

      const finalProgress = job.progress || {};
      const totalDuration = Date.now() - startTime;
      
      // Ensure final progress is saved
      await job.updateProgress({
        ...finalProgress,
        total: finalProgress.total || totalRecipients,
      });
      
      logger.info(`✅ Job ${job.id} completed successfully`, {
        total: finalProgress.total || totalRecipients,
        processed: finalProgress.processed || 0,
        failed: finalProgress.failed || 0,
        duration: `${(totalDuration / 1000).toFixed(2)}s`,
      });

      return {
        success: true,
        total: finalProgress.total || totalRecipients,
        processed: finalProgress.processed || 0,
        failed: finalProgress.failed || 0,
        duration: totalDuration,
      };
    },
    {
      connection: redis,
      concurrency: 1, // Process one job at a time
    }
  );

  worker.on('completed', (job) => {
    logger.info(`✅ Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`❌ Job ${job?.id || 'unknown'} failed:`, err.message, err.stack);
  });

  worker.on('error', (err) => {
    logger.error('❌ Worker error:', err.message, err.stack);
  });

  worker.on('active', (job) => {
    logger.info(`🔄 Job ${job.id} is now active`);
  });

  logger.info('✅ Worker started and listening for jobs on queue: sms-processing');

  return worker;
}
