import React from 'react';

interface WindowVisibility {
  overlayVisible: boolean;
  tickerVisible: boolean;
  reactionVisible: boolean;
}

interface WindowManagementProps {
  windowVisibility: WindowVisibility;
  onVisibilityChange: (key: keyof WindowVisibility, value: boolean) => void;
}

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <label className="cp-toggle">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className="cp-toggle-track" />
  </label>
);

export const WindowManagement: React.FC<WindowManagementProps> = ({
  windowVisibility,
  onVisibilityChange,
}) => {
  const windows = [
    { key: 'overlayVisible' as const, label: 'Overlay Window' },
    { key: 'tickerVisible' as const, label: 'Ticker Window' },
    { key: 'reactionVisible' as const, label: 'Reaction Window' },
  ];

  return (
    <div className="cp-glass-card">
      {windows.map(({ key, label }) => (
        <div className="cp-form-row" key={key}>
          <label className="cp-toggle-row">
            <span>{label}</span>
            <Toggle
              checked={windowVisibility[key]}
              onChange={(v) => onVisibilityChange(key, v)}
            />
          </label>
        </div>
      ))}
      <p className="cp-panel-note">
        Toggle overlay windows on/off. Only one instance of each window type is allowed.
      </p>
    </div>
  );
};
