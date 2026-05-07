import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import ControlPanel from './windows/ControlPanel';
import './styles/global.css';
import './styles/control-panel.css';
import initLogger from './utils/logger';

// Performance optimizations
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => {
    console.log('[Performance] Idle callback available for optimizations');
  });
}

// Enable hardware acceleration hints
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<ControlPanel />} />
        <Route path="/control" element={<ControlPanel />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
