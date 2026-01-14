/**
 * Replace template placeholders with actual values
 * @param {string} template - Message template with {{placeholders}}
 * @param {Object} data - Data object with keys matching placeholders
 * @returns {string} - Processed message
 */
export function processTemplate(template, data) {
  let processed = template;
  
  // Replace all placeholders: {{name}}, {{phoneNumber}}, {{accountNumber}}
  Object.keys(data).forEach((key) => {
    const placeholder = `{{${key}}}`;
    const value = data[key] || '';
    processed = processed.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
  });
  
  return processed;
}

/**
 * Check if template has placeholders that require personalization
 * @param {string} template - Message template
 * @returns {boolean} - True if template has placeholders
 */
export function hasPlaceholders(template) {
  return /\{\{(\w+)\}\}/.test(template);
}

/**
 * Extract template variables from a template string
 * @param {string} template - Message template
 * @returns {Array<string>} - Array of variable names found in template
 */
export function extractTemplateVariables(template) {
  const regex = /\{\{(\w+)\}\}/g;
  const variables = [];
  let match;
  
  while ((match = regex.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  
  return variables;
}
