import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { CSVUpload } from './components/CSVUpload';
import { TemplateEditor } from './components/TemplateEditor';
import { ProgressDashboard } from './components/ProgressDashboard';
import { FailedBatches } from './components/FailedBatches';
import { API_BASE_URL } from './config.js';
import './App.css';
const TEMPLATES_STORAGE_KEY = 'sms_templates';

function App() {
  const [csvFile, setCsvFile] = useState(null);
  const [csvColumns, setCsvColumns] = useState([]);
  const [template, setTemplate] = useState('');
  const [channel, setChannel] = useState('dnd');
  const [jobId, setJobId] = useState(null);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [showFailedBatches, setShowFailedBatches] = useState(false);
  const [parsingCSV, setParsingCSV] = useState(false);

  // Load saved templates from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (saved) {
      try {
        setSavedTemplates(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading templates:', error);
      }
    }
  }, []);

  const handleFileSelect = async (file) => {
    setCsvFile(file);
    setParsingCSV(true);
    setCsvColumns([]);

    // Parse CSV to extract column names
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV parsing warnings:', results.errors);
        }
        
        // Extract column names from the first row
        if (results.data && results.data.length > 0) {
          const columns = Object.keys(results.data[0])
            .map(key => ({
              key: key.trim().toLowerCase().replace(/\s+/g, ''),
              originalKey: key.trim(),
              example: `{{${key.trim().toLowerCase().replace(/\s+/g, '')}}}`
            }));
          setCsvColumns(columns);
          console.log('Detected CSV columns:', columns);
        }
        setParsingCSV(false);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        alert('Error parsing CSV file. Please check the file format.');
        setParsingCSV(false);
        setCsvFile(null);
      },
    });
  };

  const handleSaveTemplate = (name, content) => {
    const newTemplate = { name, content, createdAt: new Date().toISOString() };
    const updated = [...savedTemplates, newTemplate];
    setSavedTemplates(updated);
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updated));
    alert('Template saved successfully!');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!csvFile) {
      alert('Please upload a CSV file');
      return;
    }

    if (!template.trim()) {
      alert('Please enter a message template');
      return;
    }

    const formData = new FormData();
    formData.append('csv', csvFile);
    formData.append('template', template);
    formData.append('channel', channel);

    try {
      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setJobId(data.jobId);
        setShowFailedBatches(false);
        alert('Job created successfully! Processing started.');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error uploading:', error);
      alert('Error uploading file. Please try again.');
    }
  };

  const handleJobComplete = (data) => {
    if (data.progress?.failed > 0) {
      setShowFailedBatches(true);
    }
  };

  const handleReset = () => {
    setCsvFile(null);
    setCsvColumns([]);
    setTemplate('');
    setJobId(null);
    setShowFailedBatches(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Bulk SMS Sender
        </h1>

        {!jobId ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CSV File
              </label>
              <CSVUpload onFileSelect={handleFileSelect} />
              {parsingCSV && (
                <p className="mt-2 text-sm text-blue-600">
                  Parsing CSV file...
                </p>
              )}
              {csvFile && !parsingCSV && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600">
                    Selected: <span className="font-medium">{csvFile.name}</span>
                  </p>
                  {csvColumns.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Detected {csvColumns.length} column(s): {csvColumns.map(c => c.originalKey).join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div>
              <TemplateEditor
                value={template}
                onChange={setTemplate}
                onSave={handleSaveTemplate}
                savedTemplates={savedTemplates}
                csvColumns={csvColumns}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Channel
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="dnd">DND (Transactional)</option>
                <option value="generic">Generic (Promotional)</option>
              </select>
              <p className="mt-2 text-sm text-gray-600">
                Sender ID: <span className="font-semibold">N-Alert</span>
              </p>
            </div>

            <button
              type="submit"
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Start Sending SMS
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <ProgressDashboard 
              jobId={jobId} 
              onComplete={handleJobComplete}
              onBack={handleReset}
            />

            {showFailedBatches && (
              <div className="mt-6">
                <FailedBatches jobId={jobId} />
              </div>
            )}

            <button
              onClick={handleReset}
              className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Start New Job
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
