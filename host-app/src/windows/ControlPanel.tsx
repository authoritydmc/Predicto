import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './styles/control-panel.css';

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export default function ControlPanel() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([
    { timestamp: new Date().toLocaleTimeString(), message: 'Predicto Host Admin Interface initialized', type: 'success' },
    { timestamp: new Date().toLocaleTimeString(), message: 'System ready for operation', type: 'info' }
  ]);
  const [matchStatus, setMatchStatus] = useState<'Ready' | 'Running' | 'Paused' | 'Ended'>('Ready');
  const [automationStatus, setAutomationStatus] = useState<'Stopped' | 'Running'>('Stopped');
  const [systemStatus, setSystemStatus] = useState<string>('All systems operational');

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const newLog: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
    setLogs(prev => [...prev, newLog]);
  };

  const startMatch = () => {
    addLog('Starting match...', 'info');
    setMatchStatus('Running');
  };

  const pauseMatch = () => {
    addLog('Pausing match...', 'info');
    setMatchStatus('Paused');
  };

  const endMatch = () => {
    addLog('Ending match...', 'info');
    setMatchStatus('Ended');
  };

  const toggleOverlay = () => {
    addLog('Toggling overlay window...', 'info');
    navigate('/overlay');
  };

  const toggleTicker = () => {
    addLog('Toggling ticker window...', 'info');
    navigate('/ticker');
  };

  const toggleReaction = () => {
    addLog('Toggling reaction window...', 'info');
    navigate('/reaction');
  };

  const startAutomation = () => {
    addLog('Starting automation...', 'success');
    setAutomationStatus('Running');
  };

  const stopAutomation = () => {
    addLog('Stopping automation...', 'info');
    setAutomationStatus('Stopped');
  };

  const refreshStatus = () => {
    addLog('Refreshing system status...', 'info');
    setSystemStatus('All systems operational');
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('Logs cleared', 'info');
  };

  useEffect(() => {
    // Listen for keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey) {
        switch(e.key) {
          case 'O':
            e.preventDefault();
            toggleOverlay();
            break;
          case 'T':
            e.preventDefault();
            toggleTicker();
            break;
          case 'R':
            e.preventDefault();
            toggleReaction();
            break;
          case 'C':
            e.preventDefault();
            addLog('Control window toggle requested', 'info');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getStatusClass = (status: string) => {
    switch(status) {
      case 'Running':
        return 'status-running';
      case 'Stopped':
      case 'Ended':
        return 'status-stopped';
      default:
        return 'status-ready';
    }
  };

  return (
    <div className="control-panel">
      {/* Header */}
      <header className="panel-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="app-title">Predicto Host Admin</h1>
            <p className="app-subtitle">Control Panel for Prediction Management System</p>
          </div>
          <div className="header-right">
            <div className="status-badge">v1.0.0</div>
            <div className="status-badge status-running">
              <div className="status-dot"></div>
              Online
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="panel-main">
        <div className="control-grid">
          {/* Match Control */}
          <div className="panel-card">
            <div className="card-header">
              <h2 className="card-title">🎯 Match Control</h2>
            </div>
            <div className={`status-indicator ${getStatusClass(matchStatus)}`}>
              Status: {matchStatus}
            </div>
            <div className="button-group">
              <button onClick={startMatch} className="btn btn-primary">
                Start Match
              </button>
              <button onClick={pauseMatch} className="btn btn-secondary">
                Pause Match
              </button>
              <button onClick={endMatch} className="btn btn-danger">
                End Match
              </button>
            </div>
          </div>

          {/* Window Management */}
          <div className="panel-card">
            <div className="card-header">
              <h2 className="card-title">🪟 Windows</h2>
            </div>
            <div className="button-group">
              <button onClick={toggleOverlay} className="btn btn-purple">
                Toggle Overlay
              </button>
              <button onClick={toggleTicker} className="btn btn-blue">
                Toggle Ticker
              </button>
              <button onClick={toggleReaction} className="btn btn-green">
                Toggle Reaction
              </button>
            </div>
          </div>

          {/* Automation */}
          <div className="panel-card">
            <div className="card-header">
              <h2 className="card-title">🤖 Automation</h2>
            </div>
            <div className={`status-indicator ${getStatusClass(automationStatus)}`}>
              Status: {automationStatus}
            </div>
            <div className="button-group">
              <button onClick={startAutomation} className="btn btn-primary">
                Start Automation
              </button>
              <button onClick={stopAutomation} className="btn btn-secondary">
                Stop Automation
              </button>
            </div>
          </div>

          {/* System Status */}
          <div className="panel-card">
            <div className="card-header">
              <h2 className="card-title">📊 System Status</h2>
            </div>
            <div className="status-indicator status-running">
              {systemStatus}
            </div>
            <div className="button-group">
              <button onClick={refreshStatus} className="btn btn-primary">
                Refresh Status
              </button>
            </div>
          </div>
        </div>

        {/* Logs Section */}
        <div className="panel-card logs-card">
          <div className="card-header">
            <h2 className="card-title">📝 System Logs</h2>
            <button onClick={clearLogs} className="btn btn-small btn-secondary">
              Clear Logs
            </button>
          </div>
          <div className="logs-container">
            {logs.map((log, index) => (
              <div key={index} className={`log-entry log-${log.type}`}>
                <span className="log-timestamp">[{log.timestamp}]</span>
                <span className="log-message">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
