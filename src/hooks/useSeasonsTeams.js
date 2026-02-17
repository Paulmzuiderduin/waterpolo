import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const useSeasonsTeams = (userId) => {
  const [seasons, setSeasons] = useState([]);
  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const isSmokeMode = import.meta.env.VITE_E2E_SMOKE === '1';

  useEffect(() => {
    if (isSmokeMode) {
      setSeasons([
        {
          id: 'smoke-season-1',
          name: '2025-2026',
          teams: [
            { id: 'smoke-team-1', name: 'dwt H1', season_id: 'smoke-season-1' },
            { id: 'smoke-team-2', name: 'dwt U18', season_id: 'smoke-season-1' }
          ]
        }
      ]);
      setLoadingSeasons(false);
      return;
    }

    if (!userId) {
      setSeasons([]);
      setLoadingSeasons(false);
      return;
    }

    let active = true;
    const load = async () => {
      try {
        const [seasonsRes, teamsRes] = await Promise.all([
          supabase.from('seasons').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
          supabase.from('teams').select('*').eq('user_id', userId).order('created_at', { ascending: true })
        ]);
        if (seasonsRes.error || teamsRes.error) throw new Error('Failed to load seasons');
        if (!active) return;
        const seasonsWithTeams = (seasonsRes.data || []).map((season) => ({
          id: season.id,
          name: season.name,
          teams: (teamsRes.data || []).filter((team) => team.season_id === season.id)
        }));
        setSeasons(seasonsWithTeams);
      } catch (e) {
        if (!active) return;
      } finally {
        if (active) setLoadingSeasons(false);
      }
    };
    load();

    return () => {
      active = false;
    };
  }, [userId, isSmokeMode]);

  return { seasons, setSeasons, loadingSeasons };
};
