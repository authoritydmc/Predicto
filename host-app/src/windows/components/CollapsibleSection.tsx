import React from 'react';

interface CollapsibleSectionProps {
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
  badge?: string | React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  isCollapsed,
  onToggle,
  children,
  className = '',
  badge,
}) => {
  return (
    <section className={`cp-panel-group ${className}`}>
      <div
        className="cp-group-header"
        onClick={onToggle}
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 className="cp-group-title" style={{ margin: 0 }}>{title}</h2>
          {badge && (
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              background: 'rgba(99, 102, 241, 0.2)',
              borderRadius: '10px',
              color: '#818cf8',
            }}>
              {badge}
            </span>
          )}
        </div>
        <span style={{ fontSize: '18px', color: 'var(--muted)', transition: 'transform 0.2s' }}>
          {isCollapsed ? '▶' : '▼'}
        </span>
      </div>
      <div className="cp-glass-card" style={{ display: isCollapsed ? 'none' : 'block' }}>
        {children}
      </div>
    </section>
  );
};
