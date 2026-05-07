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
      <div className="cp-section-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>👁️</span>
        <span>Window Visibility</span>
      </div>
      <div className="cp-toggle-row" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
      <div className="cp-section-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🖼️</span>
        <span>Overlay Window</span>
      </div>
      <div className="cp-control-row" style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Master Opacity</label>
        <div className="cp-slider-group" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input type="range" min="0.2" max="1" step="0.05" value={opacity}
            onChange={e => onOpacityChange(parseFloat(e.target.value))} 
            style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, appearance: 'none' }}
          />
          <span className="cp-value-tag" style={{ 
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)', 
            color: '#fff', 
            padding: '4px 10px', 
            borderRadius: '6px', 
            fontWeight: 700,
            fontSize: 12,
            minWidth: 50,
            textAlign: 'center'
          }}>{Math.round(opacity * 100)}%</span>
        </div>
      </div>
      <div className="cp-action-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
        <button className="cp-glass-btn cp-small" onClick={onShowOverlay} style={{ padding: '8px 12px', borderRadius: '8px' }}>Show</button>
        <button className="cp-glass-btn cp-small" onClick={onHideOverlay} style={{ padding: '8px 12px', borderRadius: '8px' }}>Hide</button>
        <button className="cp-glass-btn cp-small" onClick={onReloadOverlay} style={{ padding: '8px 12px', borderRadius: '8px' }}>Reload</button>
        <button className="cp-glass-btn cp-small" onClick={onResetBounds} style={{ padding: '8px 12px', borderRadius: '8px' }}>Reset</button>
      </div>
      
      <div className="cp-divider" />
      
      {/* Ticker Window Controls */}
      <div className="cp-section-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>📊</span>
        <span>Ticker Window</span>
      </div>
      <div className="cp-action-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <button className="cp-glass-btn cp-small" onClick={onShowTicker} style={{ padding: '8px 12px', borderRadius: '8px' }}>Show</button>
        <button className="cp-glass-btn cp-small" onClick={onHideTicker} style={{ padding: '8px 12px', borderRadius: '8px' }}>Hide</button>
        <button className="cp-glass-btn cp-small" onClick={onReloadTicker} style={{ padding: '8px 12px', borderRadius: '8px' }}>Reload</button>
        <button className="cp-glass-btn cp-small" onClick={onResetTickerBounds} style={{ padding: '8px 12px', borderRadius: '8px' }}>Reset</button>
      </div>

      <div className="cp-divider" />

      {/* Reaction Window Controls */}
      <div className="cp-section-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>💬</span>
        <span>Reaction Window</span>
      </div>
      <div className="cp-control-row" style={{ padding: '12px', background: 'rgba(168, 85, 247, 0.05)', borderRadius: '10px', border: '1px solid rgba(168, 85, 247, 0.1)' }}>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Reaction Opacity</label>
        <div className="cp-slider-group" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input type="range" min="0" max="1" step="0.05" value={reactionOpacity}
            onChange={e => onReactionOpacityChange(parseFloat(e.target.value))} 
            style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, appearance: 'none' }}
          />
          <span className="cp-value-tag" style={{ 
            background: 'linear-gradient(135deg, #a855f7, #6366f1)', 
            color: '#fff', 
            padding: '4px 10px', 
            borderRadius: '6px', 
            fontWeight: 700,
            fontSize: 12,
            minWidth: 50,
            textAlign: 'center'
          }}>{Math.round(reactionOpacity * 100)}%</span>
        </div>
      </div>
      <div className="cp-action-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
        <button className="cp-glass-btn cp-small" onClick={onShowReaction} style={{ padding: '8px 12px', borderRadius: '8px' }}>Show</button>
        <button className="cp-glass-btn cp-small" onClick={onHideReaction} style={{ padding: '8px 12px', borderRadius: '8px' }}>Hide</button>
        <button className="cp-glass-btn cp-small" onClick={onReloadReaction} style={{ padding: '8px 12px', borderRadius: '8px' }}>Reload</button>
        <button className="cp-glass-btn cp-small" onClick={onResetReactionBounds} style={{ padding: '8px 12px', borderRadius: '8px' }}>Reset</button>
      </div>

      <div className="cp-divider" />

      {/* Display Options */}
      <div className="cp-section-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🎛️</span>
        <span>Display Options</span>
      </div>
      <div className="cp-control-row" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="cp-secondary-btn cp-wide-btn" onClick={onTogglePredPause} style={{ 
          padding: '10px 16px', 
          borderRadius: '8px',
          background: predPaused ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 159, 10, 0.15)',
          border: predPaused ? '1px solid rgba(52, 199, 89, 0.3)' : '1px solid rgba(255, 159, 10, 0.3)',
          color: predPaused ? '#34c759' : '#ff9f0a',
          fontWeight: 600
        }}>
          {predPaused ? '▶️ Resume Predictions' : '⏸️ Pause Predictions'}
        </button>
        <button className="cp-secondary-btn cp-wide-btn" onClick={onToggleSortMode} style={{ 
          padding: '10px 16px', 
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          fontWeight: 600
        }}>
          📊 {sortMode === 'newest' ? 'Sort by Score' : 'Sort by Newest'}
        </button>
        <button className="cp-secondary-btn cp-wide-btn" onClick={onToggleHideChat} style={{ 
          padding: '10px 16px', 
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          fontWeight: 600
        }}>
          💬 {chatHidden ? 'Show Live Chat' : 'Hide Live Chat'}
        </button>
        <button className="cp-secondary-btn cp-wide-btn" onClick={onToggleHideJoin} style={{ 
          padding: '10px 16px', 
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          fontWeight: 600
        }}>
          👥 {joinHidden ? 'Show Join Section' : 'Hide Join Section'}
        </button>
      </div>

      <div className="cp-divider" />

      {/* Clear Data */}
      <div className="cp-section-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🗑️</span>
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
