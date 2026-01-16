import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export function TemplateEditor({ value, onChange, onSave, onUpdate, onDelete, savedTemplates, csvColumns = [], recipientCount = 0 }) {
  const [preview, setPreview] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showTemplateManager, setShowTemplateManager] = useState(false);

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

  // Calculate SMS count (160 chars per SMS)
  const SMS_LENGTH = 160;
  const charCount = value.length;
  const smsCount = Math.ceil(charCount / SMS_LENGTH);
  const getCharCountColor = () => {
    if (charCount <= SMS_LENGTH) return 'text-green-600';
    if (charCount <= SMS_LENGTH * 2) return 'text-yellow-600';
    return 'text-red-600';
  };

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
      toast.error('Template name required', {
        description: 'Please enter a name for your template',
      });
      return;
    }
    
    // Check for duplicate names
    if (savedTemplates.some(t => t.name === templateName.trim())) {
      toast.error('Template name already exists', {
        description: 'Please choose a different name',
      });
      return;
    }
    
    onSave(templateName.trim(), value);
    setTemplateName('');
    toast.success('Template saved successfully!');
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    onChange(template.content);
    setShowTemplateManager(false);
  };

  const handleUpdate = () => {
    if (!templateName.trim() || !editingTemplate) {
      toast.error('Template name required');
      return;
    }
    
    onUpdate(editingTemplate.name, templateName.trim(), value);
    setEditingTemplate(null);
    setTemplateName('');
    toast.success('Template updated successfully!');
  };

  const handleDelete = (name) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      onDelete(name);
      if (editingTemplate?.name === name) {
        setEditingTemplate(null);
        setTemplateName('');
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
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
        <div className="mt-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className={getCharCountColor()}>
              {charCount} character{charCount !== 1 ? 's' : ''}
            </span>
            <span className="text-gray-600">
              {smsCount} SMS {smsCount > 1 ? 'messages' : 'message'}
            </span>
            {recipientCount > 0 && (
              <span className="text-gray-600">
                × {recipientCount} = {smsCount * recipientCount} total SMS
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {charCount > SMS_LENGTH && (
              <span className="text-yellow-600">
                ⚠️ Multi-part message
              </span>
            )}
          </div>
        </div>
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
          placeholder={editingTemplate ? "Update template name" : "Template name"}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {editingTemplate ? (
          <>
            <button
              onClick={handleUpdate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Update
            </button>
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={handleSave}
            disabled={!value.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Template
          </button>
        )}
      </div>

      {savedTemplates.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Saved Templates ({savedTemplates.length})
            </label>
            <button
              type="button"
              onClick={() => setShowTemplateManager(!showTemplateManager)}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {showTemplateManager ? 'Hide' : 'Manage'}
            </button>
          </div>
          {showTemplateManager ? (
            <div className="space-y-2">
              {savedTemplates.map((template) => (
                <div
                  key={template.name}
                  className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">{template.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Created: {new Date(template.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onChange(template.content);
                        setShowTemplateManager(false);
                        toast.success('Template loaded');
                      }}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Use
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(template)}
                      className="px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(template.name)}
                      className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {savedTemplates.map((template) => (
                <button
                  key={template.name}
                  type="button"
                  onClick={() => {
                    onChange(template.content);
                    toast.success('Template loaded');
                  }}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  {template.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
