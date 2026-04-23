// Firebase Configuration
export const MAX_TEAM_CHANGES = 3;
export const PASSKEY_LENGTH = 8;
export const CHAT_MESSAGE_LIMIT = 50;

// Local Storage Keys
export const STORAGE_KEYS = {
  CLIENT_ID: 'ovr_client_id',
  FIREBASE_MODE: 'firebase_mode',
} as const;

// Firebase Modes
export const FIREBASE_MODES = {
  LOCAL: 'local' as const,
  PROD: 'prod' as const,
} as const;

// Match Status
export const MATCH_STATUS = {
  LIVE: 'live' as const,
  SCHEDULED: 'scheduled' as const,
  DONE: 'done' as const,
} as const;

// Default Team Colors
export const DEFAULT_TEAM_COLORS = {
  primary: '#6366f1',
  secondary: '#8b5cf6',
} as const;
