import React from 'react';

interface WindowVisibility {
  overlayVisible: boolean;
  tickerVisible: boolean;
  reactionVisible: boolean;
}

interface WindowManagementProps {
  windowVisibility: WindowVisibility;
  onVisibilityChange: (key: keyof WindowVisibility, value: boolean) => void;
  opacity: number;
  onOpacityChange: (v: number) => void;
  reactionOpacity: number;
  onReactionOpacityChange: (v: number) => void;
  onShowOverlay: () => void;
  onHideOverlay: () => void;
  onReloadOverlay: () => void;
  onResetBounds: () => void;
  onShowTicker: () => void;
  onHideTicker: () => void;
  onReloadTicker: () => void;
  onResetTickerBounds: () => void;
  onShowReaction: () => void;
  onHideReaction: () => void;
  onReloadReaction: () => void;
  onResetReactionBounds: () => void;
  onClear: (type: 'predictions' | 'chat' | 'reaction') => void;
  predPaused: boolean;
  onTogglePredPause: () => void;
  sortMode: 'newest' | 'score';
  onToggleSortMode: () => void;
  chatHidden: boolean;
  onToggleHideChat: () => void;
  joinHidden: boolean;
  onToggleHideJoin: () => void;
}

export const WindowManagement: React.FC<WindowManagementProps> = ({
  windowVisibility,
  onVisibilityChange,
  opacity,
  onOpacityChange,
  reactionOpacity,
  onReactionOpacityChange,
  onShowOverlay,
  onHideOverlay,
  onReloadOverlay,
  onResetBounds,
  onShowTicker,
  onHideTicker,
  onReloadTicker,
  onResetTickerBounds,
  onShowReaction,
  onHideReaction,
  onReloadReaction,
  onResetReactionBounds,
  onClear,
  predPaused,
  onTogglePredPause,
  sortMode,
  onToggleSortMode,
  chatHidden,
  onToggleHideChat,
  joinHidden,
  onToggleHideJoin
}) => {
  return (
    <div className="cp-glass-card cp-stack">
      <div className="cp-control-row">
        <label>Master Opacity</label>
        <div className="cp-slider-group">
          <input type="range" min="0.2" max="1" step="0.05" value={opacity}
            onChange={e => onOpacityChange(parseFloat(e.target.value))} />
          <span className="cp-value-tag">{Math.round(opacity * 100)}%</span>
        </div>
      </div>
      <div className="cp-action-grid">
        <button className="cp-glass-btn" onClick={onShowOverlay}>Show</button>
        <button className="cp-glass-btn" onClick={onHideOverlay}>Hide</button>
        <button className="cp-glass-btn" onClick={onReloadOverlay}>Reload</button>
        <button className="cp-glass-btn" onClick={onResetBounds}>Reset</button>
      </div>
      
      <div className="cp-divider" />
      
      <div className="cp-control-row">
        <label>Ticker Overlay</label>
        <div className="cp-action-grid">
          <button className="cp-glass-btn" onClick={onShowTicker}>Show Ticker</button>
          <button className="cp-glass-btn" onClick={onHideTicker}>Hide Ticker</button>
          <button className="cp-glass-btn" onClick={onReloadTicker}>Reload</button>
          <button className="cp-glass-btn" onClick={onResetTickerBounds}>Reset</button>
        </div>
      </div>

      <div className="cp-divider" />

      <div className="cp-control-row">
        <label>Reaction Window</label>
        <div className="cp-slider-group">
          <input type="range" min="0" max="1" step="0.05" value={reactionOpacity}
            onChange={e => onReactionOpacityChange(parseFloat(e.target.value))} />
          <span className="cp-value-tag">{Math.round(reactionOpacity * 100)}%</span>
        </div>
        <div className="cp-action-grid" style={{ marginTop: 8 }}>
          <button className="cp-glass-btn" onClick={onShowReaction}>Show</button>
          <button className="cp-glass-btn" onClick={onHideReaction}>Hide</button>
          <button className="cp-glass-btn" onClick={onReloadReaction}>Reload</button>
          <button className="cp-glass-btn" onClick={onResetReactionBounds}>Reset</button>
        </div>
      </div>

      <div className="cp-divider" />

      <div className="cp-control-row" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="cp-secondary-btn cp-wide-btn" onClick={onTogglePredPause}>
          {predPaused ? 'Resume Predictions' : 'Pause Predictions'}
        </button>
        <button className="cp-secondary-btn cp-wide-btn" onClick={onToggleSortMode}>
          {sortMode === 'newest' ? 'Sort by Score' : 'Sort by Newest'}
        </button>
        <button className="cp-secondary-btn cp-wide-btn" onClick={onToggleHideChat}>
          {chatHidden ? 'Show Live Chat' : 'Hide Live Chat'}
        </button>
        <button className="cp-secondary-btn cp-wide-btn" onClick={onToggleHideJoin}>
          {joinHidden ? 'Show Join Section' : 'Hide Join Section'}
        </button>
      </div>

      <div className="cp-divider" />

      <div className="cp-action-grid" style={{ marginTop: 12 }}>
        <button className="cp-glass-btn cp-danger" onClick={() => onClear('predictions')}>Clear Predictions</button>
        <button className="cp-glass-btn cp-danger" onClick={() => onClear('chat')}>Clear Chat</button>
        <button className="cp-glass-btn cp-danger" onClick={() => onClear('reaction')}>Clear Reactions</button>
      </div>
    </div>
  );
};
