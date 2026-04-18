import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import ControlPanel from './windows/ControlPanel';
import OverlayWindow from './windows/OverlayWindow';
import TickerWindow from './windows/TickerWindow';
import ReactionWindow from './windows/ReactionWindow';
import DebugWindow from './windows/DebugWindow';
import './styles/global.css';
import './styles/control.css';
import './styles/legacy.css';
import initLogger from './utils/logger';

// Auto-detect window name from hash
const winName = window.location.hash.replace('#/', '').split('?')[0] || 'control';
initLogger(winName);

ReactDOM.createRoot(document.getElementById('root')!).render(
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
);
