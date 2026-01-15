import { logger } from './logger.js';

/**
 * Normalize phone number to Termii format (234XXXXXXXXXX)
 * Handles various formats including scientific notation, missing country code, etc.
 * @param {string|number} phoneInput - Phone number in any format
 * @returns {string|null} - Normalized phone number (234XXXXXXXXXX) or null if invalid
 */
export function normalizePhoneNumber(phoneInput) {
  if (!phoneInput) {
    return null;
  }

  let phone = String(phoneInput).trim();

  // Handle scientific notation (e.g., 2.34815E+12 from Excel)
  if (/[eE]/.test(phone)) {
    try {
      const numValue = parseFloat(phone);
      if (!isNaN(numValue)) {
        phone = String(Math.floor(numValue)); // Convert to integer string
      } else {
        logger.warn('Invalid scientific notation in phone number');
        return null;
      }
    } catch (error) {
      logger.warn('Error converting scientific notation in phone number');
      return null;
    }
  }

  // Remove all non-digit characters (spaces, dashes, parentheses, +, etc.)
  phone = phone.replace(/\D/g, '');

  // If empty after cleaning, invalid
  if (!phone || phone.length === 0) {
    return null;
  }

  // Handle different formats
  let normalized = null;

  // Already formatted: 234XXXXXXXXXX (13 digits)
  if (phone.startsWith('234') && phone.length === 13) {
    normalized = phone;
  }
  // International format with +234: remove + and check
  else if (phone.startsWith('234') && phone.length >= 13) {
    normalized = phone.substring(0, 13); // Take first 13 digits
  }
  // Local format starting with 0: 0XXXXXXXXXX (11 digits) → remove 0, add 234
  else if (phone.startsWith('0') && phone.length === 11) {
    normalized = '234' + phone.substring(1);
  }
  // Local format without 0: XXXXXXXXXX (10 digits) → add 234
  else if (phone.length === 10) {
    normalized = '234' + phone;
  }
  // 11 digits without leading 0: might be missing country code
  else if (phone.length === 11 && !phone.startsWith('0')) {
    // Assume it's local format, add 234
    normalized = '234' + phone;
  }
  // 9 digits: might be missing leading 0 and country code
  else if (phone.length === 9) {
    normalized = '2340' + phone;
  }
  // Already has 234 but wrong length: try to fix
  else if (phone.startsWith('234') && phone.length > 13) {
    // Take first 13 digits
    normalized = phone.substring(0, 13);
    logger.warn(`Phone number too long, truncated: ${phoneInput} → ${normalized}`);
  }
  // Other formats: try to extract valid number
  else {
    logger.warn(`Unrecognized phone format: ${phoneInput} (cleaned: ${phone}, length: ${phone.length})`);
    return null;
  }

  // Final validation: must be exactly 13 digits starting with 234
  if (normalized && normalized.length === 13 && normalized.startsWith('234')) {
    // Validate all digits are numbers
    if (/^\d{13}$/.test(normalized)) {
      return normalized;
    }
  }

  return null;
}

/**
 * Normalize multiple phone numbers
 * @param {Array<string|number>} phoneNumbers - Array of phone numbers
 * @returns {Array<{original: string, normalized: string|null}>} - Array with original and normalized
 */
export function normalizePhoneNumbers(phoneNumbers) {
  return phoneNumbers.map(phone => ({
    original: String(phone),
    normalized: normalizePhoneNumber(phone),
  }));
}
