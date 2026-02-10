import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Plus, Upload, X, BarChart2, LogOut } from 'lucide-react';
import html2canvas from 'html2canvas';
import { supabase } from './lib/supabase';

const FIELD_WIDTH = 15;
const FIELD_HEIGHT = 12.5;

const ZONES = [
  { id: 1, label: '1', left: 0, top: 0, width: 26.67, height: 16 },
  { id: 2, label: '2', left: 26.67, top: 0, width: 46.66, height: 16 },
  { id: 3, label: '3', left: 73.33, top: 0, width: 26.67, height: 16 },
  { id: 4, label: '4', left: 0, top: 16, width: 20, height: 32 },
  { id: 5, label: '5', left: 20, top: 16, width: 20, height: 32 },
  { id: 6, label: '6', left: 40, top: 16, width: 20, height: 32 },
  { id: 7, label: '7', left: 60, top: 16, width: 20, height: 32 },
  { id: 8, label: '8', left: 80, top: 16, width: 20, height: 32 },
  { id: 9, label: '9', left: 0, top: 48, width: 20, height: 52 },
  { id: 10, label: '10', left: 20, top: 48, width: 20, height: 52 },
  { id: 11, label: '11', left: 40, top: 48, width: 20, height: 52 },
  { id: 12, label: '12', left: 60, top: 48, width: 20, height: 52 },
  { id: 13, label: '13', left: 80, top: 48, width: 20, height: 27 },
  { id: 14, label: '14', left: 80, top: 75, width: 20, height: 25 }
];

const RESULT_COLORS = {
  raak: 'bg-green-500',
  redding: 'bg-orange-400',
  mis: 'bg-red-500'
};

const ATTACK_TYPES = ['6vs6', '6vs5', '6vs4', 'strafworp'];
const PERIODS = ['1', '2', '3', '4', 'OT'];

const HEAT_TYPES = [
  { key: 'count', label: 'Count', metric: 'count', color: 'redToGreen' },
  { key: 'success', label: '% Goal', metric: 'success', color: 'redToGreen' },
  { key: 'save', label: '% Saved', metric: 'save', color: 'greenToRed' },
  { key: 'miss', label: '% Miss', metric: 'miss', color: 'greenToRed' },
  { key: 'distance', label: '📏 Distance', metric: 'distance', color: 'none' }
];

const DEFAULT_MATCH = () => ({
  info: {
    id: `match_${Date.now()}`,
    name: 'New match',
    date: new Date().toISOString().slice(0, 10)
  },
  shots: []
});

const notifyDataUpdated = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('waterpolo-data-updated'));
};

const loadTeamData = async (teamId) => {
  if (!teamId) return { roster: [], matches: [] };
  const [{ data: roster, error: rosterError }, { data: matches, error: matchError }, { data: shots, error: shotError }] =
    await Promise.all([
      supabase.from('roster').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
      supabase.from('matches').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
      supabase.from('shots').select('*').eq('team_id', teamId)
    ]);
  if (rosterError || matchError || shotError) {
    throw new Error('Failed to load team data');
  }
  const matchMap = new Map();
  (matches || []).forEach((match) => {
    matchMap.set(match.id, { info: { id: match.id, name: match.name, date: match.date }, shots: [] });
  });
  (shots || []).forEach((shot) => {
    const target = matchMap.get(shot.match_id);
    if (!target) return;
    target.shots.push({
      id: shot.id,
      x: shot.x,
      y: shot.y,
      zone: shot.zone,
      result: shot.result,
      playerCap: shot.player_cap,
      attackType: shot.attack_type,
      time: shot.time,
      period: shot.period
    });
  });
  return { roster: roster || [], matches: Array.from(matchMap.values()) };
};

const detectZone = (x, y) => {
  if (x >= 80 && y >= 75) return 14;
  for (const zone of ZONES) {
    if (zone.id === 14) continue;
    if (x >= zone.left && x <= zone.left + zone.width && y >= zone.top && y <= zone.top + zone.height) {
      return zone.id;
    }
  }
  return null;
};

const formatShotTime = () => '7:00';

const normalizeTime = (value) => {
  if (!value) return '7:00';
  const parts = value.split(':');
  const minutes = Math.min(7, Math.max(0, Number(parts[0] || 0)));
  const seconds = Math.min(59, Math.max(0, Number(parts[1] || 0)));
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const splitTimeParts = (value) => {
  const normalized = normalizeTime(value);
  const [min, sec] = normalized.split(':');
  return { minutes: Number(min), seconds: Number(sec) };
};

const timeToSeconds = (value) => {
  const normalized = normalizeTime(value);
  const [min, sec] = normalized.split(':').map(Number);
  return min * 60 + sec;
};

const distanceMeters = (shot) => {
  const x = (shot.x / 100) * FIELD_WIDTH;
  const y = (shot.y / 100) * FIELD_HEIGHT;
  return Math.sqrt((x - 7.5) ** 2 + y ** 2);
};

const penaltyPosition = (index) => {
  const colCount = 3;
  const col = index % colCount;
  const row = Math.floor(index / colCount);
  const zone = ZONES.find((z) => z.id === 14);
  const cellWidth = zone.width / colCount;
  const cellHeight = zone.height / 4;
  return {
    x: zone.left + cellWidth * col + cellWidth / 2,
    y: zone.top + cellHeight * row + cellHeight / 2
  };
};

const valueToColor = (value, max, scheme) => {
  if (value == null || max === 0) return 'rgba(255,255,255,0)';
  const ratio = Math.min(value / max, 1);
  const clamp = (val) => Math.max(0, Math.min(255, Math.round(val)));
  let r = 0;
  let g = 0;
  if (scheme === 'redToGreen') {
    r = clamp(255 - ratio * 155);
    g = clamp(80 + ratio * 175);
  } else {
    r = clamp(80 + ratio * 175);
    g = clamp(255 - ratio * 155);
  }
  return `rgba(${r}, ${g}, 90, 0.45)`;
};

const App = () => {
  const [activeTab, setActiveTab] = useState('shotmap');
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [seasons, setSeasons] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [seasonForm, setSeasonForm] = useState('');
  const [teamForm, setTeamForm] = useState('');
  const [loadingSeasons, setLoadingSeasons] = useState(true);

  useEffect(() => {
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
  }, []);

  const loadSeasons = async (userId) => {
    const [{ data: seasonsData, error: seasonsError }, { data: teamsData, error: teamsError }] =
      await Promise.all([
        supabase.from('seasons').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        supabase.from('teams').select('*').eq('user_id', userId).order('created_at', { ascending: true })
      ]);
    if (seasonsError || teamsError) throw new Error('Failed to load seasons');
    const seasonsWithTeams = (seasonsData || []).map((season) => ({
      id: season.id,
      name: season.name,
      teams: (teamsData || []).filter((team) => team.season_id === season.id)
    }));
    return seasonsWithTeams;
  };

  useEffect(() => {
    if (!session?.user) return;
    let active = true;
    const load = async () => {
      try {
        const data = await loadSeasons(session.user.id);
        if (!active) return;
        setSeasons(data);
        setLoadingSeasons(false);
      } catch (e) {
        if (active) setLoadingSeasons(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [session]);

  const selectedSeason = seasons.find((season) => season.id === selectedSeasonId);
  const selectedTeam = selectedSeason?.teams?.find((team) => team.id === selectedTeamId);

  const handleMagicLink = async () => {
    if (!authEmail) return;
    setAuthMessage('Sending magic link...');
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail,
      options: { emailRedirectTo: redirectTo }
    });
    if (error) {
      setAuthMessage('Failed to send link.');
      return;
    }
    setAuthMessage('Check your inbox for the magic link.');
  };

  const createSeason = async () => {
    if (!seasonForm.trim() || !session?.user) return;
    const { data, error } = await supabase
      .from('seasons')
      .insert({ name: seasonForm.trim(), user_id: session.user.id })
      .select('*')
      .single();
    if (error) return;
    const nextSeasons = [...seasons, { id: data.id, name: data.name, teams: [] }];
    setSeasons(nextSeasons);
    setSeasonForm('');
    setSelectedSeasonId(data.id);
    setSelectedTeamId('');
  };

  const createTeam = async () => {
    if (!teamForm.trim() || !selectedSeason || !session?.user) return;
    const { data, error } = await supabase
      .from('teams')
      .insert({ name: teamForm.trim(), season_id: selectedSeason.id, user_id: session.user.id })
      .select('*')
      .single();
    if (error) return;
    const nextSeasons = seasons.map((season) =>
      season.id === selectedSeason.id
        ? { ...season, teams: [...(season.teams || []), data] }
        : season
    );
    setSeasons(nextSeasons);
    setTeamForm('');
    setSelectedTeamId(data.id);
  };

  const renameSeason = async (seasonId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase.from('seasons').update({ name: trimmed }).eq('id', seasonId);
    if (error) return;
    const nextSeasons = seasons.map((season) =>
      season.id === seasonId ? { ...season, name: trimmed } : season
    );
    setSeasons(nextSeasons);
  };

  const deleteSeason = async (seasonId) => {
    if (!window.confirm('Delete season? All teams and data will be removed.')) return;
    const { error } = await supabase.from('seasons').delete().eq('id', seasonId);
    if (error) return;
    const nextSeasons = seasons.filter((season) => season.id !== seasonId);
    setSeasons(nextSeasons);
    if (selectedSeasonId === seasonId) {
      setSelectedSeasonId('');
      setSelectedTeamId('');
    }
  };

  const renameTeam = async (seasonId, teamId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase.from('teams').update({ name: trimmed }).eq('id', teamId);
    if (error) return;
    const nextSeasons = seasons.map((season) => {
      if (season.id !== seasonId) return season;
      const teams = (season.teams || []).map((team) =>
        team.id === teamId ? { ...team, name: trimmed } : team
      );
      return { ...season, teams };
    });
    setSeasons(nextSeasons);
  };

  const deleteTeam = async (seasonId, teamId) => {
    if (!window.confirm('Delete team? All data for this team will be removed.')) return;
    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    if (error) return;
    const nextSeasons = seasons.map((season) => {
      if (season.id !== seasonId) return season;
      return { ...season, teams: (season.teams || []).filter((team) => team.id !== teamId) };
    });
    setSeasons(nextSeasons);
    if (selectedTeamId === teamId) {
      setSelectedTeamId('');
    }
  };

  if (authLoading) {
    return <div className="p-10 text-slate-700">Loading...</div>;
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen px-6 py-8">
        <div className="mx-auto max-w-lg space-y-6">
          <header className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-cyan-700">Water Polo Platform</p>
            <h1 className="text-3xl font-semibold">Sign in</h1>
            <p className="mt-2 text-sm text-slate-500">We will send you a magic link.</p>
          </header>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <label className="text-xs font-semibold text-slate-500">Email</label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="you@example.com"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
            />
            <button
              className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={handleMagicLink}
            >
              Send magic link
            </button>
            {authMessage && <div className="mt-3 text-sm text-slate-500">{authMessage}</div>}
          </div>
        </div>
      </div>
    );
  }

  if (loadingSeasons) {
    return <div className="p-10 text-slate-700">Loading...</div>;
  }

  if (!selectedSeason || !selectedTeam) {
    return (
      <div className="min-h-screen px-6 py-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <header className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-cyan-700">Water Polo Platform</p>
            <h1 className="text-3xl font-semibold">Seasons & Teams</h1>
            <p className="mt-2 text-sm text-slate-500">
              Select a season and team, or create new folders.
            </p>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700">Seasons</h2>
              <div className="mt-3 space-y-2">
                {seasons.length === 0 && (
                  <div className="text-sm text-slate-500">No seasons yet.</div>
                )}
                {seasons.map((season) => (
                  <div
                    key={season.id}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                      selectedSeasonId === season.id
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                        : 'border-slate-100 text-slate-600'
                    }`}
                  >
                    <button
                      className="flex-1 text-left"
                      onClick={() => {
                        setSelectedSeasonId(season.id);
                        setSelectedTeamId('');
                      }}
                    >
                      <span className="font-medium">{season.name}</span>
                    </button>
                    <span className="mr-3 text-xs text-slate-400">
                      {season.teams?.length || 0} teams
                    </span>
                    <button
                      className="text-xs font-semibold text-slate-500"
                      onClick={() => {
                        const next = window.prompt('New season name', season.name);
                        if (next != null) renameSeason(season.id, next);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      className="ml-2 text-xs font-semibold text-red-500"
                      onClick={() => deleteSeason(season.id)}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="New season"
                  value={seasonForm}
                  onChange={(event) => setSeasonForm(event.target.value)}
                />
                <button
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                  onClick={createSeason}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700">Teams</h2>
              {selectedSeason ? (
                <div className="mt-3 space-y-2">
                  {(selectedSeason.teams || []).length === 0 && (
                    <div className="text-sm text-slate-500">No teams in this season.</div>
                  )}
                  {(selectedSeason.teams || []).map((team) => (
                    <div
                      key={team.id}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                        selectedTeamId === team.id
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                          : 'border-slate-100 text-slate-600'
                      }`}
                    >
                      <button className="flex-1 text-left" onClick={() => setSelectedTeamId(team.id)}>
                        <span className="font-medium">{team.name}</span>
                      </button>
                      <button
                        className="text-xs font-semibold text-slate-500"
                        onClick={() => {
                          const next = window.prompt('New team name', team.name);
                          if (next != null) renameTeam(selectedSeason.id, team.id, next);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        className="ml-2 text-xs font-semibold text-red-500"
                        onClick={() => deleteTeam(selectedSeason.id, team.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">Select a season first.</div>
              )}
              <div className="mt-4 flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder={selectedSeason ? 'New team' : 'Select season first'}
                  value={teamForm}
                  onChange={(event) => setTeamForm(event.target.value)}
                  disabled={!selectedSeason}
                />
                <button
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={createTeam}
                  disabled={!selectedSeason}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-cyan-700">Water Polo Platform</p>
            <h1 className="text-3xl font-semibold">Shotmap & Analytics</h1>
            <p className="text-xs text-slate-500">
              {selectedSeason.name} · {selectedTeam.name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm"
              value={selectedSeasonId}
              onChange={(event) => {
                const nextSeasonId = event.target.value;
                const nextSeason = seasons.find((season) => season.id === nextSeasonId);
                setSelectedSeasonId(nextSeasonId);
                setSelectedTeamId(nextSeason?.teams?.[0]?.id || '');
              }}
            >
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm"
              value={selectedTeamId}
              onChange={(event) => setSelectedTeamId(event.target.value)}
              disabled={(selectedSeason.teams || []).length === 0}
            >
              {(selectedSeason.teams || []).map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <button
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                activeTab === 'shotmap' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => setActiveTab('shotmap')}
            >
              Shotmap
            </button>
            <button
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                activeTab === 'analytics' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => setActiveTab('analytics')}
            >
              <BarChart2 size={16} />
              Analytics
            </button>
            <button
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
              onClick={() => {
                setSelectedSeasonId('');
                setSelectedTeamId('');
              }}
            >
              Switch team
            </button>
            <button
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut size={14} />
            </button>
          </div>
        </header>

        {activeTab === 'shotmap' ? (
          <ShotmapView seasonId={selectedSeasonId} teamId={selectedTeamId} userId={session.user.id} />
        ) : (
          <AnalyticsView seasonId={selectedSeasonId} teamId={selectedTeamId} userId={session.user.id} />
        )}
      </div>
    </div>
  );
};

const ShotmapView = ({ seasonId, teamId, userId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roster, setRoster] = useState([]);
  const [matches, setMatches] = useState([]);
  const [currentMatchId, setCurrentMatchId] = useState('');
  const [pendingShot, setPendingShot] = useState(null);
  const [seasonMode, setSeasonMode] = useState(false);
  const [filters, setFilters] = useState({
    players: [],
    results: [],
    periods: [],
    attackTypes: [],
    matches: []
  });
  const [rosterForm, setRosterForm] = useState({ name: '', capNumber: '' });
  const fieldRef = useRef(null);

  useEffect(() => {
    if (!teamId) return;
    let active = true;
    const loadAll = async () => {
      try {
        setLoading(true);
        const payload = await loadTeamData(teamId);
        if (!active) return;
        const mappedRoster = payload.roster.map((player) => ({
          id: player.id,
          name: player.name,
          capNumber: player.cap_number
        }));
        setRoster(mappedRoster);
        setMatches(payload.matches);
        setCurrentMatchId(payload.matches[0]?.info?.id || '');
        setError('');
      } catch (e) {
        if (active) setError('Could not load data.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadAll();
    return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-cyan-700">Water Polo Shotmap</p>
          <h2 className="text-2xl font-semibold">Shot Tracking & Recording</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            onClick={downloadPNG}
          >
            <Download size={16} />
            Download PNG
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-full bg-cyan-600 px-4 py-2 text-sm font-semibold text-white"
            onClick={exportJSON}
          >
            <Download size={16} />
            Export JSON
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-cyan-200 bg-white px-4 py-2 text-sm font-semibold text-cyan-700">
            <Upload size={16} />
            Import
            <input type="file" accept="application/json" className="hidden" onChange={importJSON} />
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  seasonMode ? 'bg-slate-100 text-slate-600' : 'bg-slate-900 text-white'
                }`}
                onClick={() => setSeasonMode(false)}
              >
                Match mode
              </button>
              <button
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  seasonMode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
                onClick={() => setSeasonMode(true)}
              >
                Season mode
              </button>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
              onClick={addMatch}
            >
              <Plus size={16} />
              New match
            </button>
          </div>

          {!seasonMode && currentMatch && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-500">Match name</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={currentMatch.info.name}
                    onChange={(event) => updateMatchInfo('name', event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Date</label>
                  <input
                    type="date"
                    className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={currentMatch.info.date}
                    onChange={(event) => updateMatchInfo('date', event.target.value)}
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                {matches.map((match) => (
                  <button
                    key={match.info.id}
                    className={`rounded-full px-3 py-1 ${
                      match.info.id === currentMatch.info.id
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                    onClick={() => setCurrentMatchId(match.info.id)}
                  >
                    {match.info.name}
                  </button>
                ))}
                {matches.length > 1 && (
                  <button
                    className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-red-500"
                    onClick={() => deleteMatch(currentMatch.info.id)}
                  >
                    <X size={14} />
                    Delete match
                  </button>
                )}
              </div>
            </div>
          )}

          {seasonMode && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Season filters</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Matches</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {matches.map((match) => (
                      <button
                        key={match.info.id}
                        className={`rounded-full px-3 py-1 text-xs ${
                          filters.matches.includes(match.info.id)
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                        onClick={() =>
                          setFilters((prev) => ({
                            ...prev,
                            matches: prev.matches.includes(match.info.id)
                              ? prev.matches.filter((id) => id !== match.info.id)
                              : [...prev.matches, match.info.id]
                          }))
                        }
                      >
                        {match.info.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Players</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {roster.map((player) => (
                      <button
                        key={player.id}
                        className={`rounded-full px-3 py-1 text-xs ${
                          filters.players.includes(player.capNumber)
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                        onClick={() =>
                          setFilters((prev) => ({
                            ...prev,
                            players: prev.players.includes(player.capNumber)
                              ? prev.players.filter((cap) => cap !== player.capNumber)
                              : [...prev.players, player.capNumber]
                          }))
                        }
                      >
                        #{player.capNumber}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Outcome</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      { value: 'raak', label: 'Goal' },
                      { value: 'redding', label: 'Saved' },
                      { value: 'mis', label: 'Miss' }
                    ].map((result) => (
                      <button
                        key={result.value}
                        className={`rounded-full px-3 py-1 text-xs ${
                          filters.results.includes(result.value)
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                        onClick={() =>
                          setFilters((prev) => ({
                            ...prev,
                            results: prev.results.includes(result.value)
                              ? prev.results.filter((value) => value !== result.value)
                              : [...prev.results, result.value]
                          }))
                        }
                      >
                        {result.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Period</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PERIODS.map((period) => (
                      <button
                        key={period}
                        className={`rounded-full px-3 py-1 text-xs ${
                          filters.periods.includes(period)
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                        onClick={() =>
                          setFilters((prev) => ({
                            ...prev,
                            periods: prev.periods.includes(period)
                              ? prev.periods.filter((value) => value !== period)
                              : [...prev.periods, period]
                          }))
                        }
                      >
                        P{period}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Attack type</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ATTACK_TYPES.map((type) => (
                      <button
                        key={type}
                        className={`rounded-full px-3 py-1 text-xs ${
                          filters.attackTypes.includes(type)
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                        onClick={() =>
                          setFilters((prev) => ({
                            ...prev,
                            attackTypes: prev.attackTypes.includes(type)
                              ? prev.attackTypes.filter((value) => value !== type)
                              : [...prev.attackTypes, type]
                          }))
                        }
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Interactive field</h3>
              <div className="text-xs text-slate-500">Click to add a shot</div>
            </div>
            <div className="mt-4 flex justify-center">
              <div
                ref={fieldRef}
                className="relative h-[600px] w-full max-w-[720px] cursor-crosshair overflow-hidden rounded-2xl bg-gradient-to-b from-[#4aa3d6] via-[#2c7bb8] to-[#1f639a]"
                onClick={handleFieldClick}
              >
                <div className="absolute left-0 top-[48%] h-[2px] w-full bg-yellow-300" />
                <div className="absolute left-[40%] top-0 h-[6%] w-[20%] border-2 border-white bg-white/10" />

                {ZONES.map((zone) => (
                  <div
                    key={zone.id}
                    className={`absolute border border-white/40 ${zone.id === 14 ? 'bg-slate-900/40' : ''}`}
                    style={{
                      left: `${zone.left}%`,
                      top: `${zone.top}%`,
                      width: `${zone.width}%`,
                      height: `${zone.height}%`
                    }}
                  >
                    <div className="absolute left-2 top-2 text-xs font-semibold text-white/70">
                      {zone.label}
                    </div>
                    {zone.id === 14 && (
                      <div className="absolute inset-0 grid grid-cols-3 place-items-center gap-1 p-2">
                        <button
                          className="col-span-3 rounded-lg bg-yellow-400 px-2 py-1 text-xs font-semibold text-slate-900"
                          onClick={(event) => {
                            event.stopPropagation();
                            handlePenaltyClick();
                          }}
                        >
                          + Penalty
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {filteredShots.map((shot) => {
                  const isPenalty = shot.attackType === 'strafworp';
                  const position = isPenalty
                    ? penaltyPosition(penaltyShots.findIndex((item) => item.id === shot.id))
                    : { x: shot.x, y: shot.y };
                  return (
                    <div
                      key={shot.id}
                      className={`absolute flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-lg ${
                        RESULT_COLORS[shot.result]
                      } ${isPenalty ? 'rounded-md' : ''}`}
                      style={{
                        left: `calc(${position.x}% - 14px)`,
                        top: `calc(${position.y}% - 14px)`
                      }}
                      title={`${shot.playerCap} - ${shot.result}`}
                    >
                      {isPenalty ? `P${shot.playerCap}` : shot.playerCap}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Add shot</h3>
            {pendingShot ? (
              <div className="mt-3 space-y-3 text-sm">
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Zone {pendingShot.zone} · {pendingShot.attackType}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Player</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={pendingShot.playerCap}
                    onChange={(event) =>
                      setPendingShot((prev) => ({ ...prev, playerCap: event.target.value }))
                    }
                  >
                    <option value="">Select player</option>
                    {roster.map((player) => (
                      <option key={player.id} value={player.capNumber}>
                        #{player.capNumber} {player.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Result</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      value={pendingShot.result}
                      onChange={(event) =>
                        setPendingShot((prev) => ({ ...prev, result: event.target.value }))
                      }
                    >
                      <option value="raak">Goal</option>
                      <option value="redding">Saved</option>
                      <option value="mis">Miss</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Attack</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      value={pendingShot.attackType}
                      onChange={(event) =>
                        setPendingShot((prev) => ({ ...prev, attackType: event.target.value }))
                      }
                      disabled={pendingShot.zone === 14}
                    >
                      {ATTACK_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Period</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      value={pendingShot.period}
                      onChange={(event) =>
                        setPendingShot((prev) => ({ ...prev, period: event.target.value }))
                      }
                    >
                      {PERIODS.map((period) => (
                        <option key={period} value={period}>
                          P{period}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Time</label>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="7"
                          className="w-20 rounded-lg border border-slate-200 px-3 py-2"
                          value={splitTimeParts(pendingShot.time).minutes}
                          onChange={(event) => {
                            const minutes = Math.min(7, Math.max(0, Number(event.target.value)));
                            const seconds = splitTimeParts(pendingShot.time).seconds;
                            setPendingShot((prev) => ({
                              ...prev,
                              time: `${minutes}:${String(seconds).padStart(2, '0')}`
                            }));
                          }}
                        />
                        <span className="text-sm font-semibold text-slate-500">min</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="59"
                          className="w-20 rounded-lg border border-slate-200 px-3 py-2"
                          value={splitTimeParts(pendingShot.time).seconds}
                          onChange={(event) => {
                            const minutes = splitTimeParts(pendingShot.time).minutes;
                            const seconds = Math.min(59, Math.max(0, Number(event.target.value)));
                            setPendingShot((prev) => ({
                              ...prev,
                              time: `${minutes}:${String(seconds).padStart(2, '0')}`
                            }));
                          }}
                        />
                        <span className="text-sm font-semibold text-slate-500">sec</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        {['7:00', '6:00', '5:00'].map((preset) => (
                          <button
                            key={preset}
                            className="rounded-full border border-slate-200 px-2 py-1"
                            onClick={() => setPendingShot((prev) => ({ ...prev, time: preset }))}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    onClick={addShot}
                  >
                    Save
                  </button>
                  <button
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                    onClick={() => setPendingShot(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-slate-500">Click on the field to add a shot.</div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Roster</h3>
            <div className="mt-3 grid grid-cols-[1fr_110px] gap-2">
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Name"
                value={rosterForm.name}
                onChange={(event) => setRosterForm((prev) => ({ ...prev, name: event.target.value }))}
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Cap #"
                value={rosterForm.capNumber}
                onChange={(event) =>
                  setRosterForm((prev) => ({ ...prev, capNumber: event.target.value }))
                }
              />
            </div>
            <button
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white"
              onClick={handleRosterAdd}
            >
              <Plus size={16} />
              Add player
            </button>
            <div className="mt-3 space-y-2">
              {roster.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
                >
                  <span>
                    #{player.capNumber} {player.name}
                  </span>
                  <button
                    className="text-xs font-semibold text-red-500"
                    onClick={() => removeRosterPlayer(player.id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Shots</h3>
            <div className="mt-3 max-h-[280px] space-y-2 overflow-y-auto text-sm">
              {displayShots.length === 0 && (
                <div className="text-slate-500">No shots recorded.</div>
              )}
              {displayShots.map((shot) => (
                <div
                  key={shot.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                >
                  <div>
                    <div className="font-semibold text-slate-700">
                      Zone {shot.zone} · #{shot.playerCap}
                    </div>
                    <div className="text-xs text-slate-500">
                      {shot.result} · {shot.attackType} · P{shot.period} · {shot.time}
                    </div>
                  </div>
                  <button
                    className="text-xs font-semibold text-red-500"
                    onClick={() => deleteShot(shot.id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AnalyticsView = ({ seasonId, teamId, userId }) => {
  const [data, setData] = useState({ roster: [], matches: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [heatType, setHeatType] = useState('count');
  const [showShots, setShowShots] = useState(true);
  const [filters, setFilters] = useState({
    matches: [],
    players: [],
    results: [],
    periods: [],
    attackTypes: []
  });
  const fieldRef = useRef(null);

  useEffect(() => {
    if (!teamId) return;
    let active = true;
    const load = async () => {
      try {
        const payload = await loadTeamData(teamId);
        if (active) {
          const mappedRoster = payload.roster.map((player) => ({
            id: player.id,
            name: player.name,
            capNumber: player.cap_number
          }));
          setData({ roster: mappedRoster, matches: payload.matches });
          setError('');
        }
      } catch (e) {
        if (active) setError('Could not load analytics data.');
      } finally {
        if (active) setLoading(false);
      }
    };
    const handleUpdate = () => load();
    load();
    window.addEventListener('waterpolo-data-updated', handleUpdate);
    return () => {
      active = false;
      window.removeEventListener('waterpolo-data-updated', handleUpdate);
    };
  }, [teamId]);

  const matches = data.matches || [];
  const roster = data.roster || [];

  const filteredShots = useMemo(() => {
    const selectedMatches = filters.matches.length
      ? matches.filter((match) => filters.matches.includes(match.info.id))
      : matches;
    const allShots = selectedMatches.flatMap((match) => match.shots || []);
    return allShots.filter((shot) => {
      if (filters.players.length && !filters.players.includes(shot.playerCap)) return false;
      if (filters.results.length && !filters.results.includes(shot.result)) return false;
      if (filters.periods.length && !filters.periods.includes(shot.period)) return false;
      if (filters.attackTypes.length && !filters.attackTypes.includes(shot.attackType)) return false;
      return true;
    });
  }, [matches, filters]);

  const analyticsShots = useMemo(() => {
    if (heatType === 'distance') {
      return filteredShots.filter((shot) => shot.attackType !== 'strafworp');
    }
    return filteredShots;
  }, [filteredShots, heatType]);

  const zoneStats = useMemo(() => {
    const stats = {};
    for (const zone of ZONES) {
      stats[zone.id] = { total: 0, success: 0, save: 0, miss: 0, distanceSum: 0, distanceCount: 0 };
    }
    analyticsShots.forEach((shot) => {
      const zone = shot.zone;
      if (!stats[zone]) return;
      stats[zone].total += 1;
      if (shot.result === 'raak') stats[zone].success += 1;
      if (shot.result === 'redding') stats[zone].save += 1;
      if (shot.result === 'mis') stats[zone].miss += 1;
      if (heatType === 'distance') {
        stats[zone].distanceSum += distanceMeters(shot);
        stats[zone].distanceCount += 1;
      }
    });
    return stats;
  }, [analyticsShots, heatType]);

  const zoneValues = useMemo(() => {
    const values = {};
    ZONES.forEach((zone) => {
      if (zone.id === 14) return;
      const stat = zoneStats[zone.id];
      if (!stat) return;
      if (heatType === 'count') values[zone.id] = stat.total;
      if (heatType === 'success') values[zone.id] = stat.total ? (stat.success / stat.total) * 100 : null;
      if (heatType === 'save') values[zone.id] = stat.total ? (stat.save / stat.total) * 100 : null;
      if (heatType === 'miss') values[zone.id] = stat.total ? (stat.miss / stat.total) * 100 : null;
      if (heatType === 'distance')
        values[zone.id] = stat.distanceCount ? stat.distanceSum / stat.distanceCount : null;
    });
    return values;
  }, [zoneStats, heatType]);

  const maxValue = useMemo(() => {
    if (heatType === 'distance') return 0;
    const vals = Object.values(zoneValues).filter((value) => value != null);
    return vals.length ? Math.max(...vals) : 0;
  }, [zoneValues, heatType]);

  const downloadPNG = async () => {
    if (!fieldRef.current) return;
    try {
      const canvas = await html2canvas(fieldRef.current, {
        backgroundColor: '#0b4a7a',
        scale: 2
      });
      const output = document.createElement('canvas');
      output.width = 1440;
      output.height = 1450;
      const ctx = output.getContext('2d');
      ctx.fillStyle = '#f8fbff';
      ctx.fillRect(0, 0, output.width, output.height);
      ctx.fillStyle = '#0b1c2c';
      ctx.font = '600 36px Space Grotesk, sans-serif';
      ctx.fillText(`Water Polo Analytics - ${HEAT_TYPES.find((t) => t.key === heatType)?.label}`, 40, 64);
      ctx.drawImage(canvas, 0, 100, 1440, 1200);
      const url = output.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `heatmap_${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
    } catch (e) {
      setError('PNG export failed.');
    }
  };

  const zone14Stats = zoneStats[14];
  const penaltyShots = analyticsShots.filter((shot) => shot.attackType === 'strafworp');

  const distanceByResult = useMemo(() => {
    if (heatType !== 'distance') return null;
    const buckets = {
      raak: { total: 0, count: 0 },
      redding: { total: 0, count: 0 },
      mis: { total: 0, count: 0 }
    };
    analyticsShots.forEach((shot) => {
      const bucket = buckets[shot.result];
      if (!bucket) return;
      bucket.total += distanceMeters(shot);
      bucket.count += 1;
    });
    const format = (bucket) => (bucket.count ? (bucket.total / bucket.count).toFixed(1) : '—');
    return {
      raak: format(buckets.raak),
      redding: format(buckets.redding),
      mis: format(buckets.mis)
    };
  }, [analyticsShots, heatType]);

  if (loading) {
    return <div className="p-10 text-slate-700">Laden...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-cyan-700">Waterpolo Analytics</p>
          <h2 className="text-2xl font-semibold">Heatmaps & Analyse</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            onClick={downloadPNG}
          >
            <Download size={16} />
            Download PNG
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {HEAT_TYPES.map((type) => (
                  <button
                    key={type.key}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      heatType === type.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                    onClick={() => setHeatType(type.key)}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
              {heatType !== 'distance' && (
                <button
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
                  onClick={() => setShowShots((prev) => !prev)}
                >
                  👁️ {showShots ? 'Verberg schoten' : 'Toon schoten'}
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Heatmap veld</h3>
            <div className="mt-4 flex justify-center">
              <div
                ref={fieldRef}
                className="relative h-[600px] w-full max-w-[720px] overflow-hidden rounded-2xl bg-gradient-to-b from-[#4aa3d6] via-[#2c7bb8] to-[#1f639a]"
              >
                <div className="absolute left-0 top-[48%] h-[2px] w-full bg-yellow-300" />
                <div className="absolute left-[40%] top-0 h-[6%] w-[20%] border-2 border-white bg-white/10" />

                {ZONES.map((zone) => {
                  const value = zoneValues[zone.id];
                  const colorScheme = HEAT_TYPES.find((t) => t.key === heatType)?.color;
                  const fillColor =
                    zone.id === 14 || heatType === 'distance' || colorScheme === 'none'
                      ? 'transparent'
                      : valueToColor(value, maxValue, colorScheme);
                  return (
                    <div
                      key={zone.id}
                      className={`absolute border border-white/40 ${zone.id === 14 ? 'bg-slate-900/40' : ''}`}
                      style={{
                        left: `${zone.left}%`,
                        top: `${zone.top}%`,
                        width: `${zone.width}%`,
                        height: `${zone.height}%`,
                        backgroundColor: fillColor
                      }}
                    >
                      <div className="absolute left-2 top-2 text-xs font-semibold text-white/70">
                        {zone.label}
                      </div>
                      {zone.id === 14 && (
                        <div className="absolute bottom-2 left-2 text-[10px] text-white/70">Strafworpen</div>
                      )}
                      {heatType === 'distance' && zone.id !== 14 && zoneValues[zone.id] != null && (
                        <div className="absolute bottom-2 right-2 rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-slate-700">
                          Ø {zoneValues[zone.id].toFixed(1)}m
                        </div>
                      )}
                      {heatType !== 'distance' && zone.id !== 14 && value != null && (
                        <div className="absolute bottom-2 right-2 rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-slate-700">
                          {heatType === 'count' ? value : `${value.toFixed(0)}%`}
                        </div>
                      )}
                    </div>
                  );
                })}

                {heatType !== 'distance' && showShots &&
                  analyticsShots.map((shot) => {
                    const isPenalty = shot.attackType === 'strafworp';
                    const position = isPenalty
                      ? penaltyPosition(penaltyShots.findIndex((item) => item.id === shot.id))
                      : { x: shot.x, y: shot.y };
                    return (
                    <div
                      key={shot.id}
                      className={`absolute flex h-4 w-4 items-center justify-center rounded-full border border-white/80 text-[9px] font-semibold text-white ${
                        shot.result === 'raak'
                          ? 'bg-green-500/80'
                          : shot.result === 'redding'
                          ? 'bg-orange-400/80'
                          : 'bg-red-500/80'
                      }`}
                      style={{
                        left: `calc(${position.x}% - 8px)`,
                        top: `calc(${position.y}% - 8px)`
                      }}
                    >
                      {shot.playerCap}
                    </div>
                    );
                  })}

                {heatType === 'distance' &&
                  analyticsShots.map((shot) => {
                    const isPenalty = shot.attackType === 'strafworp';
                    const position = isPenalty
                      ? penaltyPosition(penaltyShots.findIndex((item) => item.id === shot.id))
                      : { x: shot.x, y: shot.y };
                    return (
                    <div
                      key={shot.id}
                      className="absolute flex flex-col items-center text-[10px] font-semibold text-white"
                      style={{
                        left: `calc(${position.x}% - 12px)`,
                        top: `calc(${position.y}% - 20px)`
                      }}
                    >
                      <div className="rounded-full bg-blue-100/80 px-2 py-1 text-[10px] text-slate-700">
                        #{shot.playerCap}
                      </div>
                      <div className="mt-1 rounded-full bg-amber-100/90 px-2 py-1 text-[10px] text-amber-900">
                        {distanceMeters(shot).toFixed(1)}m
                      </div>
                    </div>
                    );
                  })}
              </div>
            </div>
            {heatType !== 'distance' && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <div className="font-semibold text-slate-700">Legenda</div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-red-500/60" />
                    Laag
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-amber-400/60" />
                    Midden
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-green-500/60" />
                    Hoog
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  Kleurverloop gebaseerd op hoogste waarde in zones 1-13.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Filters</h3>
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500">Wedstrijden</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {matches.map((match) => (
                    <button
                      key={match.info.id}
                      className={`rounded-full px-3 py-1 text-xs ${
                        filters.matches.includes(match.info.id)
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          matches: prev.matches.includes(match.info.id)
                            ? prev.matches.filter((id) => id !== match.info.id)
                            : [...prev.matches, match.info.id]
                        }))
                      }
                    >
                      {match.info.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Spelers</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {roster.map((player) => (
                    <button
                      key={player.id}
                      className={`rounded-full px-3 py-1 text-xs ${
                        filters.players.includes(player.capNumber)
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          players: prev.players.includes(player.capNumber)
                            ? prev.players.filter((cap) => cap !== player.capNumber)
                            : [...prev.players, player.capNumber]
                        }))
                      }
                    >
                      #{player.capNumber}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Uitkomst</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {['raak', 'redding', 'mis'].map((result) => (
                    <button
                      key={result}
                      className={`rounded-full px-3 py-1 text-xs ${
                        filters.results.includes(result)
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          results: prev.results.includes(result)
                            ? prev.results.filter((value) => value !== result)
                            : [...prev.results, result]
                        }))
                      }
                    >
                      {result}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Periode</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PERIODS.map((period) => (
                    <button
                      key={period}
                      className={`rounded-full px-3 py-1 text-xs ${
                        filters.periods.includes(period)
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          periods: prev.periods.includes(period)
                            ? prev.periods.filter((value) => value !== period)
                            : [...prev.periods, period]
                        }))
                      }
                    >
                      P{period}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Aanval type</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ATTACK_TYPES.map((type) => (
                    <button
                      key={type}
                      className={`rounded-full px-3 py-1 text-xs ${
                        filters.attackTypes.includes(type)
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          attackTypes: prev.attackTypes.includes(type)
                            ? prev.attackTypes.filter((value) => value !== type)
                            : [...prev.attackTypes, type]
                        }))
                      }
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Zone 14 statistieken</h3>
            <div className="mt-3 text-sm text-slate-600">
              {zone14Stats?.total ? (
                <div className="space-y-1">
                  <div>Totaal: {zone14Stats.total}</div>
                  <div>Raak: {zone14Stats.success}</div>
                  <div>Redding: {zone14Stats.save}</div>
                  <div>Mis: {zone14Stats.miss}</div>
                </div>
              ) : (
                <div>Geen strafworpen in selectie.</div>
              )}
            </div>
          </div>

          {heatType === 'distance' && distanceByResult && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Gemiddelde afstand</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <span>Raak</span>
                  <span className="font-semibold text-emerald-700">{distanceByResult.raak}m</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <span>Redding</span>
                  <span className="font-semibold text-amber-700">{distanceByResult.redding}m</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <span>Mis</span>
                  <span className="font-semibold text-red-700">{distanceByResult.mis}m</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
