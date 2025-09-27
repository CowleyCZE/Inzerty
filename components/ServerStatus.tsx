import React, { useState, useEffect } from 'react';

interface ServerStatus {
  frontend: boolean;
  backend: boolean;
}

const ServerStatus: React.FC = () => {
  const [status, setStatus] = useState<ServerStatus>({ frontend: true, backend: false });

  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const response = await fetch('/api/status');
        if (response.ok) {
          setStatus({ frontend: true, backend: true });
        } else {
          setStatus({ frontend: true, backend: false });
        }
      } catch (error) {
        setStatus({ frontend: true, backend: false });
      }
    };

    checkServerStatus();
    const interval = setInterval(checkServerStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const StatusIndicator = ({ name, isOnline }: { name: string; isOnline: boolean }) => (
    <div className="status-indicator" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
      <span>{name}:</span>
      <div 
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: isOnline ? '#22c55e' : '#ef4444'
        }}
      />
      <span style={{ fontSize: '12px', color: isOnline ? '#22c55e' : '#ef4444' }}>
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );

  return (
    <div className="server-status" style={{ padding: '10px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>Server Status</h4>
      <StatusIndicator name="Frontend" isOnline={status.frontend} />
      <StatusIndicator name="Backend" isOnline={status.backend} />
    </div>
  );
};

export default ServerStatus;
