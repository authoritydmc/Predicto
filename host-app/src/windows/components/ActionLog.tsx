import React from 'react';

interface LogEntry {
  action: string;
  timestamp: number;
  success: boolean;
  details?: string;
  firebaseCalls?: string[];
}

interface ActionLogProps {
  isOpen: boolean;
  onToggle: () => void;
  entries: LogEntry[];
}

export const ActionLog: React.FC<ActionLogProps> = ({ isOpen, onToggle, entries }) => {
  return (
    <>
      {/* Toggle Button */}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 9998,
        }}
      >
        <button
          onClick={onToggle}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            fontSize: '12px',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
          }}
        >
          {isOpen ? 'Hide' : 'Show'} Action Log ({entries.length})
        </button>
      </div>

      {/* Log Panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 80,
            right: 20,
            width: '400px',
            height: '300px',
            background: 'rgba(5, 7, 10, 0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            zIndex: 9997,
            padding: '16px',
            overflow: 'auto',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div style={{ fontWeight: '700', marginBottom: '12px', color: 'white' }}>
            Action History (Last {entries.length})
          </div>
          {entries.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>No actions logged yet</div>
          ) : (
            entries.map((entry, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '8px',
                  padding: '8px',
                  background: entry.success ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)',
                  border: `1px solid ${entry.success ? 'rgba(52, 199, 89, 0.3)' : 'rgba(255, 59, 48, 0.3)'}`,
                  borderRadius: '4px',
                  fontSize: '11px',
                }}
              >
                <div
                  style={{
                    fontWeight: '600',
                    color: entry.success ? 'var(--system-green)' : 'var(--system-red)',
                    marginBottom: '2px',
                  }}
                >
                  {entry.success ? '✓' : '✗'} {entry.action}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '10px' }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                  {entry.details && ` • ${entry.details}`}
                </div>
                {entry.firebaseCalls && entry.firebaseCalls.length > 0 && (
                  <div style={{ color: 'var(--system-blue)', fontSize: '10px', marginTop: '2px' }}>
                    Firebase calls: {entry.firebaseCalls.length}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
};
