import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { API_BASE_URL } from '../config.js';

export function FailedBatches({ jobId }) {
  const [failedBatches, setFailedBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBatches, setSelectedBatches] = useState(new Set());
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (jobId) {
      loadFailedBatches();
    }
  }, [jobId]);

  const loadFailedBatches = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/failed`);
      const data = await response.json();
      setFailedBatches(data.failedBatches || []);
    } catch (error) {
      console.error('Error loading failed batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleBatch = (key) => {
    const newSelected = new Set(selectedBatches);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedBatches(newSelected);
  };

  const handleExport = () => {
    if (failedBatches.length === 0) {
      toast.error('No failed batches to export');
      return;
    }

    // Collect all failed recipients
    const allFailedRecipients = [];
    failedBatches.forEach((batch) => {
      if (batch.batch && Array.isArray(batch.batch)) {
        batch.batch.forEach((recipient) => {
          allFailedRecipients.push({
            ...recipient,
            error: batch.error || 'Unknown error',
            timestamp: batch.timestamp,
            batchKey: batch.key,
          });
        });
      }
    });

    if (allFailedRecipients.length === 0) {
      toast.error('No recipients found in failed batches');
      return;
    }

    // Convert to CSV
    const headers = Object.keys(allFailedRecipients[0]);
    const csvRows = [
      headers.join(','),
      ...allFailedRecipients.map((recipient) =>
        headers.map((header) => {
          const value = recipient[header];
          // Escape commas and quotes in CSV
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      ),
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `failed_batches_${jobId}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Failed batches exported successfully', {
      description: `Exported ${allFailedRecipients.length} recipient(s)`,
    });
  };

  const handleRetry = async () => {
    if (selectedBatches.size === 0) {
      toast.error('No batches selected', {
        description: 'Please select at least one batch to retry',
      });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to retry ${selectedBatches.size} failed batch(es)?`
    );
    if (!confirmed) {
      return;
    }

    setRetrying(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batchKeys: Array.from(selectedBatches),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Retry job created successfully!', {
          description: `Job ID: ${data.jobId}`,
        });
        setSelectedBatches(new Set());
        loadFailedBatches();
      } else {
        toast.error('Failed to retry batches', {
          description: data.error || 'Please try again',
        });
      }
    } catch (error) {
      console.error('Error retrying batches:', error);
      toast.error('Network error', {
        description: 'Failed to retry batches. Please check your connection and try again.',
      });
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-600">Loading failed batches...</div>
    );
  }

  if (failedBatches.length === 0) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-green-700">No failed batches found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">
          Failed Batches ({failedBatches.length})
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-2"
            title="Export all failed batches to CSV"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
          {selectedBatches.size > 0 && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {retrying ? 'Retrying...' : `Retry Selected (${selectedBatches.size})`}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {failedBatches.map((batch) => (
          <div
            key={batch.key}
            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
              selectedBatches.has(batch.key)
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => toggleBatch(batch.key)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={selectedBatches.has(batch.key)}
                    onChange={() => toggleBatch(batch.key)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Batch ({batch.batch?.length || 0} recipients)
                  </span>
                </div>
                <p className="text-sm text-red-600 mb-1">
                  Error: {batch.error}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(batch.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
