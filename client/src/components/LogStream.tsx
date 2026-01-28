import React, { useEffect, useRef } from 'react';

export interface LogEntry {
  id: number;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'check';
  message: string;
  details?: string;
}

interface LogStreamProps {
  logs: LogEntry[];
  isRunning: boolean;
}

export const LogStream: React.FC<LogStreamProps> = ({ logs, isRunning }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const getIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'info': return '📋';
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'check': return '🔍';
      default: return '•';
    }
  };

  const getColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'info': return 'text-blue-400';
      case 'success': return 'text-green-400';
      case 'warning': return 'text-amber-400';
      case 'error': return 'text-red-400';
      case 'check': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm font-mono">Deployment Check Log</span>
          {isRunning && (
            <span className="flex items-center gap-1 text-green-400 text-xs">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Running
            </span>
          )}
        </div>
        <span className="text-gray-500 text-xs">{logs.length} entries</span>
      </div>

      {/* Log entries */}
      <div 
        ref={containerRef}
        className="h-64 overflow-y-auto p-3 font-mono text-sm space-y-1"
      >
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            Click "Check Deployments" to start...
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 animate-fadeIn">
              <span className="text-gray-600 text-xs whitespace-nowrap">
                {log.timestamp.toLocaleTimeString()}
              </span>
              <span>{getIcon(log.type)}</span>
              <div className="flex-1">
                <span className={getColor(log.type)}>{log.message}</span>
                {log.details && (
                  <span className="text-gray-500 ml-2 text-xs">{log.details}</span>
                )}
              </div>
            </div>
          ))
        )}
        
        {/* Cursor blink effect when running */}
        {isRunning && (
          <div className="flex items-center gap-1 text-green-400">
            <span className="animate-pulse">▋</span>
          </div>
        )}
      </div>
    </div>
  );
};
