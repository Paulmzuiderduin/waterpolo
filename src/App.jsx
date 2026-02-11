import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Plus, X, BarChart2, LogOut, Users, IdCard, HelpCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
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
  const [rosterRes, matchRes, shotRes] = await Promise.all([
    supabase.from('roster').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
    supabase.from('matches').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
    supabase.from('shots').select('*').eq('team_id', teamId)
  ]);
  if (rosterRes.error || matchRes.error || shotRes.error) {
    throw new Error('Failed to load team data');
  }
  const matchMap = new Map();
  (matchRes.data || []).forEach((match) => {
    matchMap.set(match.id, { info: { id: match.id, name: match.name, date: match.date }, shots: [] });
  });
  (shotRes.data || []).forEach((shot) => {
    const target = matchMap.get(shot.match_id);
    if (!target) return;
    target.shots.push({
      id: shot.id,
      matchId: shot.match_id,
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
  return { roster: rosterRes.data || [], matches: Array.from(matchMap.values()) };
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

const computeAge = (birthday) => {
  if (!birthday) return null;
  const birth = new Date(birthday);
  if (Number.isNaN(birth.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
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
    const [seasonsRes, teamsRes] = await Promise.all([
      supabase.from('seasons').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      supabase.from('teams').select('*').eq('user_id', userId).order('created_at', { ascending: true })
    ]);
    if (seasonsRes.error || teamsRes.error) throw new Error('Failed to load seasons');
    const seasonsWithTeams = (seasonsRes.data || []).map((season) => ({
      id: season.id,
      name: season.name,
      teams: (teamsRes.data || []).filter((team) => team.season_id === season.id)
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
            <button
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              onClick={handleMagicLink}
            >
              Resend link
            </button>
            {authMessage && <div className="mt-3 text-sm text-slate-500">{authMessage}</div>}
            <div className="mt-2 text-xs text-slate-400">If you don’t see it, check spam.</div>
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

            <div className="space-y-4">
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

              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-700">Getting started</h2>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
                  <li>Create a season on the left.</li>
                  <li>Select the season and create a team.</li>
                  <li>Open Roster to add players.</li>
                  <li>Create a match in Shotmap to start tracking shots.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
        <footer className="mx-auto mt-8 max-w-5xl px-6 pb-8 text-xs text-slate-500">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/70 px-4 py-3 shadow-sm">
            <span>© {new Date().getFullYear()} Waterpolo Shotmap & Analytics</span>
            <button
              className="font-semibold text-slate-700 underline decoration-transparent transition hover:decoration-current"
              onClick={() => setActiveTab('privacy')}
            >
              Privacy
            </button>
          </div>
        </footer>
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
            <p className="text-xs text-slate-400">{session.user.email}</p>
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
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                activeTab === 'players' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => setActiveTab('players')}
            >
              <IdCard size={16} />
              Players
            </button>
            <button
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                activeTab === 'roster' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => setActiveTab('roster')}
            >
              <Users size={16} />
              Roster
            </button>
            <button
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                activeTab === 'help' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => setActiveTab('help')}
            >
              <HelpCircle size={16} />
              Help
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

        {activeTab === 'shotmap' && (
          <ShotmapView seasonId={selectedSeasonId} teamId={selectedTeamId} userId={session.user.id} />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsView seasonId={selectedSeasonId} teamId={selectedTeamId} userId={session.user.id} />
        )}
        {activeTab === 'players' && (
          <PlayersView
            seasonId={selectedSeasonId}
            teamId={selectedTeamId}
            userId={session.user.id}
            seasons={seasons}
            onSelectSeason={setSelectedSeasonId}
            onSelectTeam={setSelectedTeamId}
          />
        )}
        {activeTab === 'roster' && (
          <RosterView seasonId={selectedSeasonId} teamId={selectedTeamId} userId={session.user.id} />
        )}
        {activeTab === 'help' && <HelpView />}
        {activeTab === 'privacy' && <PrivacyView />}
      </div>
      <footer className="mx-auto mt-8 max-w-6xl px-6 pb-8 text-xs text-slate-500">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/70 px-4 py-3 shadow-sm">
          <span>© {new Date().getFullYear()} Waterpolo Shotmap & Analytics</span>
          <button
            className="font-semibold text-slate-700 underline decoration-transparent transition hover:decoration-current"
            onClick={() => setActiveTab('privacy')}
          >
            Privacy
          </button>
        </div>
      </footer>
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
  const [editingShotId, setEditingShotId] = useState(null);
  const [seasonMode, setSeasonMode] = useState(false);
  const [filters, setFilters] = useState({
    players: [],
    results: [],
    periods: [],
    attackTypes: [],
    matches: []
  });
  const [rosterForm, setRosterForm] = useState({ name: '', capNumber: '' });
  const [editingRosterId, setEditingRosterId] = useState(null);
  const [lastShotMeta, setLastShotMeta] = useState(() => ({
    period: '1',
    time: formatShotTime()
  }));
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
    return () => {
      active = false;
    };
  }, [teamId]);

  const currentMatch = useMemo(
    () => matches.find((match) => match.info.id === currentMatchId) || matches[0],
    [matches, currentMatchId]
  );

  useEffect(() => {
    if (!currentMatch) return;
    setCurrentMatchId(currentMatch.info.id);
  }, [currentMatch]);

  const refreshData = async () => {
    const payload = await loadTeamData(teamId);
    const mappedRoster = payload.roster.map((player) => ({
      id: player.id,
      name: player.name,
      capNumber: player.cap_number
    }));
    setRoster(mappedRoster);
    setMatches(payload.matches);
  };

  const handleFieldClick = (event) => {
    if (!fieldRef.current) return;
    if (!currentMatch) {
      setError('Create a match first.');
      return;
    }
    const rect = fieldRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    if (x >= 80 && y >= 75) return;
    const zone = detectZone(x, y);
    if (!zone) return;
    setPendingShot({
      x,
      y,
      zone,
      attackType: '6vs6',
      result: 'raak',
      playerCap: roster[0]?.capNumber || '',
      period: lastShotMeta?.period || '1',
      time: lastShotMeta?.time || formatShotTime()
    });
  };

  const handlePenaltyClick = () => {
    if (!currentMatch) {
      setError('Create a match first.');
      return;
    }
    setPendingShot({
      x: 90,
      y: 87.5,
      zone: 14,
      attackType: 'strafworp',
      result: 'raak',
      playerCap: roster[0]?.capNumber || '',
      period: lastShotMeta?.period || '1',
      time: lastShotMeta?.time || formatShotTime()
    });
  };

  const saveShot = async () => {
    if (!pendingShot || !currentMatch) return;
    if (!pendingShot.playerCap) {
      setError('Select a player.');
      return;
    }
    const payload = {
      team_id: teamId,
      season_id: seasonId,
      match_id: currentMatch.info.id,
      user_id: userId,
      x: pendingShot.x,
      y: pendingShot.y,
      zone: pendingShot.zone,
      result: pendingShot.result,
      player_cap: pendingShot.playerCap,
      attack_type: pendingShot.attackType,
      time: normalizeTime(pendingShot.time),
      period: pendingShot.period
    };
    let data;
    if (editingShotId) {
      const { data: updated, error: updateError } = await supabase
        .from('shots')
        .update(payload)
        .eq('id', editingShotId)
        .select('*')
        .single();
      if (updateError) {
        setError('Failed to update shot.');
        return;
      }
      data = updated;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('shots')
        .insert(payload)
        .select('*')
        .single();
      if (insertError) {
        setError('Failed to save shot.');
        return;
      }
      data = inserted;
    }
    const nextMatches = matches.map((match) =>
      match.info.id === currentMatch.info.id
        ? {
            ...match,
            shots: match.shots
              .map((shot) =>
                shot.id === editingShotId
                  ? {
                      id: data.id,
                      x: data.x,
                      y: data.y,
                      zone: data.zone,
                      result: data.result,
                      playerCap: data.player_cap,
                      attackType: data.attack_type,
                    time: data.time,
                    period: data.period,
                    matchId: currentMatch.info.id
                    }
                  : shot
              )
              .concat(
                editingShotId
                  ? []
                  : [
                      {
                        id: data.id,
                        x: data.x,
                        y: data.y,
                        zone: data.zone,
                        result: data.result,
                        playerCap: data.player_cap,
                        attackType: data.attack_type,
                        time: data.time,
                        period: data.period,
                        matchId: currentMatch.info.id
                      }
                    ]
              )
          }
        : match
    );
    setMatches(nextMatches);
    setLastShotMeta({ period: pendingShot.period, time: normalizeTime(pendingShot.time) });
    setPendingShot(null);
    setEditingShotId(null);
    setError('');
    notifyDataUpdated();
  };

  const deleteShot = async (shotId) => {
    if (!window.confirm('Delete this shot?')) return;
    const { error: deleteError } = await supabase.from('shots').delete().eq('id', shotId);
    if (deleteError) return;
    const nextMatches = matches.map((match) =>
      match.info.id === currentMatch.info.id
        ? { ...match, shots: match.shots.filter((shot) => shot.id !== shotId) }
        : match
    );
    setMatches(nextMatches);
    notifyDataUpdated();
  };

  const handleRosterAdd = async () => {
    if (!rosterForm.name || !rosterForm.capNumber) {
      setError('Enter name and cap number.');
      return;
    }
    let data;
    if (editingRosterId) {
      const { data: updated, error: updateError } = await supabase
        .from('roster')
        .update({ name: rosterForm.name, cap_number: rosterForm.capNumber })
        .eq('id', editingRosterId)
        .select('*')
        .single();
      if (updateError) return;
      data = updated;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('roster')
        .insert({
          team_id: teamId,
          user_id: userId,
          name: rosterForm.name,
          cap_number: rosterForm.capNumber
        })
        .select('*')
        .single();
      if (insertError) return;
      data = inserted;
    }
    const nextRoster = roster
      .map((player) =>
        player.id === editingRosterId
          ? { id: data.id, name: data.name, capNumber: data.cap_number }
          : player
      )
      .concat(
        editingRosterId
          ? []
          : [{ id: data.id, name: data.name, capNumber: data.cap_number }]
      );
    setRoster(nextRoster);
    setRosterForm({ name: '', capNumber: '' });
    setEditingRosterId(null);
    setError('');
    notifyDataUpdated();
  };

  const removeRosterPlayer = async (playerId) => {
    if (!window.confirm('Delete this player?')) return;
    const { error: deleteError } = await supabase.from('roster').delete().eq('id', playerId);
    if (deleteError) return;
    const nextRoster = roster.filter((player) => player.id !== playerId);
    setRoster(nextRoster);
    notifyDataUpdated();
  };

  const addMatch = async () => {
    const draft = DEFAULT_MATCH();
    const { data, error: insertError } = await supabase
      .from('matches')
      .insert({
        name: draft.info.name,
        date: draft.info.date,
        season_id: seasonId,
        team_id: teamId,
        user_id: userId
      })
      .select('*')
      .single();
    if (insertError) return;
    const fresh = { info: { id: data.id, name: data.name, date: data.date }, shots: [] };
    const nextMatches = [...matches, fresh];
    setMatches(nextMatches);
    setCurrentMatchId(fresh.info.id);
    notifyDataUpdated();
  };

  const deleteMatch = async (matchId) => {
    if (!window.confirm('Delete this match?')) return;
    const { error: deleteError } = await supabase.from('matches').delete().eq('id', matchId);
    if (deleteError) return;
    const nextMatches = matches.filter((match) => match.info.id !== matchId);
    setMatches(nextMatches);
    setCurrentMatchId(nextMatches[0]?.info?.id || '');
    notifyDataUpdated();
  };

  const updateMatchInfo = async (field, value) => {
    if (!currentMatch) return;
    const { error: updateError } = await supabase
      .from('matches')
      .update({ [field]: value })
      .eq('id', currentMatch.info.id);
    if (updateError) return;
    const nextMatches = matches.map((match) =>
      match.info.id === currentMatch.info.id
        ? { ...match, info: { ...match.info, [field]: value } }
        : match
    );
    setMatches(nextMatches);
    notifyDataUpdated();
  };

  const filteredShots = useMemo(() => {
    const relevantMatches = seasonMode
      ? matches.filter((match) =>
          filters.matches.length ? filters.matches.includes(match.info.id) : true
        )
      : currentMatch
      ? [currentMatch]
      : [];
    const shots = relevantMatches.flatMap((match) => match.shots);
    return shots.filter((shot) => {
      if (seasonMode) {
        if (filters.players.length && !filters.players.includes(shot.playerCap)) return false;
        if (filters.results.length && !filters.results.includes(shot.result)) return false;
        if (filters.periods.length && !filters.periods.includes(shot.period)) return false;
        if (filters.attackTypes.length && !filters.attackTypes.includes(shot.attackType)) return false;
      }
      return true;
    });
  }, [seasonMode, matches, currentMatch, filters]);

  const displayShots = useMemo(() => {
    return [...filteredShots].sort((a, b) => {
      const periodA = PERIODS.indexOf(a.period);
      const periodB = PERIODS.indexOf(b.period);
      if (periodA !== periodB) return periodA - periodB;
      return timeToSeconds(b.time) - timeToSeconds(a.time);
    });
  }, [filteredShots]);

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
      const title = seasonMode ? 'Water Polo Shotmap (Season)' : `Water Polo Shotmap - ${currentMatch?.info?.name || ''}`;
      ctx.fillText(title, 40, 64);
      ctx.drawImage(canvas, 0, 100, 1440, 1200);
      const url = output.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `shotmap_${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
    } catch (e) {
      setError('PNG export failed.');
    }
  };

  const exportCSV = () => {
    const matchNameById = new Map(matches.map((match) => [match.info.id, match.info.name]));
    const rows = [
      ['match', 'playerCap', 'result', 'attackType', 'period', 'time', 'zone', 'x', 'y']
    ];
    filteredShots.forEach((shot) => {
      rows.push([
        matchNameById.get(shot.matchId) || '',
        shot.playerCap,
        shot.result,
        shot.attackType,
        shot.period,
        shot.time,
        shot.zone,
        shot.x,
        shot.y
      ]);
    });
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/\"/g, '""')}"`).join(',')).join('\\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const penaltyShots = filteredShots.filter((shot) => shot.attackType === 'strafworp');

  if (loading) {
    return <div className="p-10 text-slate-700">Loading...</div>;
  }

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
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
            onClick={exportCSV}
          >
            Export CSV
          </button>
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
                    onClick={saveShot}
                  >
                    {editingShotId ? 'Update' : 'Save'}
                  </button>
                  <button
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                    onClick={() => {
                      setPendingShot(null);
                      setEditingShotId(null);
                    }}
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
            <p className="mt-2 text-sm text-slate-500">
              Manage player details in the Roster tab.
            </p>
            <div className="mt-3 space-y-2">
              {roster
                .slice()
                .sort((a, b) => Number(a.capNumber) - Number(b.capNumber))
                .map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
                  >
                    <span>
                      #{player.capNumber} {player.name}
                    </span>
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
                  <div className="flex items-center gap-2">
                    <button
                      className="text-xs font-semibold text-slate-600"
                      onClick={() => {
                        setPendingShot({
                          x: shot.x,
                          y: shot.y,
                          zone: shot.zone,
                          attackType: shot.attackType,
                          result: shot.result,
                          playerCap: shot.playerCap,
                          period: shot.period,
                          time: shot.time
                        });
                        setEditingShotId(shot.id);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="text-xs font-semibold text-red-500"
                      onClick={() => deleteShot(shot.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PlayersView = ({ seasonId, teamId, userId, seasons = [], onSelectSeason, onSelectTeam }) => {
  const [data, setData] = useState({ roster: [], matches: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [selectedMatches, setSelectedMatches] = useState([]);
  const reportRef = useRef(null);

  useEffect(() => {
    if (!teamId) return;
    let active = true;
    const load = async () => {
      try {
        const payload = await loadTeamData(teamId);
        if (!active) return;
        const mappedRoster = payload.roster.map((player) => ({
          id: player.id,
          name: player.name,
          capNumber: player.cap_number,
          birthday: player.birthday,
          heightCm: player.height_cm,
          weightKg: player.weight_kg,
          dominantHand: player.dominant_hand,
          notes: player.notes,
          photoUrl: player.photo_url
        }));
        setData({ roster: mappedRoster, matches: payload.matches });
        setSelectedMatches(payload.matches.map((match) => match.info.id));
        setSelectedPlayerId(mappedRoster[0]?.id || '');
        setCompareA(mappedRoster[0]?.id || '');
        setCompareB(mappedRoster[1]?.id || '');
        setError('');
      } catch (e) {
        if (active) setError('Could not load player data.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [teamId]);

  const matches = data.matches || [];
  const roster = data.roster || [];
  const selectedSeason = seasons.find((season) => season.id === seasonId);
  const seasonTeams = selectedSeason?.teams || [];
  const selectedTeam = seasonTeams.find((team) => team.id === teamId);

  const scopedMatches = useMemo(() => {
    if (!selectedMatches.length) return [];
    const matchSet = new Set(selectedMatches);
    return matches.filter((match) => matchSet.has(match.info.id));
  }, [matches, selectedMatches]);

  const shots = useMemo(
    () => scopedMatches.flatMap((match) => match.shots || []),
    [scopedMatches]
  );

  const scopeSummary = useMemo(() => {
    const seasonLabel = selectedSeason?.name || 'Season';
    const teamLabel = selectedTeam?.name || 'Team';
    if (!matches.length) return `${seasonLabel} • ${teamLabel} • No matches`;
    if (selectedMatches.length === 0) return `${seasonLabel} • ${teamLabel} • No matches selected`;
    if (selectedMatches.length === matches.length) return `${seasonLabel} • ${teamLabel} • All matches`;
    const matchSet = new Set(selectedMatches);
    const names = matches
      .filter((match) => matchSet.has(match.info.id))
      .map((match) => match.info?.name || 'Match')
      .slice(0, 3);
    const remainder = selectedMatches.length - names.length;
    const list = remainder > 0 ? `${names.join(', ')} +${remainder}` : names.join(', ');
    return `${seasonLabel} • ${teamLabel} • ${list}`;
  }, [matches, selectedMatches, selectedSeason, selectedTeam]);

  const handleSeasonChange = (value) => {
    if (!onSelectSeason) return;
    onSelectSeason(value);
    const nextSeason = seasons.find((season) => season.id === value);
    const nextTeamId = nextSeason?.teams?.[0]?.id || '';
    if (onSelectTeam) onSelectTeam(nextTeamId);
  };

  const toggleMatch = (matchId) => {
    setSelectedMatches((prev) =>
      prev.includes(matchId) ? prev.filter((id) => id !== matchId) : [...prev, matchId]
    );
  };

  const buildStats = (player) => {
    if (!player) return null;
    const playerShots = shots.filter((shot) => shot.playerCap === player.capNumber);
    const goals = playerShots.filter((shot) => shot.result === 'raak');
    const saves = playerShots.filter((shot) => shot.result === 'redding');
    const misses = playerShots.filter((shot) => shot.result === 'mis');
    const goalPct = playerShots.length ? ((goals.length / playerShots.length) * 100).toFixed(1) : '0.0';
    const avgDistance = goals.length
      ? (goals.reduce((sum, shot) => sum + distanceMeters(shot), 0) / goals.length).toFixed(1)
      : '—';
    const zoneCount = {};
    goals.forEach((shot) => {
      zoneCount[shot.zone] = (zoneCount[shot.zone] || 0) + 1;
    });
    const preferredZone = Object.keys(zoneCount).sort((a, b) => zoneCount[b] - zoneCount[a])[0] || '—';
    return {
      total: playerShots.length,
      goals: goals.length,
      saves: saves.length,
      misses: misses.length,
      goalPct,
      avgDistance,
      preferredZone,
      shots: playerShots
    };
  };

  const selectedPlayer = roster.find((player) => player.id === selectedPlayerId);
  const selectedStats = buildStats(selectedPlayer);
  const comparePlayerA = roster.find((player) => player.id === compareA);
  const comparePlayerB = roster.find((player) => player.id === compareB);
  const compareStatsA = buildStats(comparePlayerA);
  const compareStatsB = buildStats(comparePlayerB);

  const exportPDF = async () => {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const imgWidth = canvas.width * ratio;
    const imgHeight = canvas.height * ratio;
    pdf.addImage(imgData, 'PNG', (pageWidth - imgWidth) / 2, 20, imgWidth, imgHeight);
    pdf.save(`player_report_${selectedPlayer?.capNumber || 'player'}.pdf`);
  };

  if (loading) {
    return <div className="p-10 text-slate-700">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-cyan-700">Players</p>
          <h2 className="text-2xl font-semibold">Player Report Card</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            onClick={exportPDF}
            disabled={!selectedPlayer}
          >
            <Download size={16} />
            Export PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-500">Scope</p>
                <h3 className="text-sm font-semibold text-slate-700">Season and matches</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold"
                  onClick={() => setSelectedMatches(matches.map((match) => match.info.id))}
                >
                  Select all
                </button>
                <button
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold"
                  onClick={() => setSelectedMatches([])}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-500">Season</label>
                <select
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={seasonId}
                  onChange={(event) => handleSeasonChange(event.target.value)}
                >
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Team</label>
                <select
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={teamId}
                  onChange={(event) => onSelectTeam?.(event.target.value)}
                >
                  {seasonTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="text-xs font-semibold text-slate-500">Matches</div>
              <div className="flex flex-wrap gap-2">
                {matches.length === 0 && (
                  <span className="text-xs text-slate-500">No matches yet.</span>
                )}
                {matches.map((match) => {
                  const selected = selectedMatches.includes(match.info.id);
                  const label = match.info?.name || 'Match';
                  const dateLabel = match.info?.date ? ` • ${match.info.date}` : '';
                  return (
                    <button
                      key={match.info.id}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        selected ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600'
                      }`}
                      onClick={() => toggleMatch(match.info.id)}
                    >
                      {label}
                      {dateLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <label className="text-xs font-semibold text-slate-500">Select player</label>
            <select
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={selectedPlayerId}
              onChange={(event) => setSelectedPlayerId(event.target.value)}
            >
              {roster.map((player) => (
                <option key={player.id} value={player.id}>
                  #{player.capNumber} {player.name}
                </option>
              ))}
            </select>
          </div>

          <div ref={reportRef} className="rounded-2xl bg-white p-6 shadow-sm">
            {selectedPlayer ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 overflow-hidden rounded-2xl bg-slate-100">
                    {selectedPlayer.photoUrl ? (
                      <img
                        src={selectedPlayer.photoUrl}
                        alt={selectedPlayer.name}
                        crossOrigin="anonymous"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">No photo</div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">#{selectedPlayer.capNumber} {selectedPlayer.name}</h3>
                    <div className="text-sm text-slate-500">
                      {selectedPlayer.dominantHand || 'Hand n/a'}
                    </div>
                    <div className="text-xs text-slate-400">{scopeSummary}</div>
                  </div>
                </div>

                {selectedStats && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-xs text-slate-500">Shots</div>
                      <div className="text-lg font-semibold">{selectedStats.total}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-xs text-slate-500">Goal %</div>
                      <div className="text-lg font-semibold">{selectedStats.goalPct}%</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-xs text-slate-500">Goals</div>
                      <div className="text-lg font-semibold">{selectedStats.goals}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-xs text-slate-500">Saved</div>
                      <div className="text-lg font-semibold">{selectedStats.saves}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-xs text-slate-500">Miss</div>
                      <div className="text-lg font-semibold">{selectedStats.misses}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-xs text-slate-500">Avg goal distance</div>
                      <div className="text-lg font-semibold">{selectedStats.avgDistance}m</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-xs text-slate-500">Preferred zone (goals)</div>
                      <div className="text-lg font-semibold">{selectedStats.preferredZone}</div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-xl border border-slate-100 p-3">
                    <div className="text-xs text-slate-500">Age</div>
                    <div className="text-lg font-semibold">
                      {computeAge(selectedPlayer.birthday) ?? '—'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-100 p-3">
                    <div className="text-xs text-slate-500">Height</div>
                    <div className="text-lg font-semibold">{selectedPlayer.heightCm ? `${selectedPlayer.heightCm} cm` : '—'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-100 p-3">
                    <div className="text-xs text-slate-500">Weight</div>
                    <div className="text-lg font-semibold">{selectedPlayer.weightKg ? `${selectedPlayer.weightKg} kg` : '—'}</div>
                  </div>
                </div>

                {selectedPlayer.notes && (
                  <div className="rounded-xl border border-slate-100 p-3 text-sm text-slate-600">
                    {selectedPlayer.notes}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No player selected.</div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Player comparison</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={compareA}
                onChange={(event) => setCompareA(event.target.value)}
              >
                {roster.map((player) => (
                  <option key={player.id} value={player.id}>
                    #{player.capNumber} {player.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={compareB}
                onChange={(event) => setCompareB(event.target.value)}
              >
                {roster.map((player) => (
                  <option key={player.id} value={player.id}>
                    #{player.capNumber} {player.name}
                  </option>
                ))}
              </select>
            </div>
            {compareStatsA && compareStatsB && (
              <div className="mt-4 space-y-2 text-sm">
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-100 px-3 py-2">
                  <span className="text-slate-500">Shots</span>
                  <span className="font-semibold">{compareStatsA.total}</span>
                  <span className="font-semibold">{compareStatsB.total}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-100 px-3 py-2">
                  <span className="text-slate-500">Goal %</span>
                  <span className="font-semibold">{compareStatsA.goalPct}%</span>
                  <span className="font-semibold">{compareStatsB.goalPct}%</span>
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-100 px-3 py-2">
                  <span className="text-slate-500">Avg distance</span>
                  <span className="font-semibold">{compareStatsA.avgDistance}m</span>
                  <span className="font-semibold">{compareStatsB.avgDistance}m</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const HelpView = () => (
  <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-cyan-700">Help</p>
        <h2 className="text-2xl font-semibold">Getting Started & FAQ</h2>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Getting started</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>Create a season and team on the Seasons & Teams screen.</li>
            <li>Add players in the Roster tab (photo optional).</li>
            <li>Create a match in Shotmap and start adding shots.</li>
            <li>Use Analytics for heatmaps and filters.</li>
            <li>Open Players for report cards and comparisons.</li>
          </ol>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Legend</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              Goal (raak)
            </div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-orange-400" />
              Saved (redding)
            </div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              Miss (mis)
            </div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-sm bg-slate-900" />
              Penalty shot (P marker)
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-500">
            Heatmap colors are scaled per view. Red → green indicates low → high for Count and % Goal.
            Green → red indicates low → high for % Saved, % Miss, and Distance.
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">FAQ</h3>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <div>
              <div className="font-semibold text-slate-700">Why don’t I see my players?</div>
              Make sure you selected the correct season and team folder.
            </div>
            <div>
              <div className="font-semibold text-slate-700">Can I change a shot?</div>
              Yes. Click a shot in the list, edit details, and save.
            </div>
            <div>
              <div className="font-semibold text-slate-700">What happens if I delete a player?</div>
              Shots remain; the cap number keeps the historical data intact.
            </div>
            <div>
              <div className="font-semibold text-slate-700">Why are some matches missing in reports?</div>
              Check the scope selector in the Players tab. You can include or exclude matches.
            </div>
            <div>
              <div className="font-semibold text-slate-700">Can I export a report?</div>
              Use “Export PDF” in the Players tab.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const PrivacyView = () => (
  <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-cyan-700">Privacy</p>
        <h2 className="text-2xl font-semibold">Privacy Policy</h2>
        <p className="mt-2 text-xs text-slate-500">Last updated: February 10, 2026</p>
      </div>
    </div>

    <div className="rounded-2xl bg-white p-6 shadow-sm text-sm text-slate-600 space-y-4">
      <p>
        This Privacy Policy explains how Waterpolo Shotmap & Analytics (“we”, “us”, or “the App”) collects,
        uses, and shares personal data. This policy is designed to comply with the EU General Data Protection
        Regulation (GDPR) and international privacy standards.
      </p>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">1. Controller</h3>
        <p>Controller: Waterpolo Shotmap & Analytics</p>
        <p>Contact: privacy@paulzuiderduin.com</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">2. Data We Collect</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Account data: Email address used for magic‑link login.</li>
          <li>Team & match data: Seasons, teams, matches, and shot records you create.</li>
          <li>Player data: Name, cap number, birthday (used only to calculate age), dominant hand, height/weight, notes.</li>
          <li>Media: Optional player photos.</li>
          <li>Technical data: Session tokens, IP address, browser/device metadata necessary for security and service operation.</li>
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">3. Purposes and Legal Bases (GDPR)</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Service delivery: Authentication, storage, and analytics.</li>
          <li>Security and maintenance: Monitoring, stability, and troubleshooting.</li>
          <li>Reporting: Generating analytics and PDF reports.</li>
        </ul>
        <p className="mt-2">
          Legal bases: Performance of contract (Art. 6(1)(b)), legitimate interests (Art. 6(1)(f)), and consent
          (Art. 6(1)(a)) for optional data such as photos.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">4. Processors and Storage</h3>
        <p>We use Supabase for authentication, database, and file storage. Supabase acts as a data processor on our behalf.</p>
        <p>Data may be processed internationally. Where required, appropriate safeguards (e.g., Standard Contractual Clauses) are used.</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">5. Data Sharing</h3>
        <p>We do not sell personal data. We only share data with service providers (Supabase) and authorities if required by law.</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">6. Retention</h3>
        <p>We retain data as long as your account is active or as required to provide the service. You can delete data in the App.</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">7. Your Rights (GDPR)</h3>
        <p>
          You have the right to access, rectify, erase, restrict, object, and receive your data. Contact us at
          privacy@paulzuiderduin.com to exercise these rights.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">8. Security</h3>
        <p>We use Supabase authentication and database policies (RLS). No system is 100% secure; keep login links private.</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">9. Children</h3>
        <p>The App is intended for coaches and team administrators. If you process data of minors, you are responsible for obtaining permissions.</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">10. Changes</h3>
        <p>We may update this policy. The latest version will always be available in the App.</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">11. Supervisory Authority</h3>
        <p>If you are in the EU, you can lodge a complaint with your local supervisory authority. In the Netherlands, this is the Autoriteit Persoonsgegevens.</p>
      </div>
    </div>
  </div>
);

const RosterView = ({ seasonId, teamId, userId }) => {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    capNumber: '',
    birthday: '',
    heightCm: '',
    weightKg: '',
    dominantHand: '',
    notes: ''
  });

  useEffect(() => {
    if (!teamId) return;
    let active = true;
    const load = async () => {
      try {
        const payload = await loadTeamData(teamId);
        if (!active) return;
        const mappedRoster = payload.roster.map((player) => ({
          id: player.id,
          name: player.name,
          capNumber: player.cap_number,
          heightCm: player.height_cm || '',
          weightKg: player.weight_kg || '',
          dominantHand: player.dominant_hand || '',
          notes: player.notes || '',
          photoUrl: player.photo_url || '',
          birthday: player.birthday || ''
        }));
        setRoster(mappedRoster);
      } catch (e) {
        if (active) setError('Could not load roster.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [teamId]);

  const resetForm = () => {
    setForm({
      name: '',
      capNumber: '',
      birthday: '',
      heightCm: '',
      weightKg: '',
      dominantHand: '',
      notes: ''
    });
    setEditingId(null);
  };

  const savePlayer = async () => {
    if (!form.name || !form.capNumber) {
      setError('Enter name and cap number.');
      return;
    }
    const payload = {
      name: form.name,
      cap_number: form.capNumber,
      birthday: form.birthday || null,
      height_cm: form.heightCm ? Number(form.heightCm) : null,
      weight_kg: form.weightKg ? Number(form.weightKg) : null,
      dominant_hand: form.dominantHand,
      notes: form.notes
    };
    let data;
    if (editingId) {
      const { data: updated, error: updateError } = await supabase
        .from('roster')
        .update(payload)
        .eq('id', editingId)
        .select('*')
        .single();
      if (updateError) return;
      data = updated;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('roster')
        .insert({ ...payload, team_id: teamId, user_id: userId })
        .select('*')
        .single();
      if (insertError) return;
      data = inserted;
    }
    const nextRoster = roster
      .map((player) => (player.id === editingId ? { ...player, ...form, id: data.id } : player))
      .concat(editingId ? [] : [{ ...form, id: data.id, photoUrl: data.photo_url || '' }]);
    setRoster(nextRoster);
    resetForm();
    notifyDataUpdated();
  };

  const deletePlayer = async (playerId) => {
    if (!window.confirm('Delete this player?')) return;
    const { error: deleteError } = await supabase.from('roster').delete().eq('id', playerId);
    if (deleteError) return;
    setRoster(roster.filter((player) => player.id !== playerId));
    notifyDataUpdated();
  };

  const uploadPhoto = async (playerId, file) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WEBP image.');
      return;
    }
    const ext = file.name.split('.').pop();
    const path = `${userId}/${teamId}/${playerId}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('player-photos').upload(path, file, {
      upsert: true,
      contentType: file.type
    });
    if (uploadError) {
      setError(`Photo upload failed: ${uploadError.message}`);
      return;
    }
    const { data } = supabase.storage.from('player-photos').getPublicUrl(path);
    const { error: updateError } = await supabase
      .from('roster')
      .update({ photo_url: data.publicUrl })
      .eq('id', playerId);
    if (updateError) return;
    setRoster(
      roster.map((player) => (player.id === playerId ? { ...player, photoUrl: data.publicUrl } : player))
    );
  };

  if (loading) {
    return <div className="p-10 text-slate-700">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-cyan-700">Roster</p>
          <h2 className="text-2xl font-semibold">Player Info</h2>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Player details</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Cap #"
              value={form.capNumber}
              onChange={(event) => setForm({ ...form, capNumber: event.target.value })}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Age"
              value={form.age}
              onChange={(event) => setForm({ ...form, age: event.target.value })}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              type="date"
              placeholder="Birthday"
              value={form.birthday}
              onChange={(event) => setForm({ ...form, birthday: event.target.value })}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Height (cm)"
              value={form.heightCm}
              onChange={(event) => setForm({ ...form, heightCm: event.target.value })}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Weight (kg)"
              value={form.weightKg}
              onChange={(event) => setForm({ ...form, weightKg: event.target.value })}
            />
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.dominantHand}
              onChange={(event) => setForm({ ...form, dominantHand: event.target.value })}
            >
              <option value="">Dominant hand</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="ambidextrous">Ambidextrous</option>
            </select>
            <textarea
              className="col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Notes"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              rows={3}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={savePlayer}
            >
              {editingId ? 'Update player' : 'Add player'}
            </button>
            <button
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
              onClick={resetForm}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Roster list</h3>
          <div className="mt-3 space-y-3">
            {roster
              .slice()
              .sort((a, b) => Number(a.capNumber) - Number(b.capNumber))
              .map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-100">
                    {player.photoUrl ? (
                        <img
                          src={player.photoUrl}
                          alt={player.name}
                          crossOrigin="anonymous"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">No photo</div>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold">#{player.capNumber} {player.name}</div>
                      <div className="text-xs text-slate-500">
                        {computeAge(player.birthday) ?? '—'} yrs
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer text-xs font-semibold text-slate-600">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) uploadPhoto(player.id, file);
                        }}
                      />
                      Upload
                    </label>
                    <button
                      className="text-xs font-semibold text-slate-600"
                      onClick={() => {
                        setForm({
                          name: player.name,
                          capNumber: player.capNumber,
                          birthday: player.birthday,
                          heightCm: player.heightCm,
                          weightKg: player.weightKg,
                          dominantHand: player.dominantHand,
                          notes: player.notes
                        });
                        setEditingId(player.id);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="text-xs font-semibold text-red-500"
                      onClick={() => deletePlayer(player.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
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
    return <div className="p-10 text-slate-700">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-cyan-700">Water Polo Analytics</p>
          <h2 className="text-2xl font-semibold">Heatmaps & Analysis</h2>
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
                  👁️ {showShots ? 'Hide shots' : 'Show shots'}
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Heatmap field</h3>
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
                        <div className="absolute bottom-2 left-2 text-[10px] text-white/70">Penalties</div>
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
                <div className="font-semibold text-slate-700">Legend</div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-red-500/60" />
                    Low
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-amber-400/60" />
                    Mid
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-green-500/60" />
                    High
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  Gradient based on max value in zones 1-13.
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

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Zone 14 stats</h3>
            <div className="mt-3 text-sm text-slate-600">
              {zone14Stats?.total ? (
                <div className="space-y-1">
                  <div>Total: {zone14Stats.total}</div>
                  <div>Goal: {zone14Stats.success}</div>
                  <div>Saved: {zone14Stats.save}</div>
                  <div>Miss: {zone14Stats.miss}</div>
                </div>
              ) : (
                <div>No penalties in selection.</div>
              )}
            </div>
          </div>

          {heatType === 'distance' && distanceByResult && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Average distance</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <span>Goal</span>
                  <span className="font-semibold text-emerald-700">{distanceByResult.raak}m</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <span>Saved</span>
                  <span className="font-semibold text-amber-700">{distanceByResult.redding}m</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <span>Miss</span>
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
