import { createContext, useContext } from 'react';

export interface AppContextType {
  username: string | null;
  isAuthed: boolean;
  passkey: string | null;
  favoriteTeam: string | null;
  teamChangeCount: number;
  clientId: string;
  firebaseMode: 'local' | 'prod';
  handleAuthSuccess: (username: string, clientId: string) => void;
  handleRotatePasskey: () => Promise<void>;
  handleSelectFavoriteTeam: (team: string) => Promise<void>;
  handleToggleFirebaseMode: () => void;
}

export const AppContext = createContext<AppContextType | null>(null);

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppLayout');
  return context;
}
