// User Types
export interface User {
  username: string;
  passkey: string;
  favoriteTeam: string | null;
  teamChangeCount: number;
}

export interface UserProfile {
  username?: string;
  passkey?: string;
  favoriteTeam?: string;
  teamChangeCount?: number;
  updatedAt?: number;
  createdAt?: number;
}

// Username Data (username/{username}) - contains all user data including clientId
export interface UsernameData {
  clientId: string;
  passkey: string;
  favoriteTeam: string | null;
  teamChangeCount: number;
  failedLoginAttempts: number;
  role: 'user' | 'admin' | 'moderator';
  enabled: boolean;
  bannedTournaments: string[];
  createdAt: number;
  updatedAt: number;
}

// User Reference (users/{clientId})
export interface UserReference {
  username: string;
}

// Match Types
export interface MatchContext {
  sport: string;
  id: string;
  matchId: string;
}

export interface MatchMeta {
  matchTitle?: string;
  teamA?: string;
  teamB?: string;
  status?: 'live' | 'scheduled' | 'done';
}

export interface MatchDiscovery {
  sport: string;
  tournamentId: string;
}

// Chat Types
export interface ChatMessage {
  id: string;
  name: string;
  message: string;
  clientId: string;
  timestamp: {
    seconds: number;
    nanoseconds?: number;
  } | number;
}

// Tournament Types
export interface TournamentMatch {
  id: string;
  matchTitle?: string;
  teamA?: string;
  teamB?: string;
  venue?: string;
  date?: string;
  status?: 'live' | 'scheduled' | 'done';
  countdown?: string;
}

// Firebase Mode
export type FirebaseMode = 'local' | 'prod';

// App Context Types
export interface AppContextType {
  username: string | null;
  isAuthed: boolean;
  passkey: string | null;
  favoriteTeam: string | null;
  teamChangeCount: number;
  clientId: string;
  firebaseMode: FirebaseMode;
  handleAuthSuccess: (username: string, clientId: string) => void;
  handleRotatePasskey: () => Promise<void>;
  handleSelectFavoriteTeam: (team: string) => Promise<void>;
  handleToggleFirebaseMode: () => void;
}

// Auth Types
export interface AuthResult {
  valid: boolean;
  clientId?: string;
}

// Team Types
export interface TeamColors {
  primary: string;
  secondary: string;
}
