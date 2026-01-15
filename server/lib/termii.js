import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from './logger.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

// Get environment variables dynamically
function getTermiiApiKey() {
  const key = process.env.TERMII_API_KEY;
  if (!key || key.trim() === '') {
    logger.error('❌ TERMII_API_KEY is not configured or is empty!');
    logger.error('Please check your .env file in the server directory');
    return null;
  }
  return key.trim();
}

function getTermiiBaseUrl() {
  let url = (process.env.TERMII_BASE_URL || 'https://api.ng.termii.com').trim();
  // Remove trailing slash and /api if present (we'll add it in the endpoint)
  url = url.replace(/\/api\/?$/, '').replace(/\/$/, '');
  return url;
}

// Sender ID constant
const SENDER_ID = 'N-Alert';

// Validate API key on module load
const apiKey = getTermiiApiKey();
if (!apiKey) {
  logger.error('TERMII_API_KEY is not configured');
}

/**
 * Send single SMS via Termii API (for personalized messages)
 * @param {string} phoneNumber - Phone number
 * @param {string} message - SMS message content
 * @param {string} channel - 'dnd' or 'generic'
 * @returns {Promise<Object>} Termii API response
 */
export async function sendSingleSMS(phoneNumber, message, channel = 'dnd') {
  const TERMII_API_KEY = getTermiiApiKey();
  const TERMII_BASE_URL = getTermiiBaseUrl();
  
  if (!TERMII_API_KEY) {
    throw new Error('TERMII_API_KEY is not configured');
  }

  // SMS sending in progress

  try {
    const response = await axios.post(
      `${TERMII_BASE_URL}/api/sms/send`,
      {
        api_key: TERMII_API_KEY,
        to: phoneNumber,
        from: SENDER_ID,
        sms: message,
        type: 'plain',
        channel: channel,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // SMS sent successfully

    return response.data;
  } catch (error) {
    const errorMsg = error.response
      ? `Termii API error: ${error.response.data?.message || error.response.statusText}`
      : error.message;
    logger.error('Failed to send SMS:', errorMsg);
    if (error.response) {
      throw new Error(errorMsg);
    }
    throw error;
  }
}

/**
 * Send bulk SMS via Termii API (same message to all recipients)
 * @param {Array<string>} phoneNumbers - Array of phone numbers (max 100)
 * @param {string} message - SMS message content
 * @param {string} channel - 'dnd' or 'generic'
 * @returns {Promise<Object>} Termii API response
 */
export async function sendBulkSMS(phoneNumbers, message, channel = 'dnd') {
  const TERMII_API_KEY = getTermiiApiKey();
  const TERMII_BASE_URL = getTermiiBaseUrl();
  
  if (!TERMII_API_KEY) {
    throw new Error('TERMII_API_KEY is not configured');
  }

  if (phoneNumbers.length > 100) {
    throw new Error('Maximum 100 phone numbers per batch');
  }

  logger.info(`Sending bulk SMS to ${phoneNumbers.length} recipients`);

  try {
    const response = await axios.post(
      `${TERMII_BASE_URL}/api/sms/send/bulk`,
      {
        api_key: TERMII_API_KEY,
        to: phoneNumbers,
        from: SENDER_ID,
        sms: message,
        type: 'plain',
        channel: channel,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info(`Bulk SMS sent successfully to ${phoneNumbers.length} recipients`);

    return response.data;
  } catch (error) {
    const errorMsg = error.response
      ? `Termii API error: ${error.response.data?.message || error.response.statusText}`
      : error.message;
    logger.error(`Failed to send bulk SMS:`, errorMsg);
    if (error.response) {
      throw new Error(errorMsg);
    }
    throw error;
  }
}
