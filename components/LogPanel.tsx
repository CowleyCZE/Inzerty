import React, { useRef, useEffect } from 'react';

const LogPanel = ({ logs }) => {
  const logContainerRef = useRef(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (type) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'success': return 'text-green-400';
      case 'system': return 'text-sky-400';
      case 'info':
      default: return 'text-slate-300';
    }
  };
  
  const getLogIcon = (type) => {
    switch (type) {
      case 'error': return <span className="mr-2 text-red-500 shrink-0">❌</span>;
      case 'success': return <span className="mr-2 text-green-500 shrink-0">✅</span>;
      case 'system': return <span className="mr-2 text-sky-500 shrink-0">⚙️</span>;
      case 'info':
      default: return <span className="mr-2 text-slate-500 shrink-0">ℹ️</span>;
    }
  };


  return (
    <div className="mt-8 bg-slate-800 p-6 rounded-xl shadow-2xl">
      <h2 className="text-xl font-semibold text-sky-400 mb-4 border-b border-slate-700 pb-2 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="hero-icon w-6 h-6 mr-2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
        Log Událostí
      </h2>
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
