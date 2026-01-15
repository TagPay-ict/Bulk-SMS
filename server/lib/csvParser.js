import Papa from 'papaparse';
import { logger } from './logger.js';

/**
 * Parse CSV file content
 * @param {string} csvContent - CSV file content as string
 * @returns {Promise<Array<Object>>} - Parsed CSV data
 */
export function parseCSV(csvContent) {
  return new Promise((resolve, reject) => {
    logger.info('📄 Starting CSV parsing...');
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => {
        // Normalize header names (case-insensitive, trim whitespace)
        return header.trim().toLowerCase().replace(/\s+/g, '');
      },
      complete: (results) => {
        logger.info(`✅ CSV parsed successfully - ${results.data.length} rows found`);
        if (results.errors.length > 0) {
          logger.warn(`⚠️  CSV parsing warnings: ${results.errors.length}`, results.errors);
        }
        resolve(results.data);
      },
      error: (error) => {
        logger.error('❌ CSV parsing error:', error.message);
        reject(error);
      },
    });
  });
}

/**
 * Validate and normalize CSV data
 * Preserves all columns from CSV while finding phone number for validation
 * @param {Array<Object>} data - Parsed CSV data
 * @returns {Array<Object>} - Normalized data with all columns preserved
 */
export function normalizeCSVData(data) {
  logger.info('🔄 Normalizing CSV data...');
  
  if (data.length === 0) {
    logger.warn('⚠️  No data rows found in CSV');
    return [];
  }

  // Find phone number column - only look for columns containing "phone"
  const firstRow = data[0];
  const phoneKey = Object.keys(firstRow).find(
    (key) => key.toLowerCase().includes('phone')
  );

  if (!phoneKey) {
    logger.warn('No phone number column detected. Looking for columns containing "phone"');
  }

  const normalized = data.map((row, index) => {
    // Preserve all columns from the CSV, just normalize values
    const normalizedRow = {
      originalIndex: index,
    };

    // Copy all columns, trimming string values
    Object.keys(row).forEach((key) => {
      normalizedRow[key] = String(row[key] || '').trim();
    });

    return normalizedRow;
  }).filter((row) => {
    // Filter out rows with empty phone numbers
    // Only use the detected phone key (must contain "phone" in column name)
    if (!phoneKey) {
      return false; // Skip rows if no phone column detected
    }
    const phoneValue = row[phoneKey];
    return phoneValue && phoneValue.length > 0;
  });
  
  const filteredCount = data.length - normalized.length;
  if (filteredCount > 0) {
    logger.warn(`⚠️  Filtered out ${filteredCount} rows with empty phone numbers`);
  }
  
  logger.info(`Normalized ${normalized.length} valid recipients`);
  
  return normalized;
}
