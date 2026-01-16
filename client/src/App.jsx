import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { CSVUpload } from './components/CSVUpload';
import { TemplateEditor } from './components/TemplateEditor';
import { ProgressDashboard } from './components/ProgressDashboard';
import { FailedBatches } from './components/FailedBatches';
import { CSVPreview } from './components/CSVPreview';
import { JobHistory } from './components/JobHistory';
import { JobDetailsModal } from './components/JobDetailsModal';
import { API_BASE_URL } from './config.js';
import './App.css';
const TEMPLATES_STORAGE_KEY = 'sms_templates';
const JOBS_STORAGE_KEY = 'sms_jobs_history';

function App() {
  const [csvFile, setCsvFile] = useState(null);
  const [csvColumns, setCsvColumns] = useState([]);
  const [template, setTemplate] = useState('');
  const [channel, setChannel] = useState('dnd');
  const [jobId, setJobId] = useState(null);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [showFailedBatches, setShowFailedBatches] = useState(false);
  const [parsingCSV, setParsingCSV] = useState(false);
  const [csvData, setCsvData] = useState(null);
  const [csvRowCount, setCsvRowCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showJobHistory, setShowJobHistory] = useState(false);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(null);

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
    // Validate file type
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast.error('Invalid file type', {
        description: 'Please upload a CSV file (.csv)',
      });
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('File too large', {
        description: `File size must be less than ${(maxSize / 1024 / 1024).toFixed(0)}MB`,
      });
      return;
    }

    setCsvFile(file);
    setParsingCSV(true);
    setCsvColumns([]);
    setCsvData(null);
    setCsvRowCount(0);

    // Parse CSV to extract column names
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV parsing warnings:', results.errors);
          toast.warning('CSV parsing completed with warnings', {
            description: `${results.errors.length} warning(s) found`,
          });
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
          setCsvData(results.data);
          setCsvRowCount(results.data.length);
          
          // Check for phone number column
          const hasPhoneColumn = columns.some(col => 
            col.key.includes('phone') || col.key.includes('number')
          );
          
          if (!hasPhoneColumn) {
            toast.warning('No phone number column detected', {
              description: 'Please ensure your CSV has a column containing "phone" or "number"',
            });
          } else {
            toast.success('CSV file loaded successfully', {
              description: `Found ${results.data.length} row(s) with ${columns.length} column(s)`,
            });
          }
        } else {
          toast.error('CSV file is empty', {
            description: 'Please upload a CSV file with data rows',
          });
          setCsvFile(null);
        }
        setParsingCSV(false);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        toast.error('Error parsing CSV file', {
          description: 'Please check the file format and try again',
        });
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
    toast.success('Template saved successfully!');
  };

  const handleUpdateTemplate = (oldName, newName, newContent) => {
    const updated = savedTemplates.map(t => 
      t.name === oldName 
        ? { ...t, name: newName, content: newContent, updatedAt: new Date().toISOString() }
        : t
    );
    setSavedTemplates(updated);
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updated));
    toast.success('Template updated successfully!');
  };

  const handleDeleteTemplate = (name) => {
    const updated = savedTemplates.filter(t => t.name !== name);
    setSavedTemplates(updated);
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updated));
    toast.success('Template deleted successfully!');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!csvFile) {
      toast.error('CSV file required', {
        description: 'Please upload a CSV file before submitting',
      });
      return;
    }

    if (!template.trim()) {
      toast.error('Template required', {
        description: 'Please enter a message template',
      });
      return;
    }

    setIsSubmitting(true);
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
        
        // Save job to history
        const jobHistory = JSON.parse(localStorage.getItem(JOBS_STORAGE_KEY) || '[]');
        jobHistory.unshift({
          jobId: data.jobId,
          createdAt: new Date().toISOString(),
          template: template.substring(0, 50) + (template.length > 50 ? '...' : ''),
          channel,
          rowCount: csvRowCount,
        });
        localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobHistory.slice(0, 50))); // Keep last 50 jobs
        
        toast.success('Job created successfully!', {
          description: `Processing started for ${csvRowCount} recipient(s)`,
        });
      } else {
        toast.error('Failed to create job', {
          description: data.error || 'Please try again',
        });
      }
    } catch (error) {
      console.error('Error uploading:', error);
      toast.error('Network error', {
        description: 'Failed to connect to server. Please check your connection and try again.',
      });
    } finally {
      setIsSubmitting(false);
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
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  CSV File
                </label>
                <button
                  type="button"
                  onClick={() => setShowJobHistory(!showJobHistory)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {showJobHistory ? 'Hide' : 'Show'} Job History
                </button>
              </div>
              {showJobHistory && (
                <div className="mb-4">
                  <JobHistory 
                    onSelectJob={(jobId) => {
                      setJobId(jobId);
                      setShowJobHistory(false);
                      toast.info('Loading job details...');
                    }}
                  />
                </div>
              )}
              <CSVUpload onFileSelect={handleFileSelect} disabled={parsingCSV} />
              {parsingCSV && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <p className="text-sm text-blue-600">Parsing CSV file...</p>
                </div>
              )}
              {csvFile && !parsingCSV && csvData && (
                <div className="mt-4">
                  <CSVPreview 
                    data={csvData} 
                    columns={csvColumns}
                    rowCount={csvRowCount}
                    fileName={csvFile.name}
                  />
                </div>
              )}
            </div>

            <div>
              <TemplateEditor
                value={template}
                onChange={setTemplate}
                onSave={handleSaveTemplate}
                onUpdate={handleUpdateTemplate}
                onDelete={handleDeleteTemplate}
                savedTemplates={savedTemplates}
                csvColumns={csvColumns}
                recipientCount={csvRowCount}
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
              disabled={isSubmitting || parsingCSV || !csvFile || !template.trim()}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating Job...
                </>
              ) : (
                'Start Sending SMS'
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <ProgressDashboard 
              jobId={jobId} 
              onComplete={handleJobComplete}
              onBack={handleReset}
              onShowDetails={(id) => {
                setSelectedJobId(id);
                setShowJobDetails(true);
              }}
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

        {/* Job Details Modal */}
        <JobDetailsModal
          jobId={selectedJobId || jobId}
          isOpen={showJobDetails}
          onClose={() => {
            setShowJobDetails(false);
            setSelectedJobId(null);
          }}
        />
      </div>
    </div>
  );
}

export default App;
