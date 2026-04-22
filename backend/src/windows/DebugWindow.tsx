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

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-slate-300 font-mono text-[11px] overflow-hidden selection:bg-indigo-500/30">
      <header className="flex justify-between items-center bg-[#070e1b] border-b border-white/5 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
           <div className={`w-2 h-2 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-300 ${Date.now() - lastEvent < 500 ? 'bg-emerald-400 scale-125' : 'bg-emerald-600 animate-pulse'}`}></div>
           <span className="font-bold uppercase tracking-[0.2em] text-indigo-400 text-[10px]">Log Stream</span>
           <div className="flex bg-black/50 rounded-lg p-0.5 ml-4 border border-white/5">
             {(['all', 'info', 'warn', 'error'] as const).map(f => (
               <button 
                 key={f}
                 onClick={() => setFilter(f)}
                 className={`px-3 py-1 rounded-md text-[9px] uppercase font-black transition-all ${filter === f ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}
               >
                 {f}
               </button>
             ))}
           </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-slate-600 font-bold tabular-nums">{logs.length} EVENTS</span>
          <button onClick={() => setLogs([])} className="text-[9px] hover:bg-rose-500/20 text-rose-500/80 px-4 py-1.5 rounded-lg border border-rose-500/20 transition-all font-black uppercase tracking-widest bg-rose-500/5">CLEAR</button>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar">
         <div className="p-4 space-y-px">
            {filteredLogs.map((log, i) => {
              const colorClass = log.level === 'error' ? 'text-rose-400 drop-shadow-[0_0_3px_rgba(251,113,133,0.3)]' : 
                                log.level === 'warn' ? 'text-amber-300/90' : 'text-slate-300';
              const bgClass = log.level === 'error' ? 'bg-rose-500/10 border-rose-500/20' : 
                               log.level === 'warn' ? 'bg-amber-500/5 border-amber-500/10' : 'bg-transparent border-transparent';
              
              return (
                <div key={i} className={`flex gap-4 py-1.5 px-3 rounded-md border transition-all hover:bg-white/[0.03] active:scale-[0.99] ${bgClass}`}>
                   <span className="text-slate-600 shrink-0 select-none w-16 tabular-nums">{log.time}</span>
                   <span className={`shrink-0 w-24 truncate font-black uppercase text-[8px] px-2 py-0.5 rounded-full border self-center text-center ${
                     log.window === 'control' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                     log.window === 'overlay' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                     log.window === 'ticker' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-800/50 text-slate-500 border-white/5'
                   }`}>
                     {log.window}
                   </span>
                   <span className={`flex-1 break-all leading-normal text-[10.5px] ${colorClass}`}>
                     {log.message}
                   </span>
                </div>
              );
            })}
         </div>
         {filteredLogs.length === 0 && (
           <div className="flex flex-col items-center justify-center h-[70vh] opacity-20 gap-4">
             <div className="w-10 h-10 rounded-xl border-2 border-indigo-500/30 border-t-indigo-500 animate-spin"></div>
             <div className="text-[11px] uppercase tracking-[0.3em] font-black text-indigo-400">Idle - Awaiting Signal</div>
           </div>
         )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #01040a; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; border: 2px solid #01040a; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}} />
    </div>
  );
};

export default DebugWindow;
