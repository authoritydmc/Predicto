import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import ControlPanel from './windows/ControlPanel';
import OverlayWindow from './windows/OverlayWindow';
import TickerWindow from './windows/TickerWindow';
import ReactionWindow from './windows/ReactionWindow';
import DebugWindow from './windows/DebugWindow';

import './styles/global.css';
import './styles/control-panel.css';
import './styles/overlay-ticker.css';
import initLogger from './utils/logger';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: 40, 
          background: '#05070a', 
          color: '#fff', 
          minHeight: '100vh',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <h2 style={{ color: '#ef4444', marginBottom: 20 }}>Something went wrong</h2>
          <pre style={{ 
            background: 'rgba(255,255,255,0.1)', 
            padding: 20, 
            borderRadius: 8, 
            overflow: 'auto',
            fontSize: 12
          }}>
            {this.state.error?.message || 'Unknown error'}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20,
              padding: '10px 20px',
              background: '#3b82f6',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Performance optimizations
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => {
    console.log('[Performance] Idle callback available for optimizations');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (gl) {
    console.log('[Performance] WebGL acceleration available');
  }
});

// Auto-detect window name from hash
const winName = window.location.hash.replace('#/', '').split('?')[0] || 'control';
initLogger(winName);

console.log('[Main] Starting React app, window:', winName);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <React.StrictMode>
      <HashRouter>
        <Routes>
          <Route path="/" element={<ControlPanel />} />
          <Route path="/control" element={<ControlPanel />} />
          <Route path="/overlay" element={<OverlayWindow />} />
          <Route path="/ticker" element={<TickerWindow />} />
          <Route path="/reaction" element={<ReactionWindow />} />
          <Route path="/debug" element={<DebugWindow />} />
        </Routes>
      </HashRouter>
    </React.StrictMode>
  </ErrorBoundary>
);

console.log('[Main] React app mounted');
