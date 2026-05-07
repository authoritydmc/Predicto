import React, { useState, useEffect } from 'react';

interface SetupGuideViewerProps {
  guideType: 'discord' | 'push';
  onClose: () => void;
}

export const SetupGuideViewer: React.FC<SetupGuideViewerProps> = ({ guideType, onClose }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSetupGuide();
  }, [guideType]);

  const loadSetupGuide = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // @ts-ignore
      const response = await window.overlayDesktop.getSetupGuideContent(guideType);
      
      if (response.success) {
        setContent(response.content);
      } else {
        setError(response.error || 'Failed to load setup guide');
      }
    } catch (err) {
      setError('Error loading setup guide');
      console.error('Error loading setup guide:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderMarkdown = (markdown: string) => {
    // Simple markdown to HTML conversion
    return markdown
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
      .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*)\*/g, '<em>$1</em>')
      .replace(/`(.*)`/g, '<code>$1</code>')
      .replace(/```(.*)```/gs, '<pre><code>$1</code></pre>')
      .replace(/^• (.*$)/gim, '<li>$1</li>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/^\n/gim, '<br>')
      .replace(/(<br>){2,}/g, '<br><br>')
      .replace(/<li>/g, '<ul><li>')
      .replace(/<\/li>/g, '</li></ul>');
  };

  const getGuideTitle = () => {
    return guideType === 'discord' ? 'Discord Notifications Setup Guide' : 'Push Notifications Setup Guide';
  };

  const getGuideIcon = () => {
    return guideType === 'discord' ? '💬' : '📱';
  };

  if (loading) {
    return (
      <div className="setup-guide-viewer-overlay">
        <div className="setup-guide-viewer">
          <div className="setup-guide-header">
            <h2>{getGuideIcon()} {getGuideTitle()}</h2>
            <button className="close-btn" onClick={onClose}>&times;</button>
          </div>
          <div className="setup-guide-content">
            <div className="loading">Loading setup guide...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="setup-guide-viewer-overlay">
        <div className="setup-guide-viewer">
          <div className="setup-guide-header">
            <h2>{getGuideIcon()} {getGuideTitle()}</h2>
            <button className="close-btn" onClick={onClose}>&times;</button>
          </div>
          <div className="setup-guide-content">
            <div className="error">
              <h3>Error Loading Setup Guide</h3>
              <p>{error}</p>
              <button className="retry-btn" onClick={loadSetupGuide}>Retry</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-guide-viewer-overlay">
      <div className="setup-guide-viewer">
        <div className="setup-guide-header">
          <h2>{getGuideIcon()} {getGuideTitle()}</h2>
          <div className="header-actions">
            <button 
              className="export-btn"
              onClick={() => {
                const blob = new Blob([content], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${guideType}-setup-guide.md`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              📄 Export
            </button>
            <button className="close-btn" onClick={onClose}>&times;</button>
          </div>
        </div>
        
        <div className="setup-guide-content">
          <div 
            className="markdown-content"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        </div>
      </div>
    </div>
  );
};

// Add CSS styles
const style = document.createElement('style');
style.textContent = `
.setup-guide-viewer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.setup-guide-viewer {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 12px;
  width: 90%;
  height: 90%;
  max-width: 1200px;
  max-height: 800px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.setup-guide-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #333;
  background: #1f1f1f;
}

.setup-guide-header h2 {
  margin: 0;
  color: #fff;
  font-size: 18px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.export-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.export-btn:hover {
  background: #2563eb;
}

.close-btn {
  background: #ef4444;
  color: white;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.close-btn:hover {
  background: #dc2626;
}

.setup-guide-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: #1a1a1a;
}

.markdown-content {
  color: #e5e5e5;
  line-height: 1.6;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.markdown-content h1 {
  color: #fff;
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 20px 0;
  padding-bottom: 10px;
  border-bottom: 2px solid #3b82f6;
}

.markdown-content h2 {
  color: #fff;
  font-size: 22px;
  font-weight: 600;
  margin: 30px 0 15px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #333;
}

.markdown-content h3 {
  color: #3b82f6;
  font-size: 18px;
  font-weight: 600;
  margin: 25px 0 10px 0;
}

.markdown-content h4 {
  color: #10b981;
  font-size: 16px;
  font-weight: 600;
  margin: 20px 0 8px 0;
}

.markdown-content p {
  margin: 0 0 16px 0;
  color: #e5e5e5;
}

.markdown-content ul, .markdown-content ol {
  margin: 0 0 16px 0;
  padding-left: 24px;
}

.markdown-content li {
  margin: 4px 0;
  color: #e5e5e5;
}

.markdown-content code {
  background: #2d2d2d;
  color: #fbbf24;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
}

.markdown-content pre {
  background: #2d2d2d;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0 0 16px 0;
  border: 1px solid #444;
}

.markdown-content pre code {
  background: none;
  color: #e5e5e5;
  padding: 0;
}

.markdown-content strong {
  color: #fff;
  font-weight: 600;
}

.markdown-content em {
  color: #a3a3a3;
  font-style: italic;
}

.markdown-content a {
  color: #3b82f6;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}

.markdown-content a:hover {
  border-bottom-color: #3b82f6;
}

.loading, .error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #e5e5e5;
  text-align: center;
}

.error h3 {
  color: #ef4444;
  margin-bottom: 12px;
}

.retry-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 16px;
  transition: background 0.2s;
}

.retry-btn:hover {
  background: #2563eb;
}
`;
document.head.appendChild(style);
