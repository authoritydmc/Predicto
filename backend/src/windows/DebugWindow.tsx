import React, { useState, useEffect, useRef } from 'react';

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  window?: string;
}

const DebugWindow: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Ported logic for WebSocket or IPC logs
    // Using simple IPC for now since main.js sends 'debug:log'
    
    // @ts-ignore
    const cleanup = window.overlayDesktop.onSettingsChanged(() => {
        // dummy cleanup
    });

    // We can use a dedicated port for logs or just IPC
    return () => cleanup && cleanup();
  }, []);

  return (
    <div className="h-screen bg-[#0a0e27] text-[#9c9c9c] font-mono text-xs flex flex-col">
      <header className="p-4 bg-[#0f1329] border-b border-[#2a2e4e] flex justify-between items-center">
        <h2 className="text-white font-bold">🖥️ System Debug Console</h2>
        <div className="flex gap-2">
            <button className="bg-[#2a2e4e] px-3 py-1 rounded hover:bg-[#3a3e5e] transition-colors">Clear</button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-1" ref={scrollRef}>
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-slate-600">[{log.timestamp}]</span>
            <span className={log.level === 'error' ? 'text-red-400' : 'text-blue-400'}>[{log.level.toUpperCase()}]</span>
            <span className="text-slate-300">{log.message}</span>
          </div>
        ))}
        {logs.length === 0 && <p className="text-slate-700 italic">Listening for system events...</p>}
      </div>
    </div>
  );
};

export default DebugWindow;
