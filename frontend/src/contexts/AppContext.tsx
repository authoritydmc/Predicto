import { createContext, useContext, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useUserProfile } from '../hooks/useUserProfile';
import { rotatePasskey, setFirebaseMode, saveUserGlobalProfile } from '../firebase/services';
import { MAX_TEAM_CHANGES } from '../config/constants';
import type { AppContextType, FirebaseMode } from '../types';

const AppContext = createContext<AppContextType | null>(null);

const getFirebaseModeFromUrl = (): FirebaseMode => {
  const origin = window.location.origin;
  const isLocal = origin.includes('localhost') ||
                  origin.includes('127.0.0.1') ||
                  origin.startsWith('http://192.');
  return isLocal ? 'local' : 'prod';
};

export function AppProvider({ children }: { children: ReactNode }) {
  const { username, isAuthed, clientId, handleAuthSuccess } = useAuth();
  const { profile } = useUserProfile(clientId);

  const [firebaseMode, setFirebaseModeState] = useState<FirebaseMode>(() => {
    return getFirebaseModeFromUrl();
  });

  const passkey = profile.passkey || null;
  const favoriteTeam = profile.favoriteTeam || null;
  const teamChangeCount = profile.teamChangeCount || 0;

  const handleRotatePasskey = async () => {
    if (!username || !clientId) return;
    try {
      await rotatePasskey(username, clientId);
      alert('New passkey generated! Save it for login on other devices.');
    } catch (error) {
      console.error('[AppContext] Error rotating passkey:', error);
      alert('Error generating new passkey. Please try again.');
    }
  };

  const handleToggleFirebaseMode = () => {
    const newMode = firebaseMode === 'local' ? 'prod' : 'local';
    setFirebaseMode(newMode);
    setFirebaseModeState(newMode);
    alert(`Switched to ${newMode.toUpperCase()} mode. Reloading...`);
    window.location.reload();
  };

  const handleSelectFavoriteTeam = async (team: string) => {
    if (teamChangeCount >= MAX_TEAM_CHANGES) {
      alert(`You have reached the maximum limit of ${MAX_TEAM_CHANGES} favorite team changes.`);
      return;
    }
    
    try {
      const newCount = favoriteTeam ? teamChangeCount + 1 : 0;
      await saveUserGlobalProfile(clientId, { 
        favoriteTeam: team,
        teamChangeCount: newCount
      });
    } catch (error) {
      console.error('[AppContext] Error saving favorite team:', error);
    }
  };

  const contextValue: AppContextType = {
    username,
    isAuthed,
    passkey,
    favoriteTeam,
    teamChangeCount,
    clientId,
    firebaseMode,
    handleAuthSuccess,
    handleRotatePasskey,
    handleSelectFavoriteTeam,
    handleToggleFirebaseMode,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
}
