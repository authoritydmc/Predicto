import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import '../styles/debug.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LogEntry {
  id: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  summary: string;       // short readable label shown inline
  detail: any;           // full raw data (may be object or string)
  hasDetail: boolean;    // true when detail is worth expanding
  source: string;
  time: string;
  timestamp: number;
}

type LevelFilter = 'all' | LogEntry['level'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeLevel = (value: unknown): LogEntry['level'] => {
  const v = String(value || 'info').toLowerCase();
  if (v === 'warning') return 'warn';
  if (v === 'debug' || v === 'warn' || v === 'error') return v;
  return 'info';
};

const getSource = (entry: any): string =>
  String(entry.window || entry.source || entry.component || entry.name || 'system').toUpperCase();

/**
 * Produce a human-readable one-line summary from a raw WS entry.
 * Falls back to raw JSON only if nothing better is available.
 */
const getSummary = (entry: any): string => {
  const type = entry.type || entry.data?.type;

  // Plain text log entries
  if (entry.message) return String(entry.message);
  if (entry.data?.message) return String(entry.data.message);

  // Named message types → nice labels
  if (type === 'logger_registration') return `Component registered: ${entry.component || entry.data?.component || '?'}`;
  if (type === 'logger_status')       return `Logger status update (${entry.data?.statistics?.total_logs ?? '?'} total logs)`;
  if (type === 'log_entry')           return String(entry.data?.message || '(no message)');
  if (type === 'task_update')         return `Task updated: ${entry.data?.task?.task_id || entry.data?.task_id || '?'}`;
  if (type === 'tasks_full')          return `Full task list broadcast (${Object.keys(entry.data?.tasks || {}).length} tasks)`;
  if (type === 'get_status_response') return `Status response received`;
  if (type === 'broadcast') {
    const inner = entry.data?.type || '?';
    return `Broadcast → ${inner}`;
  }
  if (type) return `[${type}]`;

  // Last resort — short snippet
  const raw = JSON.stringify(entry);
  return raw.length > 120 ? raw.slice(0, 120) + '…' : raw;
};

/**
 * Is the detail worth showing in an expanded panel?
 */
const shouldShowDetail = (entry: any): boolean => {
  const type = entry.type || entry.data?.type;
  // Always suppress these noisy infra types
  if (type === 'logger_registration') return false;
  if (type === 'logger_status')       return false;
  if (type === 'log_entry' && !entry.data?.data) return false;
  // If there's actual nested data, always worth expanding
  return typeof entry === 'object' && entry !== null;
};

const isLogLike = (entry: any) =>
  Boolean(entry && (entry.level || entry.message !== undefined || entry.window || entry.source || entry.component || entry.type));

// ─── JSON Renderer ────────────────────────────────────────────────────────────

const JsonNode: React.FC<{ value: any; depth?: number }> = ({ value, depth = 0 }) => {
  const [open, setOpen] = useState(depth < 2);

  if (value === null)    return <span className="dbg-null">null</span>;
  if (value === true)    return <span className="dbg-bool">true</span>;
  if (value === false)   return <span className="dbg-bool">false</span>;
  if (typeof value === 'number') return <span className="dbg-num">{value}</span>;
  if (typeof value === 'string') return <span className="dbg-str">"{value}"</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="dbg-punc">[]</span>;
    return (
      <span>
        <button className="dbg-collapse-btn" onClick={() => setOpen(p => !p)}>
          {open ? '▾' : '▸'} [{value.length}]
        </button>
        {open && (
          <div className="dbg-indent">
            {value.map((item, i) => (
              <div key={i} className="dbg-line">
                <JsonNode value={item} depth={depth + 1} />
                {i < value.length - 1 && <span className="dbg-punc">,</span>}
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return <span className="dbg-punc">{'{}'}</span>;
    return (
      <span>
        <button className="dbg-collapse-btn" onClick={() => setOpen(p => !p)}>
          {open ? '▾' : '▸'} {'{…}'}
        </button>
        {open && (
          <div className="dbg-indent">
            {entries.map(([k, v], i) => (
              <div key={k} className="dbg-line">
                <span className="dbg-key">"{k}"</span>
                <span className="dbg-colon">: </span>
                <JsonNode value={v} depth={depth + 1} />
                {i < entries.length - 1 && <span className="dbg-punc">,</span>}
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  return <span>{String(value)}</span>;
};

// ─── LogRow ───────────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<string, string> = {
  debug: '#64748b',
  info:  '#6366f1',
  warn:  '#f59e0b',
  error: '#f43f5e',
};

const LogRow: React.FC<{ log: LogEntry }> = ({ log }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const text = typeof log.detail === 'string'
      ? log.detail
      : JSON.stringify(log.detail, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [log.detail]);

  const accentColor = LEVEL_COLORS[log.level] || '#6366f1';

  return (
    <div className={`dbg-row ${log.level}`} style={{ '--accent': accentColor } as any}>
      {/* Left bar */}
      <div className="dbg-bar" />

      {/* Main content */}
      <div className="dbg-content">
        <div
          className="dbg-header-row"
          onClick={log.hasDetail ? () => setExpanded(p => !p) : undefined}
          style={{ cursor: log.hasDetail ? 'pointer' : 'default' }}
        >
          {/* Time */}
          <span className="dbg-time">{log.time}</span>

          {/* Level pill */}
          <span className="dbg-level-pill" style={{ background: accentColor + '22', color: accentColor }}>
            {log.level.toUpperCase()}
          </span>

          {/* Source */}
          <span className="dbg-source">{log.source}</span>

          {/* Expand toggle */}
          {log.hasDetail && (
            <span className="dbg-chevron" style={{ color: accentColor }}>
              {expanded ? '▾' : '▸'}
            </span>
          )}

          {/* Summary message */}
          <span className="dbg-summary">{log.summary}</span>

          {/* Copy button */}
          <button className="dbg-copy" onClick={handleCopy} title="Copy">
            {copied ? '✓' : '⎘'}
          </button>
        </div>

        {/* Expanded JSON detail */}
        {expanded && log.hasDetail && (
          <div className="dbg-detail-panel">
            <JsonNode value={log.detail} depth={0} />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

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
    ws.onopen  = () => setConnectionState('live');
    ws.onclose = () => setConnectionState('offline');
    ws.onerror = () => setConnectionState('offline');

    ws.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data);
        if (!isLogLike(entry)) return;

        const timestamp = Number(entry.timestamp || entry.data?.timestamp || Date.now());
        const raw = entry;

        // For log_entry wrapper, pull level from inside
        const levelSrc = entry.level || entry.data?.level;

        const logEntry: LogEntry = {
          id: timestamp + Math.random(),
          level: normalizeLevel(levelSrc),
          summary: getSummary(raw),
          detail: raw,
          hasDetail: shouldShowDetail(raw),
          source: getSource(raw),
          timestamp,
          time: new Date(timestamp).toLocaleTimeString([], {
            hour12: false,
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          }),
        };

        setLogs(prev => [logEntry, ...prev].slice(0, 500));
        setLastEvent(Date.now());
      } catch (_) {}
    };

    return () => ws.close();
  }, []);

  const noisyPatterns = useMemo(() => [
    'Unknown WebSocket message type',
    'Connected to automation orchestrator',
    'Disconnected from automation orchestrator',
    'Logger status update',
    'logger_status',
  ], []);

  const sources = useMemo(() =>
    Array.from(new Set(logs.map(l => l.source))).sort()
  , [logs]);

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter(log => {
      if (levelFilter !== 'all' && log.level !== levelFilter) return false;
      if (sourceFilter !== 'all' && log.source !== sourceFilter) return false;
      if (hideNoisy && noisyPatterns.some(p => log.summary.toLowerCase().includes(p.toLowerCase()))) return false;
      if (q) {
        const hay = `${log.source} ${log.level} ${log.summary}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [hideNoisy, levelFilter, logs, noisyPatterns, query, sourceFilter]);

  const isLive = connectionState === 'live' && Date.now() - lastEvent < 800;

  return (
    <div className="dbg-shell">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="dbg-top">
        <div className="dbg-top-left">
          <div className={`dbg-dot ${isLive ? 'live' : connectionState}`} />
          <span className="dbg-brand">Log Stream</span>
          <div className="dbg-level-filters">
            {(['all', 'debug', 'info', 'warn', 'error'] as const).map(f => (
              <button
                key={f}
                onClick={() => setLevelFilter(f)}
                className={`dbg-lbtn ${levelFilter === f ? 'on' : ''} ${f}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="dbg-top-right">
          <span className="dbg-count">{filteredLogs.length} / {logs.length}</span>
          <button className="dbg-clear" onClick={() => setLogs([])}>Clear</button>
        </div>
      </header>

      {/* ── Toolbar ────────────────────────────────────────────── */}
      <div className="dbg-toolbar">
        <input
          className="dbg-search"
          placeholder="Search logs…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <select className="dbg-src-sel" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          <option value="all">All sources</option>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="dbg-noise-toggle">
          <input type="checkbox" checked={hideNoisy} onChange={e => setHideNoisy(e.target.checked)} />
          Hide noise
        </label>
      </div>

      {/* ── Log list ───────────────────────────────────────────── */}
      <div className="dbg-list-wrap">
        {filteredLogs.length > 0 ? (
          <div className="dbg-list">
            {filteredLogs.map(log => <LogRow key={log.id} log={log} />)}
          </div>
        ) : (
          <div className="dbg-empty">
            <div className="dbg-spinner" />
            <p>{logs.length ? 'No matching events' : 'Waiting for events…'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugWindow;
