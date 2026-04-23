import { useState, useEffect } from 'react';
import { verifyUserPasskey } from '../firebase/services';
import type { AuthResult } from '../types';

export function useAuth() {
  const [username, setUsername] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [clientId] = useState<string>(() => {
    const existing = localStorage.getItem('ovr_client_id');
    if (existing) return existing;
    const next = 'c-' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('ovr_client_id', next);
    return next;
  });

  // Load auth state from localStorage and check for login URL parameter
  useEffect(() => {
    const checkLoginParam = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const loginParam = urlParams.get('login');
      
      if (loginParam) {
        const [username, passkey] = loginParam.split(':');
        if (username && passkey) {
          try {
            const result: AuthResult = await verifyUserPasskey(username, passkey);
            if (result.valid) {
              localStorage.setItem('ovr_username', username);
              localStorage.setItem('ovr_is_authed', 'true');
              localStorage.setItem('ovr_client_id', result.clientId || clientId);
              setUsername(username);
              setIsAuthed(true);
              window.history.replaceState({}, '', window.location.pathname);
              return;
            }
          } catch (error) {
            console.error('[useAuth] Auto-login error:', error);
          }
        }
      }
      
      const storedUsername = localStorage.getItem('ovr_username');
      const storedIsAuthed = localStorage.getItem('ovr_is_authed');
      if (storedUsername && storedIsAuthed === 'true') {
        setUsername(storedUsername);
        setIsAuthed(true);
      }
    };
    
    checkLoginParam();
  }, [clientId]);

  const handleAuthSuccess = (authUsername: string, authClientId: string) => {
    setUsername(authUsername);
    setIsAuthed(true);
    localStorage.setItem('ovr_username', authUsername);
    localStorage.setItem('ovr_is_authed', 'true');
    localStorage.setItem('ovr_client_id', authClientId);
  };

  return {
    username,
    isAuthed,
    clientId,
    handleAuthSuccess,
  };
}
