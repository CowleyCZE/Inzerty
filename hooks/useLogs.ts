import { useState, useEffect } from 'react';
import { LogEntry } from '../types';

export const useLogs = () => {
  const [runtimeLogs, setRuntimeLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    let mounted = true;
    const fetchLogs = async () => {
      try {
        const res = await fetch('http://localhost:3001/logs');
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setRuntimeLogs(Array.isArray(data.logs) ? data.logs : []);
      } catch {
        // ignore log polling errors
      }
    };

    fetchLogs();
    const timer = setInterval(fetchLogs, 1500);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return {
    runtimeLogs,
  };
};
