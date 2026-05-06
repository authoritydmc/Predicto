#!/usr/bin/env node

import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

// Generate version info
const getVersionInfo = () => {
  const now = new Date();
  const timestamp = now.toISOString();
  const buildDate = now.toLocaleDateString();
  const buildTime = now.toLocaleTimeString();
  
  // Try to get git info
  let gitCommit = 'unknown';
  let gitBranch = 'unknown';
  let gitTag = 'unknown';
  
  try {
    gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch (e) {
    // Not in git repo or git not available
  }
  
  try {
    gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch (e) {
    // Not in git repo or git not available
  }
  
  try {
    gitTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
  } catch (e) {
    // No tags found
  }
  
  // Generate version number based on timestamp and git commit
  const versionNumber = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}-${gitCommit}`;
  
  return {
    version: versionNumber,
    buildDate,
    buildTime,
    timestamp,
    gitCommit,
    gitBranch,
    gitTag,
    environment: process.env.NODE_ENV || 'development',
    // Add build metadata
    buildNumber: process.env.BUILD_NUMBER || 'local',
    builder: process.env.BUILDER || 'local-dev'
  };
};

const versionInfo = getVersionInfo();

// Write version.json to public directory
writeFileSync(
  'public/version.json',
  JSON.stringify(versionInfo, null, 2),
  'utf8'
);

// Write version.ts to src for TypeScript access
const versionTsContent = `// Auto-generated version file - DO NOT EDIT
export const VERSION_INFO = ${JSON.stringify(versionInfo, null, 2)} as const;

export const VERSION = VERSION_INFO.version;
export const BUILD_DATE = VERSION_INFO.buildDate;
export const BUILD_TIME = VERSION_INFO.buildTime;
export const GIT_COMMIT = VERSION_INFO.gitCommit;
export const GIT_BRANCH = VERSION_INFO.gitBranch;
export const GIT_TAG = VERSION_INFO.gitTag;
export const ENVIRONMENT = VERSION_INFO.environment;

// Helper function to get formatted version string
export const getVersionString = () => {
  return \`v\${VERSION} (\${GIT_BRANCH}@\${GIT_COMMIT})\`;
};

// Helper function to get build info
export const getBuildInfo = () => {
  return \`Built on \${BUILD_DATE} at \${BUILD_TIME} in \${ENVIRONMENT}\`;
};
`;

writeFileSync(
  'src/version.ts',
  versionTsContent,
  'utf8'
);

console.log('✅ Version info generated successfully!');
console.log(`📦 Version: ${versionInfo.version}`);
console.log(`🌿 Git: ${versionInfo.gitBranch}@${versionInfo.gitCommit}`);
console.log(`📅 Built: ${versionInfo.buildDate} ${versionInfo.buildTime}`);
console.log(`🔧 Environment: ${versionInfo.environment}`);
