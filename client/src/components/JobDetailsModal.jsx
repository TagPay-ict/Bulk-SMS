import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config.js';
import { toast } from 'sonner';

export function JobDetailsModal({ jobId, isOpen, onClose }) {
  const [jobDetails, setJobDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (isOpen && jobId) {
      fetchJobDetails();
      // Set up polling for progress updates
      const interval = setInterval(() => {
        fetchJobProgress();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen, jobId]);

  const fetchJobDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`);
      if (response.ok) {
        const data = await response.json();
        // Try to get job history for additional metadata
        const jobHistory = JSON.parse(localStorage.getItem('sms_jobs_history') || '[]');
        const historyEntry = jobHistory.find(j => j.jobId === jobId);
        
        setJobDetails({
          ...data,
          createdAt: historyEntry?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          channel: historyEntry?.channel,
          senderId: 'N-Alert', // Constant sender ID
        });
      } else {
        toast.error('Failed to load job details');
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
      toast.error('Network error loading job details');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobProgress = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`);
      if (response.ok) {
        const data = await response.json();
        setProgress(data.progress || {});
      }
    } catch (error) {
      // Silently fail for progress updates
    }
  };

  const copyJobId = () => {
    navigator.clipboard.writeText(jobId);
    toast.success('Job ID copied to clipboard');
  };

  if (!isOpen) return null;

  const { state, createdAt, updatedAt } = jobDetails || {};
  const { total = 0, processed = 0, failed = 0, batches = 0 } = progress || {};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Job Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : jobDetails ? (
            <div className="space-y-6">
              {/* Job ID */}
              <div>
                <label className="text-sm font-medium text-gray-500">Job ID</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono text-gray-800 flex-1">
                    {jobId}
                  </code>
                  <button
                    onClick={copyJobId}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      state === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : state === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : state === 'active'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {state?.toUpperCase() || 'UNKNOWN'}
                  </span>
                </div>
              </div>

              {/* Progress Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Total Recipients</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{total}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-500">Processed</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{processed}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-gray-500">Failed</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{failed}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-500">Batches</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{batches}</p>
                </div>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Created At</label>
                  <p className="text-sm text-gray-700 mt-1">
                    {createdAt ? new Date(createdAt).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Updated</label>
                  <p className="text-sm text-gray-700 mt-1">
                    {updatedAt ? new Date(updatedAt).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Additional Info */}
              {jobDetails.channel && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Channel</label>
                  <p className="text-sm text-gray-700 mt-1 capitalize">{jobDetails.channel}</p>
                </div>
              )}

              {jobDetails.senderId && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Sender ID</label>
                  <p className="text-sm text-gray-700 mt-1">{jobDetails.senderId}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Failed to load job details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
