// Auto-generated version file - DO NOT EDIT
export const VERSION_INFO = {
  "version": "2026.05.06-3a54e1c",
  "buildDate": "6/5/2026",
  "buildTime": "11:00:08 am",
  "timestamp": "2026-05-06T05:30:08.207Z",
  "gitCommit": "3a54e1c",
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
