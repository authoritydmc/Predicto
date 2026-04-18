import React, { useState, useEffect } from 'react';

// Simplified types for the new architecture
interface MatchState {
  matchId: string;
  matchTitle: string;
  teamA: string;
  teamB: string;
  isLive: boolean;
}

const ControlPanel: React.FC = () => {
  const [settings, setSettings] = useState<any>(null);
  const [matchState, setMatchState] = useState<MatchState>({
    matchId: '--',
    matchTitle: '',
    teamA: '',
    teamB: '',
    isLive: false
  });

  useEffect(() => {
    // Initial fetch from Electron preload
    const init = async () => {
      // @ts-ignore
      const s = await window.overlayDesktop.getSettings();
      setSettings(s);
    };
    init();

    // Listen for changes
    // @ts-ignore
    const cleanup = window.overlayDesktop.onSettingsChanged((s: any) => {
      setSettings(s);
    });
    return () => cleanup && cleanup();
  }, []);

  const handleUpdate = async (partial: any) => {
    // @ts-ignore
    const next = await window.overlayDesktop.updateSettings(partial);
    setSettings(next);
  };

  const toggleOverlay = async () => {
    if (settings?.overlayVisible) {
      // @ts-ignore
      await window.overlayDesktop.hideOverlay();
    } else {
      // @ts-ignore
      await window.overlayDesktop.showOverlay();
    }
  };

  if (!settings) return <div className="p-8 text-center text-gray-500">Loading Configuration...</div>;

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] text-slate-200">
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white">O</div>
          <h1 className="font-bold text-lg tracking-tight">OverlayChat <span className="text-indigo-400 font-normal">Broadcaster</span></h1>
        </div>
        <div className="flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${matchState.isLive ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`}></div>
           <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{matchState.isLive ? 'Live' : 'Standby'}</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Match Control Card */}
        <section className="bg-slate-800/40 rounded-2xl border border-slate-700/50 p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Match Session</h2>
            <span className="font-mono text-[10px] bg-slate-900 px-2 py-0.5 rounded text-indigo-300">{matchState.matchId}</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
               <label className="text-xs text-slate-500">Home Team</label>
               <input 
                placeholder="Team A"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm focus:ring-2 ring-indigo-500/20 outline-none"
               />
            </div>
            <div className="space-y-1">
               <label className="text-xs text-slate-500">Away Team</label>
               <input 
                placeholder="Team B"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm focus:ring-2 ring-indigo-500/20 outline-none"
               />
            </div>
          </div>

          <button className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-600/10">
            Push Match Update
          </button>
        </section>

        {/* Global Controls Grid */}
        <section className="grid grid-cols-2 gap-4">
           <button 
             onClick={toggleOverlay}
             className={`p-4 rounded-2xl border transition-all text-left space-y-2 ${settings.overlayVisible ? 'bg-indigo-600/10 border-indigo-500/50' : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-700/50'}`}
           >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${settings.overlayVisible ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                📺
              </div>
              <div>
                 <p className="font-bold text-sm">Main Overlay</p>
                 <p className="text-[10px] text-slate-500 uppercase">{settings.overlayVisible ? 'On Stream' : 'Hidden'}</p>
              </div>
           </button>

           <button 
              // @ts-ignore
              onClick={() => window.overlayDesktop.toggleDebugWindow()}
              className="p-4 rounded-2xl border bg-slate-800/40 border-slate-700/50 hover:bg-slate-700/50 transition-all text-left space-y-2"
            >
              <div className="w-10 h-10 rounded-full bg-slate-700 text-slate-400 flex items-center justify-center">
                🛠️
              </div>
              <div>
                 <p className="font-bold text-sm">Debug Console</p>
                 <p className="text-[10px] text-slate-500 uppercase">View System Logs</p>
              </div>
           </button>

           <button 
              className="p-4 rounded-2xl border bg-slate-800/40 border-slate-700/50 hover:bg-slate-700/50 transition-all text-left space-y-2"
            >
              <div className="w-10 h-10 rounded-full bg-slate-700 text-slate-400 flex items-center justify-center">
                💬
              </div>
              <div>
                 <p className="font-bold text-sm">Moderation</p>
                 <p className="text-[10px] text-slate-500 uppercase">Manage Chat</p>
              </div>
           </button>

           <button 
              className="p-4 rounded-2xl border bg-slate-800/40 border-slate-700/50 hover:bg-slate-700/50 transition-all text-left space-y-2"
            >
              <div className="w-10 h-10 rounded-full bg-slate-700 text-slate-400 flex items-center justify-center">
                ⚙️
              </div>
              <div>
                 <p className="font-bold text-sm">System Settings</p>
                 <p className="text-[10px] text-slate-500 uppercase">Opacity & Scale</p>
              </div>
           </button>
        </section>

        {/* Footer info */}
        <footer className="pt-4 border-t border-slate-800/50 flex justify-between text-[10px] font-medium text-slate-500 uppercase tracking-widest">
           <span>v{settings.appVersion}</span>
           <span>Mode: {settings.appMode}</span>
        </footer>
      </main>
    </div>
  );
};

export default ControlPanel;
