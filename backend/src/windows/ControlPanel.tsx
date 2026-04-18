import React, { useState, useEffect } from 'react';
import { db, roomActiveMatchRef, set, matchMetaRef, update, serverTimestamp } from '../firebase/db';

const ControlPanel: React.FC = () => {
  const [settings, setSettings] = useState<any>(null);
  const [roomId, setRoomId] = useState('ipl');
  const [activeMatchId, setActiveMatchId] = useState<string>('--');
  const [matchTitle, setMatchTitle] = useState('');
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');

  useEffect(() => {
    // Initial fetch from Electron
    const init = async () => {
      // @ts-ignore
      const s = await window.overlayDesktop.getSettings();
      setSettings(s);
      setRoomId(s.roomId);
    };
    init();
  }, []);

  const generateMatchId = () => {
    return 'match_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
  };

  const handleStartMatch = async () => {
    if (!confirm(`Start new match for room "${roomId}"?`)) return;
    
    const newId = generateMatchId();
    setActiveMatchId(newId);

    // 1. Update Room's active match pointer
    await set(roomActiveMatchRef(roomId), newId);

    // 2. Initialize Match Meta
    await update(matchMetaRef(newId), {
      matchTitle: matchTitle || "Live Match",
      teamA: teamA || "Home",
      teamB: teamB || "Away",
      createdAt: serverTimestamp(),
      isLive: true
    });

    alert("Match Started: " + newId);
  };

  const toggleOverlay = async () => {
    // @ts-ignore
    await window.overlayDesktop.toggleDebugWindow(); // Just as example
    if (settings?.overlayVisible) {
      // @ts-ignore
      await window.overlayDesktop.hideOverlay();
    } else {
      // @ts-ignore
      await window.overlayDesktop.showOverlay();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] text-slate-200">
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/50">
        <h1 className="font-bold text-lg tracking-tight">OverlayChat <span className="text-indigo-400 font-normal">Broadcaster</span></h1>
        <div className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded border border-indigo-500/20 uppercase font-bold tracking-widest">
           Room: {roomId}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Match Config */}
        <section className="bg-slate-800/40 rounded-2xl border border-slate-700/50 p-6 space-y-6">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Live Match Session</h2>
          
          <div className="space-y-4">
             <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Match Title</label>
                <input 
                  value={matchTitle} onChange={e => setMatchTitle(e.target.value)}
                  placeholder="IPL 2026: Final"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm focus:ring-2 ring-indigo-500/20 outline-none"
                />
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">Home Team</label>
                  <input 
                    value={teamA} onChange={e => setTeamA(e.target.value)}
                    placeholder="MI"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm focus:ring-2 ring-indigo-500/20 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">Away Team</label>
                  <input 
                    value={teamB} onChange={e => setTeamB(e.target.value)}
                    placeholder="CSK"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm focus:ring-2 ring-indigo-500/20 outline-none"
                  />
                </div>
             </div>

             <button 
                onClick={handleStartMatch}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-sm transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
             >
                Initialize Live Match
             </button>
          </div>
        </section>

        {/* Visibility Toggles */}
        <section className="grid grid-cols-2 gap-4">
           <button 
             onClick={toggleOverlay}
             className="p-5 rounded-3xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-700/50 transition-all text-left group"
           >
              <div className="w-12 h-12 bg-slate-700 rounded-2xl flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">📺</div>
              <p className="font-bold text-sm">Main Overlay</p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{settings?.overlayVisible ? 'Visible' : 'Hidden'}</p>
           </button>

           <button 
             className="p-5 rounded-3xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-700/50 transition-all text-left"
           >
              <div className="w-12 h-12 bg-slate-700 rounded-2xl flex items-center justify-center text-xl mb-4">💬</div>
              <p className="font-bold text-sm">Mod Panel</p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Chat & Flags</p>
           </button>
        </section>

      </main>
      
      <footer className="p-4 flex justify-between text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] bg-slate-900/50 border-t border-slate-800">
         <span>Build v{settings?.appVersion || '1.0.9'}</span>
         <span>Environment: {settings?.appMode || 'local'}</span>
      </footer>
    </div>
  );
};

export default ControlPanel;
