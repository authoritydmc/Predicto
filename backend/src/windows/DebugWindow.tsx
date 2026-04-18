import React, { useState, useEffect, useRef } from 'react';

interface LogEntry {
  level: string;
  message: string;
  window: string;
  time: string;
}

const DebugWindow: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:9222');
    
    ws.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data);
        setLogs(prev => [...prev, { ...entry, time: new Date().toLocaleTimeString() }].slice(-100));
      } catch (e) {
        console.error("Failed to parse log", e);
      }
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-slate-300 font-mono text-[11px] p-4">
      <header className="flex justify-between items-center border-b border-white/10 pb-2 mb-4">
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
           <span className="font-bold uppercase tracking-widest text-indigo-400">System Log Stream</span>
        </div>
        <button onClick={() => setLogs([])} className="text-[9px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded">CLEAR</button>
      </header>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1">
         {logs.map((log, i) => (
            <div key={i} className="flex gap-3 opacity-90 hover:opacity-100 transition-opacity">
               <span className="text-slate-600">[{log.time}]</span>
               <span className="text-indigo-500 w-16 truncate">[{log.window}]</span>
               <span className={`flex-1 ${log.level === 'error' ? 'text-rose-400' : 'text-slate-300'}`}>{log.message}</span>
            </div>
         ))}
         {logs.length === 0 && <div className="text-slate-700 italic">Waiting for logs...</div>}
      </div>
    </div>
  );
};

export default DebugWindow;
