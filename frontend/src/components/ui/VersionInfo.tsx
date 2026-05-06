import React, { useState } from 'react';
import { VERSION_INFO, getVersionString, getBuildInfo } from '../../version';

interface VersionInfoProps {
  showDetails?: boolean;
  className?: string;
}

export const VersionInfo: React.FC<VersionInfoProps> = ({ 
  showDetails = false, 
  className = '' 
}) => {
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  return (
    <div className={`version-info ${className}`}>
      <div 
        className="version-header cursor-pointer text-xs text-gray-500 hover:text-gray-700 transition-colors"
        onClick={toggleExpanded}
        title="Click to toggle version details"
      >
        <span className="font-mono">
          {getVersionString()}
        </span>
        {showDetails && (
          <span className="ml-2 text-gray-400">
            {expanded ? '▼' : '▶'}
          </span>
        )}
      </div>
      
      {showDetails && expanded && (
        <div className="version-details mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 border border-gray-200">
          <div className="space-y-1">
            <div><strong>Version:</strong> {VERSION_INFO.version}</div>
            <div><strong>Build Date:</strong> {VERSION_INFO.buildDate} {VERSION_INFO.buildTime}</div>
            <div><strong>Git Commit:</strong> {VERSION_INFO.gitCommit}</div>
            <div><strong>Git Branch:</strong> {VERSION_INFO.gitBranch}</div>
            {VERSION_INFO.gitTag !== 'unknown' && (
              <div><strong>Git Tag:</strong> {VERSION_INFO.gitTag}</div>
            )}
            <div><strong>Environment:</strong> {VERSION_INFO.environment}</div>
            {VERSION_INFO.buildNumber !== 'local' && (
              <div><strong>Build Number:</strong> {VERSION_INFO.buildNumber}</div>
            )}
            {VERSION_INFO.builder !== 'local-dev' && (
              <div><strong>Builder:</strong> {VERSION_INFO.builder}</div>
            )}
            <div><strong>Timestamp:</strong> {VERSION_INFO.timestamp}</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple version badge component
export const VersionBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`version-badge ${className}`}>
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-mono bg-gray-100 text-gray-600 border border-gray-200">
        v{VERSION_INFO.version.split('-')[0]}
      </span>
    </div>
  );
};

// Footer version component
export const FooterVersion: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`footer-version ${className}`}>
      <div className="text-center text-xs text-gray-400 py-2">
        <div className="mb-1">{getVersionString()}</div>
        <div className="text-gray-500">{getBuildInfo()}</div>
      </div>
    </div>
  );
};
