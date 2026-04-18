const OverlayWindow = () => {
  return (
    <div className="bg-transparent text-white p-4">
      <div className="bg-black/80 rounded-3xl p-6 backdrop-blur-md border border-white/10">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">Live Predictions</h2>
        <div className="mt-4">
           <p className="text-center italic text-gray-500">Waiting for data...</p>
        </div>
      </div>
    </div>
  );
};
export default OverlayWindow;
