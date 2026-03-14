import React, { useRef, useEffect } from 'react';

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'system';
}

interface LogPanelProps {
  logs: LogEntry[];
}

const LogPanel: React.FC<LogPanelProps> = ({ logs }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (type: LogEntry['type']): string => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'success': return 'text-green-400';
      case 'system': return 'text-sky-400';
      case 'info':
      default: return 'text-slate-300';
    }
  };

  const getLogIcon = (type: LogEntry['type']): React.ReactNode => {
    switch (type) {
      case 'error': return <span className="mr-2 text-red-500 shrink-0">❌</span>;
      case 'success': return <span className="mr-2 text-green-500 shrink-0">✅</span>;
      case 'system': return <span className="mr-2 text-sky-500 shrink-0">⚙️</span>;
      case 'info':
      default: return <span className="mr-2 text-slate-500 shrink-0">ℹ️</span>;
    }
  };

  const handleCopyLogs = async () => {
    const logText = logs.map(log => `[${log.timestamp}] ${log.message}`).join('\n');
    try {
      await navigator.clipboard.writeText(logText);
      alert('✅ Logy zkopírovány do schránky!');
    } catch (err) {
      // Fallback pro starší prohlížeče
      const textArea = document.createElement('textarea');
      textArea.value = logText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('✅ Logy zkopírovány do schránky!');
    }
  };


  return (
    <div className="mt-8 bg-slate-800 p-6 rounded-xl shadow-2xl">
      <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-2">
        <h2 className="text-xl font-semibold text-sky-400 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="hero-icon w-6 h-6 mr-2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          Log Událostí
        </h2>
        <button
          onClick={handleCopyLogs}
          disabled={logs.length === 0}
          className="flex items-center px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
          </svg>
          Kopírovat
        </button>
      </div>
      <div
        ref={logContainerRef}
        className="h-64 overflow-y-auto bg-slate-900 p-4 rounded-lg border border-slate-700 text-sm font-mono space-y-1"
      >
        {logs.map(log => (
          <div key={log.id} className={`flex items-start ${getLogColor(log.type)}`}>
            {getLogIcon(log.type)}
            <span className="text-slate-500 mr-2 shrink-0">[{log.timestamp}]</span>
            <span className="break-all">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogPanel;
