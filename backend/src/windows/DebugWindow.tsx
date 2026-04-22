import React, { useState, useEffect } from 'react';
import '../styles/debug.css';

interface LogEntry {
  level: string;
  message: string;
  window: string;
  time: string;
  timestamp: number;
}

const DebugWindow: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [lastEvent, setLastEvent] = useState(0);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:9222');

    ws.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data);
        const logEntry = {
          ...entry,
          time: new Date(entry.timestamp || Date.now()).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
        setLogs(prev => [logEntry, ...prev].slice(0, 500));
        setLastEvent(Date.now());
      } catch (e) {}
    };

    return () => ws.close();
  }, []);

  const filteredLogs = logs.filter(l => filter === 'all' || l.level === filter);

  const getSourceClass = (window: string) => {
    switch (window) {
      case 'control': return 'control';
      case 'overlay': return 'overlay';
      case 'ticker': return 'ticker';
      case 'reaction': return 'reaction';
      default: return 'default';
    }
  };

  return (
    <div className="debug-shell">
      <header className="debug-header">
        <div className="debug-header-left">
          <div className={`debug-status-dot ${Date.now() - lastEvent < 500 ? 'active' : 'idle'}`}></div>
          <span className="debug-title">Log Stream</span>
          <div className="debug-filter-group">
            {(['all', 'info', 'warn', 'error'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`debug-filter-btn ${filter === f ? 'active' : ''}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="debug-header-right">
          <span className="debug-event-count">{logs.length} EVENTS</span>
          <button onClick={() => setLogs([])} className="debug-clear-btn">CLEAR</button>
        </div>
      </header>

      <div className="debug-log-container">
        <div className="debug-log-list">
          {filteredLogs.map((log, i) => (
            <div key={i} className={`debug-log-entry ${log.level}`}>
              <span className="debug-log-time">{log.time}</span>
              <span className={`debug-log-source ${getSourceClass(log.window)}`}>
                {log.window}
              </span>
              <span className={`debug-log-message ${log.level}`}>
                {log.message}
              </span>
            </div>
          ))}
        </div>
        {filteredLogs.length === 0 && (
          <div className="debug-empty-state">
            <div className="debug-spinner"></div>
            <div className="debug-empty-text">Idle - Awaiting Signal</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugWindow;
