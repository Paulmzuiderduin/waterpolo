import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const getParam = (searchParams, hashParams, key) => searchParams.get(key) || hashParams.get(key) || '';

const applyAuthCallbackFromUrl = async (url) => {
  if (!url) return;
  const parsedUrl = new URL(url);
  const hashParams = new URLSearchParams(parsedUrl.hash.startsWith('#') ? parsedUrl.hash.slice(1) : parsedUrl.hash);
  const searchParams = parsedUrl.searchParams;
  const accessToken = getParam(searchParams, hashParams, 'access_token');
  const refreshToken = getParam(searchParams, hashParams, 'refresh_token');
  const authCode = getParam(searchParams, hashParams, 'code');
  const token = getParam(searchParams, hashParams, 'token');
  const tokenHash = getParam(searchParams, hashParams, 'token_hash') || token;
  const verifyType = getParam(searchParams, hashParams, 'type');
  const email = getParam(searchParams, hashParams, 'email');
  const authError = getParam(searchParams, hashParams, 'error');
  const authErrorDescription = getParam(searchParams, hashParams, 'error_description');

  if (authError || authErrorDescription) {
    console.error('Supabase auth callback error.', {
      authError,
      authErrorDescription
    });
    return;
  }

  if (accessToken && refreshToken) {
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    return;
  }

  if (authCode) {
    await supabase.auth.exchangeCodeForSession(authCode);
    return;
  }

  if (token && email && verifyType) {
    await supabase.auth.verifyOtp({
      email,
      token,
      type: verifyType
    });
    return;
  }

  if (tokenHash && verifyType) {
    await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: verifyType
    });
    return;
  }
};


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
    let lastProcessedUrl = '';
    const processCallbackUrl = async (url) => {
      if (!url || url === lastProcessedUrl) return;
      lastProcessedUrl = url;
      try {
        await applyAuthCallbackFromUrl(url);
      } catch (error) {
        console.error('Failed to process auth callback URL.', error);
      }
    };
    const init = async () => {
      await processCallbackUrl(window.location.href);

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
