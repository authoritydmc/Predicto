const TickerWindow = () => {
  return (
    <div className="h-full bg-indigo-900/90 text-white flex items-center px-6 overflow-hidden border-t-2 border-indigo-500">
      <div className="flex-shrink-0 bg-white text-indigo-900 px-3 py-1 rounded-md font-extrabold text-sm mr-6">
        LATEST
      </div>
      <div className="flex gap-12 animate-marquee whitespace-nowrap">
         <span className="font-semibold">Welcome to OverlayChat Live!</span>
         <span className="text-indigo-300">Submit your predictions now to win points.</span>
         <span className="font-bold">Next Match: Coming Soon</span>
      </div>
    </div>
  );
};
export default TickerWindow;
