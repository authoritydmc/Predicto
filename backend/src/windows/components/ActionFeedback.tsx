import React from 'react';

interface ActionFeedbackProps {
  type: 'success' | 'error' | 'warning' | 'info' | null;
  message: string;
  details?: string;
  onClose?: () => void;
}

export const ActionFeedback: React.FC<ActionFeedbackProps> = ({
  type,
  message,
  details,
  onClose,
}) => {
  if (!type) return null;

  const colors = {
    success: { bg: 'var(--system-green)', icon: '✓', label: 'Success' },
    error: { bg: 'var(--system-red)', icon: '✗', label: 'Error' },
    warning: { bg: '#ff9f0a', icon: '⚠', label: 'Warning' },
    info: { bg: 'var(--system-blue)', icon: 'ℹ', label: 'Info' },
  };

  const { bg, icon, label } = colors[type];

  return (
    <div
      className={`action-feedback ${type}`}
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 9999,
        padding: '12px 16px',
        borderRadius: '8px',
        background: bg,
        color: 'white',
        fontSize: '14px',
        fontWeight: '600',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        maxWidth: '300px',
        animation: 'slideInRight 0.3s ease-out',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontWeight: '700', marginBottom: '4px' }}>
          {icon} {label}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '16px',
              cursor: 'pointer',
              padding: '0 4px',
              marginLeft: '8px',
            }}
          >
            ×
          </button>
        )}
      </div>
      <div>{message}</div>
      {details && (
        <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '4px' }}>
          {details}
        </div>
      )}
    </div>
  );
};
