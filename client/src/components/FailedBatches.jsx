import { useState, useEffect } from 'react';
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

  const handleRetry = async () => {
    if (selectedBatches.size === 0) {
      alert('Please select at least one batch to retry');
      return;
    }

    if (
      !confirm(
        `Are you sure you want to retry ${selectedBatches.size} failed batch(es)?`
      )
    ) {
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
        alert(`Retry job created successfully! Job ID: ${data.jobId}`);
        setSelectedBatches(new Set());
        loadFailedBatches();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error retrying batches:', error);
      alert('Error retrying batches. Please try again.');
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
