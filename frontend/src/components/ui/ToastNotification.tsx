import { useState, useEffect } from 'react';

interface ToastNotificationProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export default function ToastNotification({ message, type, duration = 3000 }: ToastNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration]);

  if (!isVisible) return null;

  const getToastStyles = () => {
    const baseStyles = {
      position: 'fixed' as const,
      top: '20px',
      right: '20px',
      zIndex: 9999,
      padding: '12px 16px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '600',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      transform: 'translateY(-100px)',
      transition: 'all 0.3s ease',
      maxWidth: '300px',
    };

    const colorStyles = {
      success: {
        background: '#34c759',
        color: 'white',
        borderLeft: '4px solid #34c759',
      },
      error: {
        background: '#ef4444',
        color: 'white',
        borderLeft: '4px solid #ef4444',
      },
      warning: {
        background: '#ff9f0a',
        color: 'white',
        borderLeft: '4px solid #ff9f0a',
      },
      info: {
        background: '#007aff',
        color: 'white',
        borderLeft: '4px solid #007aff',
      },
    };

    return {
      ...baseStyles,
      ...colorStyles[type],
    };
  };

  const styles = getToastStyles();

  return (
    <div style={styles}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: '16px' }}>
          {type === 'success' && '✅'}
          {type === 'error' && '❌'}
          {type === 'warning' && '⚠️'}
          {type === 'info' && 'ℹ️'}
        </span>
        <span style={{ fontWeight: '700' }}>{message}</span>
      </div>
    </div>
  );
}
