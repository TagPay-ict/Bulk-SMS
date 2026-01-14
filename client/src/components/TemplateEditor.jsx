import { useState, useEffect } from 'react';

export function TemplateEditor({ value, onChange, onSave, savedTemplates, csvColumns = [] }) {
  const [preview, setPreview] = useState('');
  const [templateName, setTemplateName] = useState('');

  useEffect(() => {
    // Generate preview with sample data based on CSV columns
    const sampleData = {};
    csvColumns.forEach(({ key, originalKey }) => {
      // Generate sample values based on column name
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('phone') || lowerKey.includes('number')) {
        sampleData[key] = '2349012345678';
      } else if (lowerKey.includes('name')) {
        sampleData[key] = 'John Doe';
      } else if (lowerKey.includes('account')) {
        sampleData[key] = '1234567890';
      } else if (lowerKey.includes('email')) {
        sampleData[key] = 'john@example.com';
      } else {
        sampleData[key] = `Sample ${originalKey}`;
      }
    });
    
    let previewText = value;
    // Replace all placeholders found in the template
    csvColumns.forEach(({ key, example }) => {
      const regex = new RegExp(example.replace(/[{}]/g, '\\$&'), 'gi');
      previewText = previewText.replace(regex, sampleData[key] || '');
    });
    
    // Also handle any custom placeholders that might be in the template
    const placeholderRegex = /\{\{(\w+)\}\}/g;
    previewText = previewText.replace(placeholderRegex, (match, key) => {
      const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
      return sampleData[normalizedKey] || match;
    });
    
    setPreview(previewText);
  }, [value, csvColumns]);

  const insertVariable = (variable) => {
    const textarea = document.getElementById('template-input');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue =
      value.substring(0, start) + variable + value.substring(end);
    onChange(newValue);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const handleSave = () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }
    onSave(templateName.trim(), value);
    setTemplateName('');
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Message Template
        </label>
        {csvColumns.length > 0 ? (
          <>
            <div className="mb-2">
              <p className="text-xs text-gray-500 mb-2">
                Available columns from your CSV (click to insert):
              </p>
              <div className="flex flex-wrap gap-2">
                {csvColumns.map(({ key, originalKey, example }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => insertVariable(example)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                    title={`Insert ${example}`}
                  >
                    {originalKey} ({example})
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
            ⚠️ Please upload a CSV file first to see available columns
          </div>
        )}
        <textarea
          id="template-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={csvColumns.length > 0 
            ? `Enter your message template. Use the column buttons above or type {{columnName}} for personalization.`
            : "Upload a CSV file first to see available columns for personalization."
          }
          className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={csvColumns.length === 0}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Preview
        </label>
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg min-h-[60px]">
          <p className="text-gray-700 whitespace-pre-wrap">{preview || 'Preview will appear here...'}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="Template name"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Save Template
        </button>
      </div>

      {savedTemplates.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Saved Templates
          </label>
          <div className="flex flex-wrap gap-2">
            {savedTemplates.map((template) => (
              <button
                key={template.name}
                onClick={() => onChange(template.content)}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                {template.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
