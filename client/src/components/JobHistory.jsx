import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config.js';

const JOBS_STORAGE_KEY = 'sms_jobs_history';

export function JobHistory({ onSelectJob }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [jobStatuses, setJobStatuses] = useState({});

  useEffect(() => {
    loadJobHistory();
  }, []);

  const loadJobHistory = () => {
    const saved = localStorage.getItem(JOBS_STORAGE_KEY);
    if (saved) {
      try {
        const jobList = JSON.parse(saved);
        setJobs(jobList);
        // Fetch status for each job
        jobList.forEach((job) => {
          fetchJobStatus(job.jobId);
        });
      } catch (error) {
        console.error('Error loading job history:', error);
      }
    }
  };

  const fetchJobStatus = async (jobId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`);
      if (response.ok) {
        const data = await response.json();
        setJobStatuses((prev) => ({
          ...prev,
          [jobId]: data.state || 'unknown',
        }));
      }
    } catch (error) {
      console.error('Error fetching job status:', error);
    }
  };

  if (jobs.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm text-gray-600">No job history found</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Jobs</h4>
      <div className="space-y-2">
        {jobs.map((job) => {
          const status = jobStatuses[job.jobId] || 'unknown';
          return (
            <div
              key={job.jobId}
              onClick={() => onSelectJob(job.jobId)}
              className="p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">
                    {job.template}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs text-gray-500">
                      {new Date(job.createdAt).toLocaleString()}
                    </p>
                    <span className="text-xs text-gray-500">•</span>
                    <p className="text-xs text-gray-500">
                      {job.rowCount} recipient(s)
                    </p>
                    <span className="text-xs text-gray-500">•</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : status === 'active'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {status.toUpperCase()}
                    </span>
                  </div>
                </div>
                <button className="text-xs text-blue-600 hover:text-blue-700">
                  View →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
