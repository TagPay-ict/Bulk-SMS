import { useEffect, useState, useRef } from 'react';

export function ProgressDashboard({ jobId, onComplete, onBack, onShowDetails }) {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [finalElapsedTime, setFinalElapsedTime] = useState(null); // Store final time when completed
  const [speedHistory, setSpeedHistory] = useState([]); // Track speed over time
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const previousProcessedRef = useRef(0);
  const previousTimeRef = useRef(Date.now());

  const connect = () => {
    if (!jobId) return;

    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    const eventSource = new EventSource(
      `${apiUrl}/api/jobs/${jobId}/progress`
    );

    eventSourceRef.current = eventSource;
    setIsConnected(true);
    setError(null);

    eventSource.onopen = () => {
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        // Skip heartbeat messages
        if (event.data.trim() === ': heartbeat' || event.data === 'heartbeat') {
          return;
        }

        const data = JSON.parse(event.data);
        
        if (data.error) {
          setError(data.error);
          eventSource.close();
          setIsConnected(false);
        } else {
          setProgress(data);
          
          // Calculate speed (SMS per minute)
          const currentTime = Date.now();
          const currentProcessed = data.progress?.processed || 0;
          const timeDiff = (currentTime - previousTimeRef.current) / 1000 / 60; // minutes
          
          if (timeDiff > 0 && currentProcessed > previousProcessedRef.current) {
            const smsDiff = currentProcessed - previousProcessedRef.current;
            const speed = smsDiff / timeDiff; // SMS per minute
            
            setSpeedHistory(prev => {
              const updated = [...prev, { time: currentTime, speed }];
              // Keep last 10 speed measurements for averaging
              return updated.slice(-10);
            });
            
            previousProcessedRef.current = currentProcessed;
            previousTimeRef.current = currentTime;
          }
          
          if (data.state === 'completed' || data.state === 'failed') {
            // Capture final elapsed time
            const finalTime = Math.floor((Date.now() - startTime) / 1000);
            setFinalElapsedTime(finalTime);
            setElapsedTime(finalTime);
            setIsConnected(false);
            setTimeout(() => {
              eventSource.close();
              if (onComplete) {
                onComplete(data);
              }
            }, 1000);
          }
        }
      } catch (err) {
        // Silently handle parsing errors
      }
    };

    eventSource.onerror = (err) => {
      setIsConnected(false);
      
      // Only attempt reconnection if we haven't exceeded max attempts
      if (reconnectAttempts.current < maxReconnectAttempts && eventSource.readyState === EventSource.CLOSED) {
        reconnectAttempts.current += 1;
        const delay = Math.min(1000 * reconnectAttempts.current, 10000); // Exponential backoff, max 10s
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else if (reconnectAttempts.current >= maxReconnectAttempts) {
        setError('Connection lost. Please refresh the page.');
        eventSource.close();
      }
    };
  };

  // Update elapsed time every second (stop when job is completed/failed)
  useEffect(() => {
    // Don't update if job is completed or failed (use final time if available)
    if (progress?.state === 'completed' || progress?.state === 'failed') {
      if (finalElapsedTime !== null) {
        setElapsedTime(finalElapsedTime);
      }
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, progress?.state, finalElapsedTime]);

  useEffect(() => {
    if (!jobId) return;

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!jobId) {
    return null;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-blue-700">Connecting to job progress...</p>
      </div>
    );
  }

  const { state, progress: progressData } = progress;
  const { total = 0, processed = 0, failed = 0 } = progressData || {};
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
  const remaining = total - processed;
  const successRate = processed > 0 ? Math.round(((processed - failed) / processed) * 100) : 0;
  
  // Calculate average speed (SMS per minute)
  const averageSpeed = speedHistory.length > 0
    ? Math.round(speedHistory.reduce((sum, item) => sum + item.speed, 0) / speedHistory.length)
    : 0;
  
  // Calculate ETA (Estimated Time of Arrival) in seconds
  const etaSeconds = averageSpeed > 0 && remaining > 0
    ? Math.round((remaining / averageSpeed) * 60)
    : null;
  
  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return 'Calculating...';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes < 60) return `${minutes}m ${secs}s`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };
  
  const formatElapsedTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="space-y-4">
      <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to home"
              >
                ← Back
              </button>
            )}
            <h3 className="text-lg font-semibold text-gray-800">
              Job Progress
            </h3>
            {onShowDetails && (
              <button
                onClick={() => onShowDetails(jobId)}
                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                title="View job details"
              >
                Details
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isConnected && state !== 'completed' && state !== 'failed' && (
              <span className="flex items-center gap-2 text-xs text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Live
              </span>
            )}
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                state === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : state === 'failed'
                  ? 'bg-red-100 text-red-700'
                  : state === 'active'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {state?.toUpperCase() || 'PENDING'}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>
              {processed} / {total} ({percentage}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center mb-4">
          <div>
            <p className="text-2xl font-bold text-gray-800">{total}</p>
            <p className="text-sm text-gray-600">Total</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{processed}</p>
            <p className="text-sm text-gray-600">Processed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{failed}</p>
            <p className="text-sm text-gray-600">Failed</p>
          </div>
        </div>

        {/* Enhanced metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
          <div>
            <p className="text-xs text-gray-500 mb-1">Success Rate</p>
            <p className="text-lg font-semibold text-green-600">{successRate}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Speed</p>
            <p className="text-lg font-semibold text-blue-600">
              {averageSpeed > 0 ? `${averageSpeed} SMS/min` : 'Calculating...'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Time Elapsed</p>
            <p className="text-lg font-semibold text-gray-700">{formatElapsedTime(elapsedTime)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">ETA</p>
            <p className="text-lg font-semibold text-purple-600">
              {state === 'completed' ? 'Completed' : state === 'failed' ? 'Failed' : formatTime(etaSeconds)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
