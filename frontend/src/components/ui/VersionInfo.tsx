import React, { useState } from 'react';
import { VERSION_INFO, getVersionString } from '../../version';

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
        className="version-header cursor-pointer text-xs font-medium text-gray-400 hover:text-indigo-400 transition-all duration-200 hover:scale-105"
        onClick={toggleExpanded}
        title="Click to toggle version details"
      >
        <span className="font-mono tracking-wide bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
          {getVersionString()}
        </span>
        {showDetails && (
          <span className="ml-2 text-gray-500 transition-transform duration-200 inline-block">
            {expanded ? '▼' : '▶'}
          </span>
        )}
      </div>
      
      {showDetails && expanded && (
        <div className="version-details mt-3 p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl text-xs border border-gray-200 shadow-lg backdrop-blur-sm">
          <div className="space-y-2 font-sans">
            <div className="flex items-center justify-between py-1 border-b border-gray-200">
              <span className="font-semibold text-gray-700">Version</span>
              <span className="font-mono text-indigo-600">{VERSION_INFO.version}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="font-semibold text-gray-700">Build Date</span>
              <span className="text-gray-600">{VERSION_INFO.buildDate} {VERSION_INFO.buildTime}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="font-semibold text-gray-700">Git Commit</span>
              <span className="font-mono text-green-600">{VERSION_INFO.gitCommit}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="font-semibold text-gray-700">Git Branch</span>
              <span className="text-blue-600">{VERSION_INFO.gitBranch}</span>
            </div>
            {VERSION_INFO.gitTag !== 'unknown' && (
              <div className="flex items-center justify-between py-1">
                <span className="font-semibold text-gray-700">Git Tag</span>
                <span className="text-purple-600">{VERSION_INFO.gitTag}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-1">
              <span className="font-semibold text-gray-700">Environment</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                (VERSION_INFO.environment as string) === 'production' 
                  ? 'bg-green-100 text-green-700' 
                  : (VERSION_INFO.environment as string) === 'development'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {VERSION_INFO.environment}
              </span>
            </div>
            {VERSION_INFO.buildNumber !== 'local' && (
              <div className="flex items-center justify-between py-1">
                <span className="font-semibold text-gray-700">Build Number</span>
                <span className="text-gray-600">{VERSION_INFO.buildNumber}</span>
              </div>
            )}
            {VERSION_INFO.builder !== 'local-dev' && (
              <div className="flex items-center justify-between py-1">
                <span className="font-semibold text-gray-700">Builder</span>
                <span className="text-gray-600">{VERSION_INFO.builder}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-1 border-t border-gray-200">
              <span className="font-semibold text-gray-700">Timestamp</span>
              <span className="text-gray-500 font-mono text-xs">{VERSION_INFO.timestamp}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Beautiful version badge component
export const VersionBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`version-badge ${className}`}>
      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 border border-indigo-400">
        <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
        v{VERSION_INFO.version.split('-')[0]}
      </span>
    </div>
  );
};

// Beautiful footer version component
export const FooterVersion: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`footer-version ${className} flex justify-center`}>
      <div className="text-center py-2 px-3 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 shadow-2xl border-t border-gray-700">
        <div className="flex items-center justify-center space-x-3 text-xs">
          <span className="text-gray-400 font-light">
            Built with 
            <span className="text-red-400 mx-1 inline-block animate-pulse">❤️</span> 
            by Predicto
          </span>
          <span className="text-gray-600">•</span>
          <span className="font-mono text-indigo-400 tracking-wide hover:text-indigo-300 transition-colors duration-200">
            {getVersionString()}
          </span>
          <span className="text-gray-600">•</span>
          <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium transition-all duration-200 hover:scale-105 ${
            (VERSION_INFO.environment as string) === 'production' 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30' 
              : (VERSION_INFO.environment as string) === 'development'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30'
              : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
          }`}>
            {VERSION_INFO.environment}
          </span>
          {(VERSION_INFO.gitBranch as string) !== 'unknown' && (
            <>
              <span className="text-gray-600">•</span>
              <span className="text-gray-500 font-mono hover:text-gray-400 transition-colors duration-200">
                🌿 {VERSION_INFO.gitBranch}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
