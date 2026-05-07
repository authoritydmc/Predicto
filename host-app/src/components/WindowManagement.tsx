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

const Toggle = ({ checked, onChange, label, icon }: { checked: boolean; onChange: (v: boolean) => void; label: string; icon?: string }) => (
  <label className="cp-toggle" style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.2s' }}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    <span className="cp-toggle-track" />
    <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 500, flex: 1 }}>{icon && <span style={{ marginRight: 6 }}>{icon}</span>}{label}</span>
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: '4px', background: checked ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255,255,255,0.05)', color: checked ? '#34c759' : 'var(--text-muted)' }}>
      {checked ? 'ON' : 'OFF'}
    </span>
  </label>
);

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
      {/* Window Visibility */}
      <div className="cp-section-header">
        <span className="text-lg">👁️</span>
        <span>Window Visibility</span>
      </div>
      <div className="cp-toggle-row">
        <Toggle
          checked={windowVisibility.overlayVisible}
          onChange={v => {
            onVisibilityChange('overlayVisible', v);
            v ? onShowOverlay() : onHideOverlay();
          }}
          label="Overlay Window"
          icon="🖼️"
        />
  
        <Toggle
          checked={windowVisibility.tickerVisible}
          onChange={v => {
            onVisibilityChange('tickerVisible', v);
            v ? onShowTicker() : onHideTicker();
          }}
          label="Ticker Window"
          icon="📊"
        />
        <Toggle
          checked={windowVisibility.reactionVisible}
          onChange={v => {
            onVisibilityChange('reactionVisible', v);
            v ? onShowReaction() : onHideReaction();
          }}
          label="Reaction Window"
          icon="💬"
        />
      </div>

      <div className="cp-divider" />

      {/* Overlay Window Controls */}
      <div className="cp-section-header">
        <span className="text-lg">🖼️</span>
        <span>Overlay Window</span>
      </div>
      <div className="cp-control-row">
        <label className="form-label">Master Opacity</label>
        <div className="cp-slider-group">
          <input type="range" min="0.2" max="1" step="0.05" value={opacity}
            onChange={e => onOpacityChange(parseFloat(e.target.value))} 
            className="cp-slider"
          />
          <span className="cp-value-tag">{Math.round(opacity * 100)}%</span>
        </div>
      </div>
      <div className="cp-action-grid">
        <button className="cp-glass-btn cp-small" onClick={onShowOverlay}>Show</button>
        <button className="cp-glass-btn cp-small" onClick={onHideOverlay}>Hide</button>
        <button className="cp-glass-btn cp-small" onClick={onReloadOverlay}>Reload</button>
        <button className="cp-glass-btn cp-small" onClick={onResetBounds}>Reset</button>
      </div>
      
      <div className="cp-divider" />
      
      {/* Ticker Window Controls */}
      <div className="cp-section-header">
        <span className="text-lg">📊</span>
        <span>Ticker Window</span>
      </div>
      <div className="cp-action-grid">
        <button className="cp-glass-btn cp-small" onClick={onShowTicker}>Show</button>
        <button className="cp-glass-btn cp-small" onClick={onHideTicker}>Hide</button>
        <button className="cp-glass-btn cp-small" onClick={onReloadTicker}>Reload</button>
        <button className="cp-glass-btn cp-small" onClick={onResetTickerBounds}>Reset</button>
      </div>

      <div className="cp-divider" />

      {/* Reaction Window Controls */}
      <div className="cp-section-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>💬</span>
        <span>Reaction Window</span>
      </div>
      <div className="cp-control-row">
        <label className="form-label">Reaction Opacity</label>
        <div className="cp-slider-group">
          <input type="range" min="0" max="1" step="0.05" value={reactionOpacity}
            onChange={e => onReactionOpacityChange(parseFloat(e.target.value))} 
            className="cp-slider"
          />
          <span className="cp-value-tag">{Math.round(reactionOpacity * 100)}%</span>
        </div>
      </div>
      <div className="cp-action-grid">
        <button className="cp-glass-btn cp-small" onClick={onShowReaction}>Show</button>
        <button className="cp-glass-btn cp-small" onClick={onHideReaction}>Hide</button>
        <button className="cp-glass-btn cp-small" onClick={onReloadReaction}>Reload</button>
        <button className="cp-glass-btn cp-small" onClick={onResetReactionBounds}>Reset</button>
      </div>

      <div className="cp-divider" />

      {/* Display Options */}
      <div className="cp-section-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🎛️</span>
        <span>Display Options</span>
      </div>
      <div className="cp-control-row">
        <button className="cp-secondary-btn cp-wide-btn" onClick={onTogglePredPause}>
          {predPaused ? '▶️ Resume Predictions' : '⏸️ Pause Predictions'}
        </button>
        <button className="cp-secondary-btn cp-wide-btn" onClick={onToggleSortMode}>
          📊 {sortMode === 'newest' ? 'Sort by Score' : 'Sort by Newest'}
        </button>
        <button className="cp-secondary-btn cp-wide-btn" onClick={onToggleHideChat}>
          💬 {chatHidden ? 'Show Live Chat' : 'Hide Live Chat'}
        </button>
        <button className="cp-secondary-btn cp-wide-btn" onClick={onToggleHideJoin}>
          👥 {joinHidden ? 'Show Join Section' : 'Hide Join Section'}
        </button>
      </div>

      <div className="cp-divider" />

      {/* Clear Data */}
      <div className="cp-section-header">
        <span className="text-lg">🗑️</span>
        <span>Clear Data</span>
      </div>
      <div className="cp-action-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <button className="cp-glass-btn cp-danger cp-small" onClick={() => onClear('predictions')} style={{ padding: '10px 12px', borderRadius: '8px' }}>🗑️ Predictions</button>
        <button className="cp-glass-btn cp-danger cp-small" onClick={() => onClear('chat')} style={{ padding: '10px 12px', borderRadius: '8px' }}>💬 Chat</button>
        <button className="cp-glass-btn cp-danger cp-small" onClick={() => onClear('reaction')} style={{ padding: '10px 12px', borderRadius: '8px' }}>😊 Reactions</button>
      </div>
    </div>
  );
};
