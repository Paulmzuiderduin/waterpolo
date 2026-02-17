import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const useAuthSession = () => {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const isSmokeMode = import.meta.env.VITE_E2E_SMOKE === '1';

  useEffect(() => {
    if (!isSmokeMode) return;
    setSession({
      user: {
        id: 'smoke-user',
        email: 'smoke@local.test'
      }
    });
    setAuthLoading(false);
  }, [isSmokeMode]);

  useEffect(() => {
    if (isSmokeMode) return;
    let active = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session || null);
      setAuthLoading(false);
    };
    init();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
    });
    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, [isSmokeMode]);

  return { session, authLoading };
};
