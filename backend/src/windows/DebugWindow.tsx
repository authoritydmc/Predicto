import React, { useMemo, useState, useEffect } from 'react';
import '../styles/debug.css';

interface LogEntry {
  id: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  source: string;
  time: string;
  timestamp: number;
}

type LevelFilter = 'all' | LogEntry['level'];

const normalizeLevel = (value: unknown): LogEntry['level'] => {
  const level = String(value || 'info').toLowerCase();
  if (level === 'warning') return 'warn';
  if (level === 'debug' || level === 'warn' || level === 'error') return level;
  return 'info';
};

const getSource = (entry: any) =>
  String(entry.window || entry.source || entry.component || entry.name || 'system');

const getMessage = (entry: any) => {
  if (entry.message !== undefined) return String(entry.message);
  if (entry.data?.message !== undefined) return String(entry.data.message);
  return JSON.stringify(entry);
};

const isLogLike = (entry: any) =>
  Boolean(entry && (entry.level || entry.message !== undefined || entry.window || entry.source || entry.component));

const DebugWindow: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [hideNoisy, setHideNoisy] = useState(true);
  const [lastEvent, setLastEvent] = useState(0);
  const [connectionState, setConnectionState] = useState<'connecting' | 'live' | 'offline'>('connecting');

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:9222');

    ws.onopen = () => setConnectionState('live');
    ws.onclose = () => setConnectionState('offline');
    ws.onerror = () => setConnectionState('offline');

    ws.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data);
        if (!isLogLike(entry)) return;

        const timestamp = Number(entry.timestamp || entry.data?.timestamp || Date.now());
        const logEntry: LogEntry = {
          id: timestamp + Math.random(),
          level: normalizeLevel(entry.level || entry.data?.level),
          source: getSource(entry),
          message: getMessage(entry),
          timestamp,
          time: new Date(timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
        setLogs(prev => [logEntry, ...prev].slice(0, 500));
        setLastEvent(Date.now());
      } catch (e) {}
    };

    return () => ws.close();
  }, []);

  const noisyPatterns = useMemo(() => [
    'Unknown WebSocket message type',
    'Connected to automation orchestrator',
    'Disconnected from automation orchestrator'
  ], []);

  const sources = useMemo(() => (
    Array.from(new Set(logs.map(log => log.source))).sort((a, b) => a.localeCompare(b))
  ), [logs]);

  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return logs.filter(log => {
      if (levelFilter !== 'all' && log.level !== levelFilter) return false;
      if (sourceFilter !== 'all' && log.source !== sourceFilter) return false;
      if (hideNoisy && noisyPatterns.some(pattern => log.message.includes(pattern))) return false;
      if (normalizedQuery) {
        const haystack = `${log.source} ${log.level} ${log.message}`.toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [hideNoisy, levelFilter, logs, noisyPatterns, query, sourceFilter]);

  const getSourceClass = (source: string) => {
    switch (source.toLowerCase()) {
      case 'control': return 'control';
      case 'controlpanel': return 'control';
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
          <div className={`debug-status-dot ${connectionState === 'live' && Date.now() - lastEvent < 500 ? 'active' : connectionState}`}></div>
          <span className="debug-title">Log Stream</span>
          <div className="debug-filter-group" aria-label="Filter by severity">
            {(['all', 'debug', 'info', 'warn', 'error'] as const).map(f => (
              <button
                key={f}
                onClick={() => setLevelFilter(f)}
                className={`debug-filter-btn ${levelFilter === f ? 'active' : ''}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="debug-header-right">
          <span className="debug-event-count">{filteredLogs.length}/{logs.length} EVENTS</span>
          <button onClick={() => setLogs([])} className="debug-clear-btn">CLEAR</button>
        </div>
      </header>

      <section className="debug-toolbar">
        <input
          className="debug-search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Filter message, source, or level"
        />
        <select
          className="debug-source-select"
          value={sourceFilter}
          onChange={event => setSourceFilter(event.target.value)}
        >
          <option value="all">All sources</option>
          {sources.map(source => (
            <option key={source} value={source}>{source}</option>
          ))}
        </select>
        <label className="debug-toggle">
          <input
            type="checkbox"
            checked={hideNoisy}
            onChange={event => setHideNoisy(event.target.checked)}
          />
          <span>Hide noise</span>
        </label>
      </section>

      <div className="debug-log-container">
        <div className="debug-log-list">
          {filteredLogs.map((log) => (
            <div key={log.id} className={`debug-log-entry ${log.level}`}>
              <span className="debug-log-time">{log.time}</span>
              <span className={`debug-log-source ${getSourceClass(log.source)}`} title={log.source}>
                {log.source}
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
            <div className="debug-empty-text">{logs.length ? 'No Matching Events' : 'Idle - Awaiting Signal'}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugWindow;
