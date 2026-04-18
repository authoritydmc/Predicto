import React, { useState, useEffect, useRef } from 'react';

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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:9222');
    
    ws.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data);
        const logEntry = {
          ...entry,
          time: new Date(entry.timestamp || Date.now()).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
        setLogs(prev => [...prev, logEntry].slice(-200));
      } catch (e) {
        // console.error hidden to prevent loop
      }
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  const filteredLogs = logs.filter(l => filter === 'all' || l.level === filter);

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-slate-300 font-mono text-[11px] overflow-hidden selection:bg-indigo-500/30">
      <header className="flex justify-between items-center bg-[#0f172a] border-b border-white/10 px-4 py-2 shrink-0">
        <div className="flex items-center gap-3">
           <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
           <span className="font-bold uppercase tracking-widest text-indigo-400 text-[10px]">System Stream</span>
           <div className="flex bg-black/40 rounded-md p-0.5 ml-2">
             {(['all', 'info', 'warn', 'error'] as const).map(f => (
               <button 
                 key={f}
                 onClick={() => setFilter(f)}
                 className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold transition-all ${filter === f ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
               >
                 {f}
               </button>
             ))}
           </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-slate-500 uppercase">{logs.length} events</span>
          <button onClick={() => setLogs([])} className="text-[9px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-3 py-1 rounded-md border border-rose-500/20 transition-colors">CLEAR</button>
        </div>
      </header>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
         {filteredLogs.map((log, i) => (
            <div key={i} className={`flex gap-3 py-0.5 border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors ${log.level === 'error' ? 'bg-rose-500/5' : ''}`}>
               <span className="text-slate-600 shrink-0 select-none">{log.time}</span>
               <span className={`shrink-0 w-20 truncate font-bold uppercase text-[9px] px-1.5 rounded h-fit self-center ${
                 log.window === 'control' ? 'bg-blue-500/20 text-blue-400' :
                 log.window === 'overlay' ? 'bg-emerald-500/20 text-emerald-400' :
                 log.window === 'ticker' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700/50 text-slate-400'
               }`}>
                 {log.window}
               </span>
               <span className={`flex-1 break-all leading-relaxed ${
                 log.level === 'error' ? 'text-rose-400 font-medium' : 
                 log.level === 'warn' ? 'text-amber-300' : 'text-slate-300'
               }`}>
                 {log.message}
               </span>
            </div>
         ))}
         {filteredLogs.length === 0 && (
           <div className="flex flex-col items-center justify-center h-full opacity-20 gap-2">
             <div className="w-8 h-8 rounded-full border-2 border-dashed border-indigo-400 animate-spin"></div>
             <div className="text-[10px] uppercase tracking-widest">Waiting for events</div>
           </div>
         )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(51, 65, 85, 0.5); border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(71, 85, 105, 0.8); }
      `}} />
    </div>
  );
};

export default DebugWindow;
