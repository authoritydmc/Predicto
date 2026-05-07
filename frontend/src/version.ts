// Auto-generated version file - DO NOT EDIT
export const VERSION_INFO = {
  "version": "2026.05.08-1cab995",
  "buildDate": "8/5/2026",
  "buildTime": "12:41:32 am",
  "timestamp": "2026-05-07T19:11:32.982Z",
  "gitCommit": "1cab995",
  "gitBranch": "python_boi",
  "gitTag": "unknown",
  "environment": "development",
  "buildNumber": "local",
  "builder": "local-dev"
} as const;

export const VERSION = VERSION_INFO.version;
export const BUILD_DATE = VERSION_INFO.buildDate;
export const BUILD_TIME = VERSION_INFO.buildTime;
export const GIT_COMMIT = VERSION_INFO.gitCommit;
export const GIT_BRANCH = VERSION_INFO.gitBranch;
export const GIT_TAG = VERSION_INFO.gitTag;
export const ENVIRONMENT = VERSION_INFO.environment;

// Helper function to get formatted version string
export const getVersionString = () => {
  return `v${VERSION} (${GIT_BRANCH}@${GIT_COMMIT})`;
};

// Helper function to get build info
export const getBuildInfo = () => {
  return `Built on ${BUILD_DATE} at ${BUILD_TIME} in ${ENVIRONMENT}`;
};
