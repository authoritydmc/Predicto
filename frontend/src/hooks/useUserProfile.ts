import { useEffect, useState } from 'react';
import { onValue } from 'firebase/database';
import { userRef } from '../firebase/services';
import type { UserProfile } from '../types';

export function useUserProfile(clientId: string) {
  const [profile, setProfile] = useState<UserProfile>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    
    const unsub = onValue(userRef(clientId), (snap) => {
      const data = snap.val();
      setProfile(data || {});
      setLoading(false);
    }, (error) => {
      console.error('[useUserProfile] Error fetching user profile:', error);
      setLoading(false);
    });

    return () => unsub();
  }, [clientId]);

  return { profile, loading };
}
