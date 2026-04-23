import { useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface PasscodeViewerProps {
  username: string;
  passkey: string;
  onClose: () => void;
  onResetPasskey: () => Promise<void>;
}

export default function PasscodeViewer({ username, passkey, onClose, onResetPasskey }: PasscodeViewerProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Generate shareable URL and QR code
  useEffect(() => {
    const generateQR = async () => {
      // Create shareable URL with username and passkey
      const shareUrl = `${window.location.origin}?login=${encodeURIComponent(username)}:${passkey}`;
      
      try {
        const qr = await QRCode.toDataURL(shareUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: '#ffffff',
            light: '#0a0a0f'
          }
        });
        setQrCodeUrl(qr);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };

    generateQR();
  }, [username, passkey]);

  const shareUrl = `${window.location.origin}?login=${encodeURIComponent(username)}:${passkey}`;

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const handleResetPasskey = async () => {
    if (confirm('Are you sure you want to generate a new passkey? Your old passkey will no longer work.')) {
      setResetting(true);
      try {
        await onResetPasskey();
        // QR code will regenerate automatically when passkey changes
      } catch (error) {
        console.error('Error resetting passkey:', error);
        alert('Failed to reset passkey. Please try again.');
      } finally {
        setResetting(false);
      }
    }
  };

  return (
    <div className="passcode-viewer-overlay" onClick={onClose}>
      <div className="passcode-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="passcode-viewer-header">
          <h2>Your Login Passcode</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="passcode-viewer-content">
          <div className="passcode-info">
            <p className="passcode-username">Username: <strong>{username}</strong></p>
            <p className="passcode-passkey">Passkey: <strong>{passkey}</strong></p>
          </div>

          <div className="qr-code-container">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="Login QR Code" className="qr-code" />
            ) : (
              <div className="qr-loading">Generating QR code...</div>
            )}
          </div>

          <div className="share-url-container">
            <label className="share-url-label">Shareable Link:</label>
            <div className="share-url-input-group">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="share-url-input"
              />
              <button onClick={copyShareUrl} className="copy-btn">
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
          </div>

          <button 
            onClick={handleResetPasskey} 
            className="reset-passkey-btn"
            disabled={resetting}
          >
            {resetting ? 'Generating...' : '🔄 Reset Passkey'}
          </button>

          <div className="passcode-instructions">
            <h3>How to use:</h3>
            <ul>
              <li>Scan the QR code with your phone camera</li>
              <li>Or copy the link and share it</li>
              <li>Opening the link will automatically log you in as <strong>{username}</strong></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
