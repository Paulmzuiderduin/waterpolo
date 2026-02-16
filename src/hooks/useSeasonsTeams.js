import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const useSeasonsTeams = (userId) => {
  const [seasons, setSeasons] = useState([]);
  const [loadingSeasons, setLoadingSeasons] = useState(true);

  useEffect(() => {
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
  }, [userId]);

  return { seasons, setSeasons, loadingSeasons };
};
