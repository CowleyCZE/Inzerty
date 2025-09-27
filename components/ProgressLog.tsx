import React from 'react';
import { LogEntry } from '../types';

interface ProgressLogProps {
  logs: LogEntry[];
}

const ProgressLog: React.FC<ProgressLogProps> = ({ logs }) => {
  return (
    <div className="progress-log">
      <h3>Progress Log</h3>
      <div className="log-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {logs.map((log, index) => (
          <div key={index} className={`log-entry ${log.type}`}>
            <span className="log-message">{log.message}</span>
            {log.progress && (
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${log.progress}%` }}
                ></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgressLog;
