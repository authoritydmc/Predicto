const ReactionWindow = () => {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-transparent overflow-hidden pointer-events-none">
       {/* Reactions will be dynamically spawned here as absolute cards */}
       <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5 backdrop-blur-sm text-xs text-slate-500 uppercase tracking-widest italic">
          Reaction Layer Ready
       </div>
    </div>
  );
};
export default ReactionWindow;
