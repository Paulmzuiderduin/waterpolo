import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Plus,
  BarChart2,
  Users,
  IdCard,
  HelpCircle,
  Home,
  ClipboardList,
  Share2,
  CalendarDays,
  Settings2
} from 'lucide-react';
import { supabase } from './lib/supabase';
import AppHeader from './components/AppHeader';
import MobileNav from './components/MobileNav';
import SidebarNav from './components/SidebarNav';
import { useAuthSession } from './hooks/useAuthSession';
import { useSeasonsTeams } from './hooks/useSeasonsTeams';
import { detectZone, distanceMeters, penaltyPosition, valueToColor, VIRIDIS } from './utils/field';
import { computeAge, formatShotTime, normalizeTime, splitTimeParts, timeToSeconds } from './utils/time';

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
const PERIOD_ORDER = { '1': 1, '2': 2, '3': 3, '4': 4, OT: 5 };
const SCORING_EVENTS = [
  { key: 'goal', label: 'Goal', player: true, color: 'bg-emerald-600' },
  { key: 'exclusion', label: 'Exclusion', player: true, color: 'bg-amber-500' },
  { key: 'foul', label: 'Foul', player: true, color: 'bg-orange-500' },
  { key: 'turnover_won', label: 'Turnover won', player: true, color: 'bg-sky-600' },
  { key: 'turnover_lost', label: 'Turnover lost', player: true, color: 'bg-rose-500' },
  { key: 'penalty', label: 'Penalty', player: true, color: 'bg-indigo-600' },
  { key: 'timeout', label: 'Timeout', player: false, color: 'bg-slate-700' }
];

const POSSESSION_OUTCOMES = [
  { key: 'goal', label: 'Goal' },
  { key: 'miss', label: 'Miss' },
  { key: 'exclusion', label: 'Exclusion' },
  { key: 'turnover_won', label: 'Turnover won' },
  { key: 'turnover_lost', label: 'Turnover lost' }
];

const HEAT_TYPES = [
  { key: 'count', label: 'Count', metric: 'count', color: 'viridis' },
  { key: 'success', label: '% Goal', metric: 'success', color: 'viridis' },
  { key: 'save', label: '% Saved', metric: 'save', color: 'viridisReverse' },
  { key: 'miss', label: '% Miss', metric: 'miss', color: 'viridisReverse' },
  { key: 'distance', label: '📏 Distance', metric: 'distance', color: 'none' }
];

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
    matchMap.set(match.id, {
      info: {
        id: match.id,
        name: match.name,
        date: match.date,
        opponent: match.opponent_name || ''
      },
      shots: []
    });
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

const loadTeamScoring = async (teamId) => {
  if (!teamId) return { roster: [], matches: [], events: [] };
  const [rosterRes, matchRes, eventRes] = await Promise.all([
    supabase.from('roster').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
    supabase.from('matches').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
    supabase.from('scoring_events').select('*').eq('team_id', teamId)
  ]);
  if (rosterRes.error || matchRes.error || eventRes.error) {
    throw new Error('Failed to load scoring data');
  }
  return {
    roster: rosterRes.data || [],
    matches: matchRes.data || [],
    events: eventRes.data || []
  };
};

const loadTeamPossessions = async (teamId) => {
  if (!teamId) return { roster: [], matches: [], possessions: [], passes: [] };
  const [rosterRes, matchRes, possessionRes, passRes] = await Promise.all([
    supabase.from('roster').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
    supabase.from('matches').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
    supabase.from('possessions').select('*').eq('team_id', teamId),
    supabase.from('passes').select('*').eq('team_id', teamId)
  ]);
  if (rosterRes.error || matchRes.error || possessionRes.error || passRes.error) {
    throw new Error('Failed to load possession data');
  }
  return {
    roster: rosterRes.data || [],
    matches: matchRes.data || [],
    possessions: possessionRes.data || [],
    passes: passRes.data || []
  };
};

const loadTeamMatchesOverview = async (teamId) => {
  if (!teamId) return [];
  const [matchRes, shotRes, eventRes, possessionRes, passRes] = await Promise.all([
    supabase
      .from('matches')
      .select('*')
      .eq('team_id', teamId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('shots').select('match_id,result').eq('team_id', teamId),
    supabase.from('scoring_events').select('match_id,event_type').eq('team_id', teamId),
    supabase.from('possessions').select('id,match_id').eq('team_id', teamId),
    supabase.from('passes').select('id,match_id').eq('team_id', teamId)
  ]);

  if (matchRes.error || shotRes.error || eventRes.error || possessionRes.error || passRes.error) {
    throw new Error('Failed to load matches overview');
  }

  const byMatch = new Map();
  (matchRes.data || []).forEach((match) => {
    byMatch.set(match.id, {
      id: match.id,
      name: match.name,
      date: match.date,
      opponentName: match.opponent_name || '',
      shots: 0,
      shotGoals: 0,
      shotSaved: 0,
      shotMissed: 0,
      penalties: 0,
      events: 0,
      goals: 0,
      exclusions: 0,
      fouls: 0,
      turnoversWon: 0,
      turnoversLost: 0,
      possessions: 0,
      passes: 0
    });
  });

  (shotRes.data || []).forEach((shot) => {
    const item = byMatch.get(shot.match_id);
    if (!item) return;
    item.shots += 1;
    if (shot.result === 'raak') item.shotGoals += 1;
    if (shot.result === 'redding') item.shotSaved += 1;
    if (shot.result === 'mis') item.shotMissed += 1;
  });

  (eventRes.data || []).forEach((evt) => {
    const item = byMatch.get(evt.match_id);
    if (!item) return;
    item.events += 1;
    if (evt.event_type === 'goal') item.goals += 1;
    if (evt.event_type === 'exclusion') item.exclusions += 1;
    if (evt.event_type === 'foul') item.fouls += 1;
    if (evt.event_type === 'penalty') item.penalties += 1;
    if (evt.event_type === 'turnover_won') item.turnoversWon += 1;
    if (evt.event_type === 'turnover_lost') item.turnoversLost += 1;
  });

  (possessionRes.data || []).forEach((possession) => {
    const item = byMatch.get(possession.match_id);
    if (!item) return;
    item.possessions += 1;
  });

  (passRes.data || []).forEach((pass) => {
    const item = byMatch.get(pass.match_id);
    if (!item) return;
    item.passes += 1;
  });

  return Array.from(byMatch.values());
};

const App = () => {
  const [activeTab, setActiveTab] = useState('hub');
  const { session, authLoading } = useAuthSession();
  const { seasons, setSeasons, loadingSeasons } = useSeasonsTeams(session?.user?.id);
  const [authEmail, setAuthEmail] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [selectedSeasonId, setSelectedSeasonId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [seasonForm, setSeasonForm] = useState('');
  const [teamForm, setTeamForm] = useState('');
  const [moduleVisibility, setModuleVisibility] = useState({});
  const [preferences, setPreferences] = useState({
    rememberLastTab: true,
    showHubTips: true
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [promptDialog, setPromptDialog] = useState(null);
  const [toasts, setToasts] = useState([]);
  const didApplyStartTab = useRef(false);

  const toast = useCallback((message, type = 'info') => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 2800);
  }, []);

  const confirmAction = useCallback((message) => {
    return new Promise((resolve) => {
      setConfirmDialog({ message, resolve });
    });
  }, []);

  const promptAction = useCallback((message, initialValue = '') => {
    return new Promise((resolve) => {
      setPromptDialog({ message, value: initialValue, resolve });
    });
  }, []);

  const moduleConfig = useMemo(
    () => [
      { key: 'hub', label: 'Dashboard', icon: <Home size={16} />, alwaysVisible: true },
      { key: 'matches', label: 'Matches', icon: <CalendarDays size={16} /> },
      { key: 'shotmap', label: 'Shotmap', icon: <Share2 size={16} /> },
      { key: 'analytics', label: 'Analytics', icon: <BarChart2 size={16} /> },
      { key: 'scoring', label: 'Scoring', icon: <ClipboardList size={16} /> },
      { key: 'possession', label: 'Possession', icon: <Share2 size={16} /> },
      { key: 'players', label: 'Players', icon: <IdCard size={16} /> },
      { key: 'roster', label: 'Roster', icon: <Users size={16} /> },
      { key: 'help', label: 'Help', icon: <HelpCircle size={16} />, alwaysVisible: true },
      { key: 'settings', label: 'Settings', icon: <Settings2 size={16} />, alwaysVisible: true }
    ],
    []
  );

  useEffect(() => {
    if (!session?.user) return;
    const defaults = moduleConfig.reduce((acc, item) => {
      if (item.alwaysVisible) return acc;
      acc[item.key] = true;
      return acc;
    }, {});
    try {
      const raw = localStorage.getItem(`waterpolo_module_visibility_${session.user.id}`);
      const parsed = raw ? JSON.parse(raw) : {};
      setModuleVisibility({ ...defaults, ...parsed });
    } catch {
      setModuleVisibility(defaults);
    }
  }, [session, moduleConfig]);

  useEffect(() => {
    if (!session?.user) return;
    localStorage.setItem(`waterpolo_module_visibility_${session.user.id}`, JSON.stringify(moduleVisibility));
  }, [moduleVisibility, session]);

  useEffect(() => {
    if (!session?.user) return;
    try {
      const raw = localStorage.getItem(`waterpolo_preferences_${session.user.id}`);
      const parsed = raw ? JSON.parse(raw) : {};
      setPreferences((prev) => ({ ...prev, ...parsed }));
    } catch {
      setPreferences({ rememberLastTab: true, showHubTips: true });
    }
  }, [session]);

  useEffect(() => {
    if (!session?.user) return;
    localStorage.setItem(`waterpolo_preferences_${session.user.id}`, JSON.stringify(preferences));
  }, [preferences, session]);

  const selectedSeason = seasons.find((season) => season.id === selectedSeasonId);
  const selectedTeam = selectedSeason?.teams?.find((team) => team.id === selectedTeamId);
  const navItems = moduleConfig.filter((item) => item.alwaysVisible || moduleVisibility[item.key] !== false);
  const mobilePrimaryKeys = ['hub', 'matches', 'shotmap', 'analytics'];
  const mobilePrimaryItems = navItems.filter((item) => mobilePrimaryKeys.includes(item.key));
  const mobileOverflowItems = navItems.filter((item) => !mobilePrimaryKeys.includes(item.key));

  useEffect(() => {
    const visibleKeys = new Set([...navItems.map((item) => item.key), 'privacy']);
    if (!visibleKeys.has(activeTab)) setActiveTab('hub');
  }, [activeTab, navItems]);

  useEffect(() => {
    if (!session?.user || !preferences.rememberLastTab || didApplyStartTab.current) return;
    if (!selectedSeason || !selectedTeam) return;
    const last = localStorage.getItem(`waterpolo_last_tab_${session.user.id}`);
    if (last && navItems.some((item) => item.key === last)) {
      setActiveTab(last);
    }
    didApplyStartTab.current = true;
  }, [session, preferences.rememberLastTab, selectedSeason, selectedTeam, navItems]);

  useEffect(() => {
    if (!session?.user || !preferences.rememberLastTab) return;
    localStorage.setItem(`waterpolo_last_tab_${session.user.id}`, activeTab);
  }, [activeTab, preferences.rememberLastTab, session]);

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
    if (error) {
      toast('Failed to create season.', 'error');
      return;
    }
    const nextSeasons = [...seasons, { id: data.id, name: data.name, teams: [] }];
    setSeasons(nextSeasons);
    setSeasonForm('');
    setSelectedSeasonId(data.id);
    setSelectedTeamId('');
    toast('Season created.', 'success');
  };

  const createTeam = async () => {
    if (!teamForm.trim() || !selectedSeason || !session?.user) return;
    const { data, error } = await supabase
      .from('teams')
      .insert({ name: teamForm.trim(), season_id: selectedSeason.id, user_id: session.user.id })
      .select('*')
      .single();
    if (error) {
      toast('Failed to create team.', 'error');
      return;
    }
    const nextSeasons = seasons.map((season) =>
      season.id === selectedSeason.id
        ? { ...season, teams: [...(season.teams || []), data] }
        : season
    );
    setSeasons(nextSeasons);
    setTeamForm('');
    setSelectedTeamId(data.id);
    toast('Team created.', 'success');
  };

  const renameSeason = async (seasonId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase.from('seasons').update({ name: trimmed }).eq('id', seasonId);
    if (error) {
      toast('Failed to rename season.', 'error');
      return;
    }
    const nextSeasons = seasons.map((season) =>
      season.id === seasonId ? { ...season, name: trimmed } : season
    );
    setSeasons(nextSeasons);
    toast('Season renamed.', 'success');
  };

  const deleteSeason = async (seasonId) => {
    if (!(await confirmAction('Delete season? All teams and data will be removed.'))) return;
    const { error } = await supabase.from('seasons').delete().eq('id', seasonId);
    if (error) {
      toast('Failed to delete season.', 'error');
      return;
    }
    const nextSeasons = seasons.filter((season) => season.id !== seasonId);
    setSeasons(nextSeasons);
    if (selectedSeasonId === seasonId) {
      setSelectedSeasonId('');
      setSelectedTeamId('');
    }
    toast('Season deleted.', 'success');
  };

  const renameTeam = async (seasonId, teamId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase.from('teams').update({ name: trimmed }).eq('id', teamId);
    if (error) {
      toast('Failed to rename team.', 'error');
      return;
    }
    const nextSeasons = seasons.map((season) => {
      if (season.id !== seasonId) return season;
      const teams = (season.teams || []).map((team) =>
        team.id === teamId ? { ...team, name: trimmed } : team
      );
      return { ...season, teams };
    });
    setSeasons(nextSeasons);
    toast('Team renamed.', 'success');
  };

  const deleteTeam = async (seasonId, teamId) => {
    if (!(await confirmAction('Delete team? All data for this team will be removed.'))) return;
    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    if (error) {
      toast('Failed to delete team.', 'error');
      return;
    }
    const nextSeasons = seasons.map((season) => {
      if (season.id !== seasonId) return season;
      return { ...season, teams: (season.teams || []).filter((team) => team.id !== teamId) };
    });
    setSeasons(nextSeasons);
    if (selectedTeamId === teamId) {
      setSelectedTeamId('');
    }
    toast('Team deleted.', 'success');
  };

  const renderUiOverlays = () => (
    <>
      {confirmDialog && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/35 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-800">Please confirm</h3>
            <p className="mt-2 text-sm text-slate-600">{confirmDialog.message}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                onClick={() => {
                  const dialog = confirmDialog;
                  setConfirmDialog(null);
                  dialog.resolve(false);
                }}
              >
                Cancel
              </button>
              <button
                className="wp-primary-bg rounded-lg px-3 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  const dialog = confirmDialog;
                  setConfirmDialog(null);
                  dialog.resolve(true);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {promptDialog && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/35 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-800">{promptDialog.message}</h3>
            <input
              autoFocus
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={promptDialog.value}
              onChange={(event) =>
                setPromptDialog((prev) => (prev ? { ...prev, value: event.target.value } : prev))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  const dialog = promptDialog;
                  setPromptDialog(null);
                  dialog.resolve(dialog.value);
                }
              }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                onClick={() => {
                  const dialog = promptDialog;
                  setPromptDialog(null);
                  dialog.resolve(null);
                }}
              >
                Cancel
              </button>
              <button
                className="wp-primary-bg rounded-lg px-3 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  const dialog = promptDialog;
                  setPromptDialog(null);
                  dialog.resolve(dialog.value);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed right-4 top-4 z-[130] flex w-[min(360px,95vw)] flex-col gap-2">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`rounded-lg px-3 py-2 text-sm font-medium shadow-lg ${
              item.type === 'error'
                ? 'border border-red-200 bg-red-50 text-red-700'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {item.message}
          </div>
        ))}
      </div>
    </>
  );

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
        {renderUiOverlays()}
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
                      onClick={async () => {
                        const next = await promptAction('New season name', season.name);
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
                          onClick={async () => {
                            const next = await promptAction('New team name', team.name);
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
                  <li>Create a match in Matches, then open Shotmap to start tracking shots.</li>
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
        {renderUiOverlays()}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 lg:pl-64">
      <SidebarNav
        selectedSeasonName={selectedSeason.name}
        navItems={navItems}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onSwitchTeam={() => {
          setSelectedSeasonId('');
          setSelectedTeamId('');
        }}
        onSignOut={() => supabase.auth.signOut()}
      />

      <AppHeader
        selectedSeasonName={selectedSeason.name}
        selectedTeamName={selectedTeam.name}
        userEmail={session.user.email}
        seasons={seasons}
        selectedSeasonId={selectedSeasonId}
        onSelectSeason={(nextSeasonId) => {
          const nextSeason = seasons.find((season) => season.id === nextSeasonId);
          setSelectedSeasonId(nextSeasonId);
          setSelectedTeamId(nextSeason?.teams?.[0]?.id || '');
        }}
        teamOptions={selectedSeason.teams || []}
        selectedTeamId={selectedTeamId}
        onSelectTeam={setSelectedTeamId}
      />

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        {activeTab === 'hub' && <HubView showTips={preferences.showHubTips} />}
        {activeTab === 'matches' && (
          <MatchesView
            seasonId={selectedSeasonId}
            teamId={selectedTeamId}
            userId={session.user.id}
            confirmAction={confirmAction}
            toast={toast}
          />
        )}
        {activeTab === 'shotmap' && (
          <ShotmapView
            seasonId={selectedSeasonId}
            teamId={selectedTeamId}
            userId={session.user.id}
            confirmAction={confirmAction}
            toast={toast}
          />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsView seasonId={selectedSeasonId} teamId={selectedTeamId} userId={session.user.id} />
        )}
        {activeTab === 'scoring' && (
          <ScoringView
            seasonId={selectedSeasonId}
            teamId={selectedTeamId}
            userId={session.user.id}
            confirmAction={confirmAction}
            toast={toast}
          />
        )}
        {activeTab === 'possession' && (
          <PossessionView
            seasonId={selectedSeasonId}
            teamId={selectedTeamId}
            userId={session.user.id}
            confirmAction={confirmAction}
            toast={toast}
          />
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
          <RosterView
            seasonId={selectedSeasonId}
            teamId={selectedTeamId}
            userId={session.user.id}
            confirmAction={confirmAction}
            toast={toast}
          />
        )}
        {activeTab === 'help' && <HelpView />}
        {activeTab === 'settings' && (
          <SettingsView
            moduleConfig={moduleConfig}
            moduleVisibility={moduleVisibility}
            onToggle={(key) =>
              setModuleVisibility((prev) => ({
                ...prev,
                [key]: !prev[key]
              }))
            }
            onReset={() => {
              const defaults = moduleConfig.reduce((acc, item) => {
                if (!item.alwaysVisible) acc[item.key] = true;
                return acc;
              }, {});
              setModuleVisibility(defaults);
            }}
            preferences={preferences}
            onSetPreference={(key, value) =>
              setPreferences((prev) => ({
                ...prev,
                [key]: value
              }))
            }
          />
        )}
        {activeTab === 'privacy' && <PrivacyView />}
      </main>

      <footer className="mx-auto mb-14 max-w-7xl px-6 text-xs text-slate-500 lg:mb-6">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
          <span>© {new Date().getFullYear()} Waterpolo Hub</span>
          <button
            className="font-semibold text-slate-700 underline decoration-transparent transition hover:decoration-current"
            onClick={() => setActiveTab('privacy')}
          >
            Privacy Policy
          </button>
        </div>
      </footer>

      <MobileNav
        activeTab={activeTab}
        primaryItems={mobilePrimaryItems}
        overflowItems={mobileOverflowItems}
        mobileMenuOpen={mobileMenuOpen}
        onSelectTab={(key) => {
          setActiveTab(key);
          setMobileMenuOpen(false);
        }}
        onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        onOpenPrivacy={() => {
          setActiveTab('privacy');
          setMobileMenuOpen(false);
        }}
      />
      {renderUiOverlays()}
    </div>
  );
};

const ShotmapView = ({ seasonId, teamId, userId, confirmAction, toast }) => {
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
    const zone = detectZone(x, y, ZONES);
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
    if (!(await confirmAction('Delete this shot?'))) return;
    const { error: deleteError } = await supabase.from('shots').delete().eq('id', shotId);
    if (deleteError) {
      toast('Failed to delete shot.', 'error');
      return;
    }
    const nextMatches = matches.map((match) =>
      match.info.id === currentMatch.info.id
        ? { ...match, shots: match.shots.filter((shot) => shot.id !== shotId) }
        : match
    );
    setMatches(nextMatches);
    notifyDataUpdated();
    toast('Shot deleted.', 'success');
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
      const { default: html2canvas } = await import('html2canvas');
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
            {matches.length === 0 && (
              <div className="text-xs font-semibold text-slate-500">
                Create matches in the `Matches` tab first.
              </div>
            )}
          </div>

          {!seasonMode && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Match selection</h3>
              {matches.length === 0 && (
                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  No matches available. Create a match in the `Matches` tab.
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                {matches.map((match) => (
                  <button
                    key={match.info.id}
                    className={`rounded-full px-3 py-1 ${
                      match.info.id === currentMatch?.info?.id
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                    onClick={() => setCurrentMatchId(match.info.id)}
                  >
                    {match.info.name}
                  </button>
                ))}
              </div>
              {currentMatch && (
                <div className="mt-3 text-xs text-slate-500">
                  {currentMatch.info.name}
                  {currentMatch.info.opponent ? ` vs ${currentMatch.info.opponent}` : ''} · {currentMatch.info.date}
                </div>
              )}
              {!currentMatch && matches.length > 0 && (
                <div className="mt-3 text-xs text-slate-500">Select a match to track shots.</div>
              )}
              {!currentMatch && matches.length === 0 && (
                <div className="mt-3 text-xs text-slate-500">
                  Tracking is disabled until a match is created in `Matches`.
                </div>
              )}
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
                    ? penaltyPosition(penaltyShots.findIndex((item) => item.id === shot.id), ZONES)
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
  const [scoringEvents, setScoringEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [selectedMatches, setSelectedMatches] = useState([]);
  const [reportSource, setReportSource] = useState('shotmap');
  const reportRef = useRef(null);

  useEffect(() => {
    if (!teamId) return;
    let active = true;
    const load = async () => {
      try {
        const payload = await loadTeamData(teamId);
        const { data: scoringData, error: scoringError } = await supabase
          .from('scoring_events')
          .select('*')
          .eq('team_id', teamId);
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
        if (!scoringError) {
          setScoringEvents(
            (scoringData || []).map((evt) => ({
              id: evt.id,
              matchId: evt.match_id,
              type: evt.event_type,
              playerCap: evt.player_cap || '',
              period: evt.period,
              time: evt.time
            }))
          );
        }
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

  const scopedScoringEvents = useMemo(() => {
    if (!selectedMatches.length) return [];
    const matchSet = new Set(selectedMatches);
    return scoringEvents.filter((evt) => matchSet.has(evt.matchId));
  }, [scoringEvents, selectedMatches]);

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

  const buildShotmapStats = (player) => {
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

  const buildScoringStats = (player) => {
    if (!player) return null;
    const playerEvents = scopedScoringEvents.filter((evt) => evt.playerCap === player.capNumber);
    const countBy = (type) => playerEvents.filter((evt) => evt.type === type).length;
    return {
      goals: countBy('goal'),
      exclusions: countBy('exclusion'),
      fouls: countBy('foul'),
      turnoversWon: countBy('turnover_won'),
      turnoversLost: countBy('turnover_lost'),
      penalties: countBy('penalty'),
      total: playerEvents.length
    };
  };

  const selectedPlayer = roster.find((player) => player.id === selectedPlayerId);
  const selectedStats =
    reportSource === 'shotmap'
      ? buildShotmapStats(selectedPlayer)
      : buildScoringStats(selectedPlayer);
  const comparePlayerA = roster.find((player) => player.id === compareA);
  const comparePlayerB = roster.find((player) => player.id === compareB);
  const compareStatsA =
    reportSource === 'shotmap'
      ? buildShotmapStats(comparePlayerA)
      : buildScoringStats(comparePlayerA);
  const compareStatsB =
    reportSource === 'shotmap'
      ? buildShotmapStats(comparePlayerB)
      : buildScoringStats(comparePlayerB);

  const exportPDF = async () => {
    if (!reportRef.current) return;
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
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
              <div className="flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                <button
                  className={`rounded-full px-3 py-1 ${
                    reportSource === 'shotmap' ? 'bg-white text-slate-900' : ''
                  }`}
                  onClick={() => setReportSource('shotmap')}
                >
                  Shotmap
                </button>
                <button
                  className={`rounded-full px-3 py-1 ${
                    reportSource === 'scoring' ? 'bg-white text-slate-900' : ''
                  }`}
                  onClick={() => setReportSource('scoring')}
                >
                  Scoring
                </button>
              </div>
            </div>
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

                {selectedStats && reportSource === 'shotmap' && (
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

                {selectedStats && reportSource === 'scoring' && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-xs text-slate-500">Events</div>
                      <div className="text-lg font-semibold">{selectedStats.total}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-xs text-slate-500">Goals</div>
                      <div className="text-lg font-semibold">{selectedStats.goals}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-xs text-slate-500">Exclusions</div>
                      <div className="text-lg font-semibold">{selectedStats.exclusions}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-xs text-slate-500">Fouls</div>
                      <div className="text-lg font-semibold">{selectedStats.fouls}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-xs text-slate-500">Turnover won</div>
                      <div className="text-lg font-semibold">{selectedStats.turnoversWon}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-xs text-slate-500">Turnover lost</div>
                      <div className="text-lg font-semibold">{selectedStats.turnoversLost}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-xs text-slate-500">Penalties</div>
                      <div className="text-lg font-semibold">{selectedStats.penalties}</div>
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
            {compareStatsA && compareStatsB && reportSource === 'shotmap' && (
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

            {compareStatsA && compareStatsB && reportSource === 'scoring' && (
              <div className="mt-4 space-y-2 text-sm">
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-100 px-3 py-2">
                  <span className="text-slate-500">Events</span>
                  <span className="font-semibold">{compareStatsA.total}</span>
                  <span className="font-semibold">{compareStatsB.total}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-100 px-3 py-2">
                  <span className="text-slate-500">Goals</span>
                  <span className="font-semibold">{compareStatsA.goals}</span>
                  <span className="font-semibold">{compareStatsB.goals}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-100 px-3 py-2">
                  <span className="text-slate-500">Exclusions</span>
                  <span className="font-semibold">{compareStatsA.exclusions}</span>
                  <span className="font-semibold">{compareStatsB.exclusions}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-100 px-3 py-2">
                  <span className="text-slate-500">Turnover won</span>
                  <span className="font-semibold">{compareStatsA.turnoversWon}</span>
                  <span className="font-semibold">{compareStatsB.turnoversWon}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-100 px-3 py-2">
                  <span className="text-slate-500">Turnover lost</span>
                  <span className="font-semibold">{compareStatsA.turnoversLost}</span>
                  <span className="font-semibold">{compareStatsB.turnoversLost}</span>
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
            <li>Create a match in Matches and start adding shots in Shotmap.</li>
            <li>Use Analytics for heatmaps and filters.</li>
            <li>Open Players for report cards and comparisons.</li>
          </ol>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Legend</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              Goal
            </div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-orange-400" />
              Saved
            </div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              Miss
            </div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-sm bg-slate-900" />
              Penalty shot (P marker)
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-500">
            Heatmap colors use a viridis scale (low → high). Saved and Miss use the reversed scale.
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

const HubView = ({ showTips }) => (
  <div className="space-y-6">
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-cyan-700">Waterpolo Hub</p>
      <h2 className="mt-1 text-2xl font-semibold text-slate-900">Welcome</h2>
      <p className="mt-3 max-w-3xl text-sm text-slate-600">
        Waterpolo Hub is your central workspace for tracking matches and building insights across shotmap, analytics,
        scoring, possession, and player reporting.
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Use the sidebar to open a module. The Hub page stays focused on onboarding and workflow guidance.
      </p>
    </div>

    <div className={`grid grid-cols-1 gap-4 ${showTips ? 'lg:grid-cols-[1.4fr_1fr]' : ''}`}>
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">Getting Started</h3>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-600">
          <li>Create or select a season and team.</li>
          <li>Open `Roster` and add players first.</li>
          <li>Create a match in `Matches`, then track events in `Shotmap`, `Scoring`, or `Possession`.</li>
          <li>Use `Analytics` and `Players` to review performance and export reports.</li>
        </ol>
      </div>

      {showTips && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Workflow Tips</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>Track one match at a time for clean event logs.</li>
              <li>Keep player birthdays and dominant hand updated in `Roster`.</li>
              <li>Use filters in analytics and report cards before exporting.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            Need definitions for zones, event types, and color legends? Open `Help` in the sidebar.
          </div>
        </div>
      )}
    </div>
  </div>
);

const SettingsView = ({
  moduleConfig,
  moduleVisibility,
  onToggle,
  onReset,
  preferences,
  onSetPreference
}) => (
  <div className="space-y-6">
    <div>
      <p className="text-sm font-semibold text-cyan-700">Settings</p>
      <h2 className="text-2xl font-semibold text-slate-900">Workspace Preferences</h2>
      <p className="mt-2 text-sm text-slate-500">Choose which modules you want to see in the sidebar.</p>
    </div>

    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Module visibility</h3>
        <button
          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
          onClick={onReset}
        >
          Reset to default
        </button>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {moduleConfig
          .filter((item) => !item.alwaysVisible)
          .map((item) => {
            const enabled = moduleVisibility[item.key] !== false;
            return (
              <label
                key={item.key}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  {item.icon}
                  {item.label}
                </span>
                <input type="checkbox" checked={enabled} onChange={() => onToggle(item.key)} />
              </label>
            );
          })}
      </div>
    </div>

    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">General</h3>
      <div className="mt-4 space-y-3">
        <label className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
          <span className="text-sm font-medium text-slate-700">Remember last opened module</span>
          <input
            type="checkbox"
            checked={Boolean(preferences.rememberLastTab)}
            onChange={(event) => onSetPreference('rememberLastTab', event.target.checked)}
          />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
          <span className="text-sm font-medium text-slate-700">Show Hub workflow tips</span>
          <input
            type="checkbox"
            checked={Boolean(preferences.showHubTips)}
            onChange={(event) => onSetPreference('showHubTips', event.target.checked)}
          />
        </label>
      </div>
    </div>
  </div>
);

const MatchesView = ({ seasonId, teamId, userId, confirmAction, toast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState([]);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState({
    name: 'New match',
    opponentName: '',
    date: new Date().toISOString().slice(0, 10)
  });
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState({ name: '', opponentName: '', date: '' });

  useEffect(() => {
    if (!seasonId || !teamId) return;
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const rows = await loadTeamMatchesOverview(teamId);
        if (!active) return;
        setMatches(rows);
        setError('');
      } catch (e) {
        if (!active) return;
        setError('Could not load matches overview.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const handleUpdate = () => load();
    window.addEventListener('waterpolo-data-updated', handleUpdate);
    return () => {
      active = false;
      window.removeEventListener('waterpolo-data-updated', handleUpdate);
    };
  }, [seasonId, teamId]);

  const filteredMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter((match) =>
      [match.name, match.opponentName, match.date].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [matches, query]);

  const totals = useMemo(
    () =>
      filteredMatches.reduce(
        (acc, match) => ({
          matches: acc.matches + 1,
          shots: acc.shots + match.shots,
          goals: acc.goals + match.goals,
          possessions: acc.possessions + match.possessions,
          passes: acc.passes + match.passes
        }),
        { matches: 0, shots: 0, goals: 0, possessions: 0, passes: 0 }
      ),
    [filteredMatches]
  );

  const createMatch = async () => {
    if (!creating.name.trim()) {
      setError('Match name is required.');
      return;
    }
    try {
      setSaving(true);
      const { data, error: insertError } = await supabase
        .from('matches')
        .insert({
          name: creating.name.trim(),
          date: creating.date || new Date().toISOString().slice(0, 10),
          opponent_name: creating.opponentName.trim(),
          season_id: seasonId,
          team_id: teamId,
          user_id: userId
        })
        .select('*')
        .single();
      if (insertError) throw insertError;
      setMatches((prev) => [
        {
          id: data.id,
          name: data.name,
          date: data.date,
          opponentName: data.opponent_name || '',
          shots: 0,
          shotGoals: 0,
          shotSaved: 0,
          shotMissed: 0,
          penalties: 0,
          events: 0,
          goals: 0,
          exclusions: 0,
          fouls: 0,
          turnoversWon: 0,
          turnoversLost: 0,
          possessions: 0,
          passes: 0
        },
        ...prev
      ]);
      setCreating({
        name: 'New match',
        opponentName: '',
        date: new Date().toISOString().slice(0, 10)
      });
      setError('');
      notifyDataUpdated();
    } catch {
      setError('Failed to create match.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (match) => {
    setEditingId(match.id);
    setEditForm({
      name: match.name || '',
      opponentName: match.opponentName || '',
      date: match.date || new Date().toISOString().slice(0, 10)
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editForm.name.trim()) {
      setError('Match name is required.');
      return;
    }
    try {
      setSaving(true);
      const { error: updateError } = await supabase
        .from('matches')
        .update({
          name: editForm.name.trim(),
          opponent_name: editForm.opponentName.trim(),
          date: editForm.date
        })
        .eq('id', editingId);
      if (updateError) throw updateError;
      setMatches((prev) =>
        prev.map((match) =>
          match.id === editingId
            ? {
                ...match,
                name: editForm.name.trim(),
                opponentName: editForm.opponentName.trim(),
                date: editForm.date
              }
            : match
        )
      );
      setEditingId('');
      setError('');
      notifyDataUpdated();
    } catch {
      setError('Failed to update match.');
    } finally {
      setSaving(false);
    }
  };

  const deleteMatch = async (matchId) => {
    if (!(await confirmAction('Delete this match and all linked data?'))) return;
    try {
      setSaving(true);
      const { error: deleteError } = await supabase.from('matches').delete().eq('id', matchId);
      if (deleteError) throw deleteError;
      setMatches((prev) => prev.filter((match) => match.id !== matchId));
      if (editingId === matchId) setEditingId('');
      setError('');
      toast('Match deleted.', 'success');
      notifyDataUpdated();
    } catch {
      setError('Failed to delete match.');
      toast('Failed to delete match.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-slate-700">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cyan-700">Matches</p>
          <h2 className="text-2xl font-semibold">Season Team Matches</h2>
          <p className="mt-1 text-sm text-slate-500">Overview of all matches for the current season and team.</p>
        </div>
        <input
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:w-72"
          placeholder="Search by match, opponent or date"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">Create match</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_160px_auto]">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={creating.name}
            onChange={(event) => setCreating((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Match name"
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={creating.opponentName}
            onChange={(event) => setCreating((prev) => ({ ...prev, opponentName: event.target.value }))}
            placeholder="Opponent"
          />
          <input
            type="date"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={creating.date}
            onChange={(event) => setCreating((prev) => ({ ...prev, date: event.target.value }))}
          />
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={createMatch}
            disabled={saving}
          >
            <span className="inline-flex items-center gap-2">
              <Plus size={14} />
              Create
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Matches</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{totals.matches}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Shots</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{totals.shots}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Goals (Scoring)</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{totals.goals}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Possessions</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{totals.possessions}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Passes</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{totals.passes}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Shots</th>
                <th className="px-4 py-3">Scoring Events</th>
                <th className="px-4 py-3">Possession</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMatches.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    No matches found.
                  </td>
                </tr>
              )}
              {filteredMatches.map((match) => (
                <tr key={match.id} className="border-t border-slate-100 text-slate-700">
                  <td className="px-4 py-3">
                    {editingId === match.id ? (
                      <div className="space-y-2">
                        <input
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                          value={editForm.name}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                        />
                        <input
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                          value={editForm.opponentName}
                          onChange={(event) =>
                            setEditForm((prev) => ({ ...prev, opponentName: event.target.value }))
                          }
                          placeholder="Opponent"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="font-semibold text-slate-900">{match.name || 'Match'}</div>
                        <div className="text-xs text-slate-500">
                          {match.opponentName ? `vs ${match.opponentName}` : 'No opponent set'}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {editingId === match.id ? (
                      <input
                        type="date"
                        className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        value={editForm.date}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, date: event.target.value }))}
                      />
                    ) : (
                      match.date || '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div>Total: {match.shots}</div>
                    <div>Goal: {match.shotGoals}</div>
                    <div>Saved: {match.shotSaved}</div>
                    <div>Miss: {match.shotMissed}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div>Total: {match.events}</div>
                    <div>Goals: {match.goals}</div>
                    <div>Exclusions: {match.exclusions}</div>
                    <div>Fouls: {match.fouls}</div>
                    <div>
                      Turnovers: {match.turnoversWon}/{match.turnoversLost} (won/lost)
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div>Possessions: {match.possessions}</div>
                    <div>Passes: {match.passes}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex items-center gap-2">
                      {editingId === match.id ? (
                        <>
                          <button
                            className="rounded-md bg-slate-900 px-2 py-1 font-semibold text-white disabled:opacity-50"
                            onClick={saveEdit}
                            disabled={saving}
                          >
                            Save
                          </button>
                          <button
                            className="rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-700"
                            onClick={() => setEditingId('')}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-700"
                            onClick={() => startEdit(match)}
                          >
                            Edit
                          </button>
                          <button
                            className="rounded-md border border-red-200 px-2 py-1 font-semibold text-red-600"
                            onClick={() => deleteMatch(match.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

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

const RosterView = ({ seasonId, teamId, userId, confirmAction, toast }) => {
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
    if (!(await confirmAction('Delete this player?'))) return;
    const { error: deleteError } = await supabase.from('roster').delete().eq('id', playerId);
    if (deleteError) {
      toast('Failed to delete player.', 'error');
      return;
    }
    setRoster(roster.filter((player) => player.id !== playerId));
    notifyDataUpdated();
    toast('Player deleted.', 'success');
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
      const { default: html2canvas } = await import('html2canvas');
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
                        <div className="absolute bottom-2 left-2 text-[10px] text-white/70">Penalty shots</div>
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
                      ? penaltyPosition(penaltyShots.findIndex((item) => item.id === shot.id), ZONES)
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
                      ? penaltyPosition(penaltyShots.findIndex((item) => item.id === shot.id), ZONES)
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
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: VIRIDIS[0], opacity: 0.7 }} />
                    Low
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: VIRIDIS[3], opacity: 0.7 }} />
                    Mid
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: VIRIDIS[7], opacity: 0.7 }} />
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
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-500">Matches</label>
                  <div className="flex items-center gap-2 text-[11px] font-semibold">
                    <button
                      className="text-slate-500 hover:text-slate-800"
                      onClick={() => setFilters((prev) => ({ ...prev, matches: matches.map((m) => m.info.id) }))}
                    >
                      Select all
                    </button>
                    <button
                      className="text-slate-500 hover:text-slate-800"
                      onClick={() => setFilters((prev) => ({ ...prev, matches: [] }))}
                    >
                      Clear
                    </button>
                  </div>
                </div>
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
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-500">Players</label>
                  <div className="flex items-center gap-2 text-[11px] font-semibold">
                    <button
                      className="text-slate-500 hover:text-slate-800"
                      onClick={() => setFilters((prev) => ({ ...prev, players: roster.map((p) => p.capNumber) }))}
                    >
                      Select all
                    </button>
                    <button
                      className="text-slate-500 hover:text-slate-800"
                      onClick={() => setFilters((prev) => ({ ...prev, players: [] }))}
                    >
                      Clear
                    </button>
                  </div>
                </div>
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
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-500">Outcome</label>
                  <div className="flex items-center gap-2 text-[11px] font-semibold">
                    <button
                      className="text-slate-500 hover:text-slate-800"
                      onClick={() =>
                        setFilters((prev) => ({ ...prev, results: ['raak', 'redding', 'mis'] }))
                      }
                    >
                      Select all
                    </button>
                    <button
                      className="text-slate-500 hover:text-slate-800"
                      onClick={() => setFilters((prev) => ({ ...prev, results: [] }))}
                    >
                      Clear
                    </button>
                  </div>
                </div>
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
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-500">Period</label>
                  <div className="flex items-center gap-2 text-[11px] font-semibold">
                    <button
                      className="text-slate-500 hover:text-slate-800"
                      onClick={() => setFilters((prev) => ({ ...prev, periods: [...PERIODS] }))}
                    >
                      Select all
                    </button>
                    <button
                      className="text-slate-500 hover:text-slate-800"
                      onClick={() => setFilters((prev) => ({ ...prev, periods: [] }))}
                    >
                      Clear
                    </button>
                  </div>
                </div>
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
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-500">Attack type</label>
                  <div className="flex items-center gap-2 text-[11px] font-semibold">
                    <button
                      className="text-slate-500 hover:text-slate-800"
                      onClick={() => setFilters((prev) => ({ ...prev, attackTypes: [...ATTACK_TYPES] }))}
                    >
                      Select all
                    </button>
                    <button
                      className="text-slate-500 hover:text-slate-800"
                      onClick={() => setFilters((prev) => ({ ...prev, attackTypes: [] }))}
                    >
                      Clear
                    </button>
                  </div>
                </div>
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
            <h3 className="text-sm font-semibold text-slate-700">Penalty shot stats</h3>
            <div className="mt-3 text-sm text-slate-600">
              {zone14Stats?.total ? (
                <div className="space-y-1">
                  <div>Total: {zone14Stats.total}</div>
                  <div>Goal: {zone14Stats.success}</div>
                  <div>Saved: {zone14Stats.save}</div>
                  <div>Miss: {zone14Stats.miss}</div>
                </div>
              ) : (
                <div>No penalty shots in selection.</div>
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

const ScoringView = ({ seasonId, teamId, userId, confirmAction, toast }) => {
  const [roster, setRoster] = useState([]);
  const [matches, setMatches] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentMatchId, setCurrentMatchId] = useState('');
  const [statsMatchId, setStatsMatchId] = useState('');
  const [editingEventId, setEditingEventId] = useState(null);
  const [form, setForm] = useState({
    type: 'goal',
    playerCap: '',
    period: '1',
    time: formatShotTime()
  });
  const [lastEventMeta, setLastEventMeta] = useState(() => ({
    period: '1',
    time: formatShotTime()
  }));

  useEffect(() => {
    if (!teamId) return;
    let active = true;
    const load = async () => {
      try {
        const payload = await loadTeamScoring(teamId);
        if (!active) return;
        const mappedRoster = payload.roster.map((player) => ({
          id: player.id,
          name: player.name,
          capNumber: player.cap_number
        }));
        setRoster(mappedRoster);
        setMatches(payload.matches || []);
        setEvents(
          (payload.events || []).map((evt) => ({
            id: evt.id,
            matchId: evt.match_id,
            type: evt.event_type,
            teamSide: evt.team_side,
            playerCap: evt.player_cap || '',
            period: evt.period,
            time: evt.time,
            createdAt: evt.created_at
          }))
        );
        setCurrentMatchId(payload.matches?.[0]?.id || '');
        setStatsMatchId('');
        setError('');
      } catch (e) {
        if (active) setError('Could not load scoring data.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [teamId]);

  const currentMatch = matches.find((match) => match.id === currentMatchId);

  const filteredEvents = useMemo(() => {
    if (!statsMatchId) return events;
    return events.filter((evt) => evt.matchId === statsMatchId);
  }, [events, statsMatchId]);

  const sortedEvents = useMemo(() => {
    const matchFiltered = currentMatchId
      ? filteredEvents.filter((evt) => evt.matchId === currentMatchId)
      : filteredEvents;
    return [...matchFiltered].sort((a, b) => {
      const periodDiff = (PERIOD_ORDER[b.period] || 0) - (PERIOD_ORDER[a.period] || 0);
      if (periodDiff !== 0) return periodDiff;
      return timeToSeconds(b.time) - timeToSeconds(a.time);
    });
  }, [filteredEvents, currentMatchId]);

  const stats = useMemo(() => {
    const totals = {
      goal: 0,
      exclusion: 0,
      foul: 0,
      turnover_won: 0,
      turnover_lost: 0,
      penalty: 0,
      timeout: 0
    };
    const playerStats = {};
    filteredEvents.forEach((evt) => {
      if (evt.type in totals) totals[evt.type] += 1;
      if (evt.playerCap) {
        if (!playerStats[evt.playerCap]) {
          playerStats[evt.playerCap] = {
            goals: 0,
            exclusions: 0,
            fouls: 0,
            turnoversWon: 0,
            turnoversLost: 0,
            penalties: 0
          };
        }
        if (evt.type === 'goal') playerStats[evt.playerCap].goals += 1;
        if (evt.type === 'exclusion') playerStats[evt.playerCap].exclusions += 1;
        if (evt.type === 'foul') playerStats[evt.playerCap].fouls += 1;
        if (evt.type === 'turnover_won') playerStats[evt.playerCap].turnoversWon += 1;
        if (evt.type === 'turnover_lost') playerStats[evt.playerCap].turnoversLost += 1;
        if (evt.type === 'penalty') playerStats[evt.playerCap].penalties += 1;
      }
    });
    const manUp = totals.exclusion ? ((totals.goal / totals.exclusion) * 100).toFixed(1) : '—';
    return { totals, playerStats, manUp };
  }, [filteredEvents]);

  const resetForm = (keepTime = true) => {
    setForm((prev) => ({
      ...prev,
      period: keepTime ? prev.period : lastEventMeta.period,
      time: keepTime ? prev.time : lastEventMeta.time,
      playerCap: prev.playerCap || roster[0]?.capNumber || ''
    }));
    setEditingEventId(null);
  };

  useEffect(() => {
    resetForm(true);
  }, [roster]);

  const saveEvent = async (eventType = form.type) => {
    if (!currentMatch) {
      setError('Create or select a match first.');
      return;
    }
    const requiresPlayer = SCORING_EVENTS.find((item) => item.key === eventType)?.player;
    if (requiresPlayer && !form.playerCap) {
      setError('Select a player.');
      return;
    }
    const payload = {
      user_id: userId,
      season_id: seasonId,
      team_id: teamId,
      match_id: currentMatch.id,
      event_type: eventType,
      team_side: 'for',
      player_cap: requiresPlayer ? form.playerCap : null,
      period: form.period,
      time: normalizeTime(form.time)
    };
    let data;
    if (editingEventId) {
      const { data: updated, error: updateError } = await supabase
        .from('scoring_events')
        .update(payload)
        .eq('id', editingEventId)
        .select('*')
        .single();
      if (updateError) {
        setError('Failed to update event.');
        return;
      }
      data = updated;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('scoring_events')
        .insert(payload)
        .select('*')
        .single();
      if (insertError) {
        setError('Failed to save event.');
        return;
      }
      data = inserted;
    }
    const nextEvent = {
      id: data.id,
      matchId: data.match_id,
      type: data.event_type,
      teamSide: data.team_side || 'for',
      playerCap: data.player_cap || '',
      period: data.period,
      time: data.time,
      createdAt: data.created_at
    };
    setEvents((prev) => {
      if (editingEventId) {
        return prev.map((evt) => (evt.id === editingEventId ? nextEvent : evt));
      }
      return [...prev, nextEvent];
    });
    setLastEventMeta({ period: form.period, time: normalizeTime(form.time) });
    setError('');
    setEditingEventId(null);
    notifyDataUpdated();
  };

  const deleteEvent = async (eventId) => {
    if (!(await confirmAction('Delete event?'))) return;
    const { error: deleteError } = await supabase.from('scoring_events').delete().eq('id', eventId);
    if (deleteError) {
      setError('Failed to delete event.');
      toast('Failed to delete event.', 'error');
      return;
    }
    setEvents((prev) => prev.filter((evt) => evt.id !== eventId));
    notifyDataUpdated();
    toast('Event deleted.', 'success');
  };

  const undoLastEvent = async () => {
    if (!currentMatchId) return;
    const matchEvents = events.filter((evt) => evt.matchId === currentMatchId);
    if (matchEvents.length === 0) return;
    const last = [...matchEvents].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    })[0];
    if (!last) return;
    if (!(await confirmAction('Undo last event?'))) return;
    await deleteEvent(last.id);
  };

  if (loading) {
    return <div className="p-10 text-slate-700">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-cyan-700">Scoring & Stats</p>
          <h2 className="text-2xl font-semibold">Match Events</h2>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500">Match</label>
                <select
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={currentMatchId}
                  onChange={(event) => setCurrentMatchId(event.target.value)}
                >
                  {matches.length === 0 && <option value="">No matches</option>}
                  {matches.map((match) => (
                    <option key={match.id} value={match.id}>
                      {match.name}
                      {match.opponent_name ? ` vs ${match.opponent_name}` : ''} · {match.date}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {matches.length === 0 && (
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                No matches found. Create one in the `Matches` tab.
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr]">
              <div>
                <label className="text-xs font-semibold text-slate-500">Players</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      form.playerCap === '' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                    onClick={() => setForm((prev) => ({ ...prev, playerCap: '' }))}
                  >
                    Team
                  </button>
                  {roster.map((player) => (
                    <button
                      key={player.id}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        form.playerCap === player.capNumber
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                      onClick={() => setForm((prev) => ({ ...prev, playerCap: player.capNumber }))}
                    >
                      #{player.capNumber}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Period</label>
                  <select
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={form.period}
                    onChange={(event) => setForm((prev) => ({ ...prev, period: event.target.value }))}
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
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="7"
                      className="w-16 rounded-lg border border-slate-200 px-3 py-2"
                      value={splitTimeParts(form.time).minutes}
                      onChange={(event) => {
                        const minutes = Math.min(7, Math.max(0, Number(event.target.value)));
                        const seconds = splitTimeParts(form.time).seconds;
                        setForm((prev) => ({ ...prev, time: `${minutes}:${String(seconds).padStart(2, '0')}` }));
                      }}
                    />
                    <span className="text-xs font-semibold text-slate-500">min</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      className="w-16 rounded-lg border border-slate-200 px-3 py-2"
                      value={splitTimeParts(form.time).seconds}
                      onChange={(event) => {
                        const minutes = splitTimeParts(form.time).minutes;
                        const seconds = Math.min(59, Math.max(0, Number(event.target.value)));
                        setForm((prev) => ({ ...prev, time: `${minutes}:${String(seconds).padStart(2, '0')}` }));
                      }}
                    />
                    <span className="text-xs font-semibold text-slate-500">sec</span>
                    <div className="w-full">
                      <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] font-semibold text-slate-600">
                        {['7:00', '6:00', '5:00', '4:00', '3:00', '2:00', '1:00'].map((preset) => (
                          <button
                            key={preset}
                            className="rounded-full border border-slate-200 px-2 py-1"
                            onClick={() => setForm((prev) => ({ ...prev, time: preset }))}
                          >
                            {preset}
                          </button>
                        ))}
                        <button
                          className="rounded-full border border-slate-200 px-2 py-1"
                          onClick={() => {
                            const total = Math.max(0, timeToSeconds(form.time) - 10);
                            const minutes = Math.floor(total / 60);
                            const seconds = total % 60;
                            setForm((prev) => ({ ...prev, time: `${minutes}:${String(seconds).padStart(2, '0')}` }));
                          }}
                        >
                          -10s
                        </button>
                        <button
                          className="rounded-full border border-slate-200 px-2 py-1"
                          onClick={() => {
                            const total = Math.min(7 * 60, timeToSeconds(form.time) + 10);
                            const minutes = Math.floor(total / 60);
                            const seconds = total % 60;
                            setForm((prev) => ({ ...prev, time: `${minutes}:${String(seconds).padStart(2, '0')}` }));
                          }}
                        >
                          +10s
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {SCORING_EVENTS.map((evt) => (
                <button
                  key={evt.key}
                  className={`rounded-full px-4 py-2 text-sm font-semibold text-white ${evt.color}`}
                  onClick={() => saveEvent(evt.key)}
                >
                  + {evt.label}
                </button>
              ))}
            </div>
            {editingEventId && (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                Editing event ·
                <button className="font-semibold text-slate-700" onClick={resetForm}>
                  Cancel edit
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-700">Event log</h3>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                onClick={undoLastEvent}
                disabled={!currentMatchId}
              >
                Undo last
              </button>
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              {sortedEvents.length === 0 && <div>No events logged yet.</div>}
              {sortedEvents.map((evt) => {
                const matchData = matches.find((match) => match.id === evt.matchId);
                const matchName = matchData?.name || 'Match';
                const matchOpponent = matchData?.opponent_name ? ` vs ${matchData.opponent_name}` : '';
                const playerLabel = evt.playerCap ? `#${evt.playerCap}` : 'Team';
                const typeLabel = SCORING_EVENTS.find((item) => item.key === evt.type)?.label || evt.type;
                return (
                  <div key={evt.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                    <div>
                      <div className="font-semibold text-slate-700">
                        {typeLabel} · {playerLabel}
                      </div>
                      <div className="text-xs text-slate-500">
                        {matchName}
                        {matchOpponent} · P{evt.period} · {evt.time}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <button
                        className="text-slate-500"
                        onClick={() => {
                          setEditingEventId(evt.id);
                          setForm({
                            type: evt.type,
                            playerCap: evt.playerCap,
                            period: evt.period,
                            time: evt.time
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button className="text-red-500" onClick={() => deleteEvent(evt.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Stats scope</h3>
            <label className="mt-3 block text-xs font-semibold text-slate-500">Match selection</label>
            <select
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={statsMatchId}
              onChange={(event) => setStatsMatchId(event.target.value)}
            >
              <option value="">All matches</option>
              {matches.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.name}
                  {match.opponent_name ? ` vs ${match.opponent_name}` : ''} · {match.date}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Team stats</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600">
              <div className="rounded-lg border border-slate-100 px-3 py-2">
                Goals <span className="font-semibold text-slate-900">{stats.totals.goal}</span>
              </div>
              <div className="rounded-lg border border-slate-100 px-3 py-2">
                Exclusions <span className="font-semibold text-slate-900">{stats.totals.exclusion}</span>
              </div>
              <div className="rounded-lg border border-slate-100 px-3 py-2">
                Fouls <span className="font-semibold text-slate-900">{stats.totals.foul}</span>
              </div>
              <div className="rounded-lg border border-slate-100 px-3 py-2">
                Turnovers won <span className="font-semibold text-slate-900">{stats.totals.turnover_won}</span>
              </div>
              <div className="rounded-lg border border-slate-100 px-3 py-2">
                Turnovers lost <span className="font-semibold text-slate-900">{stats.totals.turnover_lost}</span>
              </div>
              <div className="rounded-lg border border-slate-100 px-3 py-2">
                Penalties <span className="font-semibold text-slate-900">{stats.totals.penalty}</span>
              </div>
              <div className="rounded-lg border border-slate-100 px-3 py-2">
                Timeouts <span className="font-semibold text-slate-900">{stats.totals.timeout}</span>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Man-up conversion ≈ goals / exclusions.
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm text-slate-600">
              <div className="rounded-lg border border-slate-100 px-3 py-2">
                Man-up % <span className="font-semibold text-emerald-700">{stats.manUp}%</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Player stats</h3>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              {Object.keys(stats.playerStats).length === 0 && <div>No player events logged.</div>}
              {Object.entries(stats.playerStats).map(([cap, data]) => (
                <div key={cap} className="rounded-lg border border-slate-100 px-3 py-2">
                  <div className="font-semibold text-slate-700">#{cap}</div>
                  <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <span>Goals: {data.goals}</span>
                    <span>Exclusions: {data.exclusions}</span>
                    <span>Fouls: {data.fouls}</span>
                    <span>Won: {data.turnoversWon}</span>
                    <span>Lost: {data.turnoversLost}</span>
                    <span>Penalties: {data.penalties}</span>
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

const PossessionView = ({ seasonId, teamId, userId, confirmAction, toast }) => {
  const [roster, setRoster] = useState([]);
  const [matches, setMatches] = useState([]);
  const [possessions, setPossessions] = useState([]);
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentMatchId, setCurrentMatchId] = useState('');
  const [activePossessionId, setActivePossessionId] = useState('');
  const [passDraft, setPassDraft] = useState({
    fromPlayer: '',
    toPlayer: '',
    fromPos: null,
    toPos: null
  });
  const [playerPicker, setPlayerPicker] = useState(null);
  const [viewMode, setViewMode] = useState('field');
  const fieldRef = useRef(null);

  useEffect(() => {
    if (!teamId) return;
    let active = true;
    const load = async () => {
      try {
        const payload = await loadTeamPossessions(teamId);
        if (!active) return;
        const mappedRoster = payload.roster.map((player) => ({
          id: player.id,
          name: player.name,
          capNumber: player.cap_number
        }));
        setRoster(mappedRoster);
        setMatches(payload.matches || []);
        setPossessions(
          (payload.possessions || []).map((pos) => ({
            id: pos.id,
            matchId: pos.match_id,
            outcome: pos.outcome || null,
            createdAt: pos.created_at
          }))
        );
        setPasses(
          (payload.passes || []).map((pass) => ({
            id: pass.id,
            possessionId: pass.possession_id,
            matchId: pass.match_id,
            fromPlayer: pass.from_player_cap,
            toPlayer: pass.to_player_cap,
            fromX: Number(pass.from_x),
            fromY: Number(pass.from_y),
            toX: Number(pass.to_x),
            toY: Number(pass.to_y),
            sequence: pass.sequence
          }))
        );
        setCurrentMatchId(payload.matches?.[0]?.id || '');
        setError('');
      } catch (e) {
        if (active) setError('Could not load possession data.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [teamId]);

  const currentMatch = matches.find((match) => match.id === currentMatchId);

  const activePossession = possessions.find((pos) => pos.id === activePossessionId);

  const matchPossessions = possessions.filter((pos) => pos.matchId === currentMatchId);
  const activePasses = passes
    .filter((pass) => pass.possessionId === activePossessionId)
    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  const possessionLabelMap = useMemo(() => {
    const rows = [...matchPossessions].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    });
    const map = {};
    rows.forEach((pos, idx) => {
      map[pos.id] = `Possession ${idx + 1}`;
    });
    return map;
  }, [matchPossessions]);

  const handleFieldClick = (event) => {
    if (!activePossessionId) return;
    if (!fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    if (!passDraft.fromPos) {
      setPassDraft((prev) => ({ ...prev, fromPos: { x, y } }));
      setPlayerPicker('from');
    } else if (!passDraft.toPos) {
      setPassDraft((prev) => ({ ...prev, toPos: { x, y } }));
      setPlayerPicker('to');
    } else {
      setPassDraft({ fromPlayer: '', toPlayer: '', fromPos: { x, y }, toPos: null });
      setPlayerPicker('from');
    }
  };

  const startPossession = async () => {
    if (!currentMatch) {
      setError('Select a match first.');
      return;
    }
    const { data, error: insertError } = await supabase
      .from('possessions')
      .insert({
        user_id: userId,
        season_id: seasonId,
        team_id: teamId,
        match_id: currentMatch.id,
        outcome: null
      })
      .select('*')
      .single();
    if (insertError) {
      setError('Failed to start possession.');
      return;
    }
    const fresh = { id: data.id, matchId: data.match_id, outcome: data.outcome, createdAt: data.created_at };
    setPossessions((prev) => [...prev, fresh]);
    setActivePossessionId(fresh.id);
    setPassDraft({ fromPlayer: '', toPlayer: '', fromPos: null, toPos: null });
  };

  const endPossession = async (outcome) => {
    if (!activePossessionId) return;
    const { error: updateError } = await supabase
      .from('possessions')
      .update({ outcome })
      .eq('id', activePossessionId);
    if (updateError) {
      setError('Failed to end possession.');
      return;
    }
    setPossessions((prev) =>
      prev.map((pos) => (pos.id === activePossessionId ? { ...pos, outcome } : pos))
    );
    setActivePossessionId('');
  };

  const deletePossession = async (possessionId) => {
    if (!(await confirmAction('Delete this possession and its passes?'))) return;
    const { error: deleteError } = await supabase.from('possessions').delete().eq('id', possessionId);
    if (deleteError) {
      setError('Failed to delete possession.');
      toast('Failed to delete possession.', 'error');
      return;
    }
    setPossessions((prev) => prev.filter((pos) => pos.id !== possessionId));
    setPasses((prev) => prev.filter((pass) => pass.possessionId !== possessionId));
    if (activePossessionId === possessionId) {
      setActivePossessionId('');
      setPassDraft({ fromPlayer: '', toPlayer: '', fromPos: null, toPos: null });
    }
    notifyDataUpdated();
    toast('Possession deleted.', 'success');
  };

  const addPass = async (override = null) => {
    const draft = override || passDraft;
    if (!activePossessionId) {
      setError('Start a possession first.');
      return;
    }
    if (!draft.fromPlayer || !draft.toPlayer) {
      setError('Select from and to players.');
      return;
    }
    if (!draft.fromPos || !draft.toPos) {
      setError('Click start and end positions on the field.');
      return;
    }
    const sequence = activePasses.length + 1;
    const { data, error: insertError } = await supabase
      .from('passes')
      .insert({
        user_id: userId,
        season_id: seasonId,
        team_id: teamId,
        match_id: currentMatchId,
        possession_id: activePossessionId,
        from_player_cap: draft.fromPlayer,
        to_player_cap: draft.toPlayer,
        from_x: draft.fromPos.x,
        from_y: draft.fromPos.y,
        to_x: draft.toPos.x,
        to_y: draft.toPos.y,
        sequence
      })
      .select('*')
      .single();
    if (insertError) {
      setError('Failed to save pass.');
      return;
    }
    setPasses((prev) => [
      ...prev,
      {
        id: data.id,
        possessionId: data.possession_id,
        matchId: data.match_id,
        fromPlayer: data.from_player_cap,
        toPlayer: data.to_player_cap,
        fromX: Number(data.from_x),
        fromY: Number(data.from_y),
        toX: Number(data.to_x),
        toY: Number(data.to_y),
        sequence: data.sequence
      }
    ]);
    setPassDraft((prev) => ({
      ...prev,
      fromPos: null,
      toPos: null,
      fromPlayer: draft.toPlayer || prev.fromPlayer,
      toPlayer: ''
    }));
    setError('');
  };

  const deletePass = async (passId) => {
    const { error: deleteError } = await supabase.from('passes').delete().eq('id', passId);
    if (deleteError) {
      setError('Failed to delete pass.');
      return;
    }
    setPasses((prev) => prev.filter((pass) => pass.id !== passId));
  };

  const connectionStats = useMemo(() => {
    const counts = {};
    activePasses.forEach((pass) => {
      const key = `${pass.fromPlayer}->${pass.toPlayer}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([key, count]) => {
        const [from, to] = key.split('->');
        return { from, to, count };
      })
      .sort((a, b) => b.count - a.count);
  }, [activePasses]);

  if (loading) {
    return <div className="p-10 text-slate-700">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-cyan-700">Passing & Possession</p>
          <h2 className="text-2xl font-semibold">Possession Mapping</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
            onClick={() => setViewMode('field')}
          >
            Field
          </button>
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
            onClick={() => setViewMode('network')}
          >
            Network
          </button>
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
            onClick={() => setViewMode('replay')}
          >
            Replay
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500">Match</label>
                <select
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={currentMatchId}
                  onChange={(event) => setCurrentMatchId(event.target.value)}
                >
                  {matches.map((match) => (
                    <option key={match.id} value={match.id}>
                      {match.name}
                      {match.opponent_name ? ` vs ${match.opponent_name}` : ''} · {match.date}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
                onClick={startPossession}
              >
                <Plus size={14} />
                Start possession
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              Click to set start location → choose passer. Click again → choose receiver.
            </div>
            {activePossessionId && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">End possession:</span>
                {POSSESSION_OUTCOMES.map((outcome) => (
                  <button
                    key={outcome.key}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold"
                    onClick={() => endPossession(outcome.key)}
                  >
                    {outcome.label}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 flex items-center gap-2">
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
                onClick={() => setPassDraft({ fromPlayer: '', toPlayer: '', fromPos: null, toPos: null })}
              >
                Reset pass
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Possession field</h3>
            <div className="mt-4 flex justify-center">
              <div
                ref={fieldRef}
                onClick={handleFieldClick}
                className="relative h-[700px] w-full max-w-[720px] overflow-hidden rounded-2xl bg-gradient-to-b from-[#4aa3d6] via-[#2c7bb8] to-[#1f639a]"
              >
                <div className="absolute left-0 top-1/2 h-[2px] w-full bg-white/90" />
                <div className="absolute left-0 top-[24%] h-[2px] w-full bg-yellow-300/90" />
                <div className="absolute left-0 top-[20%] h-[2px] w-full bg-red-400/90" />
                <div className="absolute left-0 top-[76%] h-[2px] w-full bg-yellow-300/90" />
                <div className="absolute left-0 top-[80%] h-[2px] w-full bg-red-400/90" />

                <div className="absolute left-[26.67%] top-0 h-[8%] w-[46.66%] border-2 border-red-400/90" />
                <div className="absolute left-[26.67%] bottom-0 h-[8%] w-[46.66%] border-2 border-red-400/90" />

                <div className="absolute left-[40%] top-0 h-[4%] w-[20%] border-2 border-white bg-white/10" />
                <div className="absolute left-[40%] bottom-0 h-[4%] w-[20%] border-2 border-white bg-white/10" />

                {activePasses.map((pass) => (
                  <svg
                    key={pass.id}
                    className="absolute left-0 top-0 h-full w-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <marker
                        id={`arrow-${pass.id}`}
                        markerWidth="4"
                        markerHeight="4"
                        refX="3.5"
                        refY="2"
                        orient="auto"
                      >
                        <path d="M0,0 L4,2 L0,4 Z" fill="rgba(255,255,255,0.8)" />
                      </marker>
                    </defs>
                    <line
                      x1={pass.fromX}
                      y1={pass.fromY}
                      x2={pass.toX}
                      y2={pass.toY}
                      stroke="rgba(255,255,255,0.75)"
                      strokeWidth="0.6"
                      markerEnd={`url(#arrow-${pass.id})`}
                    />
                  </svg>
                ))}

                {activePasses.map((pass) => (
                  <div
                    key={`${pass.id}-seq`}
                    className="absolute flex h-4 w-4 items-center justify-center rounded-full bg-white/90 text-[9px] font-semibold text-slate-700"
                    style={{
                      left: `calc(${(pass.fromX + pass.toX) / 2}% - 8px)`,
                      top: `calc(${(pass.fromY + pass.toY) / 2}% - 8px)`
                    }}
                  >
                    {pass.sequence}
                  </div>
                ))}

                {activePasses.map((pass) => (
                  <div
                    key={`${pass.id}-from`}
                    className="absolute flex h-4 w-4 items-center justify-center rounded-full bg-white/80 text-[9px] font-semibold text-slate-700"
                    style={{
                      left: `calc(${pass.fromX}% - 8px)`,
                      top: `calc(${pass.fromY}% - 8px)`
                    }}
                  >
                    {pass.fromPlayer}
                  </div>
                ))}

                {activePasses.map((pass) => (
                  <div
                    key={`${pass.id}-to`}
                    className="absolute flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400/80 text-[9px] font-semibold text-white"
                    style={{
                      left: `calc(${pass.toX}% - 8px)`,
                      top: `calc(${pass.toY}% - 8px)`
                    }}
                  >
                    {pass.toPlayer}
                  </div>
                ))}

                {passDraft.fromPos && (
                  <div
                    className="absolute h-3 w-3 rounded-full bg-white/90"
                    style={{
                      left: `calc(${passDraft.fromPos.x}% - 6px)`,
                      top: `calc(${passDraft.fromPos.y}% - 6px)`
                    }}
                  />
                )}
                {passDraft.toPos && (
                  <div
                    className="absolute h-3 w-3 rounded-full bg-emerald-300/90"
                    style={{
                      left: `calc(${passDraft.toPos.x}% - 6px)`,
                      top: `calc(${passDraft.toPos.y}% - 6px)`
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Possessions</h3>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              {matchPossessions.length === 0 && <div>No possessions yet.</div>}
              {matchPossessions.map((pos) => (
                <div
                  key={pos.id}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                    pos.id === activePossessionId
                      ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                      : 'border-slate-100 text-slate-600'
                  }`}
                >
                  <button className="flex-1 text-left" onClick={() => setActivePossessionId(pos.id)}>
                    {possessionLabelMap[pos.id] || 'Possession'} ·{' '}
                    {pos.outcome ? pos.outcome.replace('_', ' ') : 'open'}
                  </button>
                  <button
                    className="text-xs font-semibold text-red-500"
                    onClick={() => deletePossession(pos.id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>

          {viewMode === 'network' && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Passing network</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {connectionStats.length === 0 && <div>No passes yet.</div>}
                {connectionStats.map((row) => (
                  <div key={`${row.from}-${row.to}`} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <span>
                      #{row.from} → #{row.to}
                    </span>
                    <span className="font-semibold">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'replay' && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Replay</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {activePasses.length === 0 && <div>No passes yet.</div>}
                {activePasses.map((pass) => (
                  <div key={pass.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                    <div>
                      <div className="font-semibold text-slate-700">
                        #{pass.fromPlayer} → #{pass.toPlayer}
                      </div>
                      <div className="text-xs text-slate-500">Pass {pass.sequence}</div>
                    </div>
                    <button
                      className="text-xs font-semibold text-red-500"
                      onClick={() => deletePass(pass.id)}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {playerPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">
                Choose {playerPicker === 'from' ? 'from' : 'to'} player
              </h3>
              <button className="text-xs font-semibold text-slate-500" onClick={() => setPlayerPicker(null)}>
                Close
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {roster.map((player) => (
                  <button
                    key={player.id}
                    className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                    onClick={() => {
                      if (playerPicker === 'from') {
                        setPassDraft((prev) => ({ ...prev, fromPlayer: player.capNumber }));
                        setPlayerPicker(null);
                      } else {
                        const nextDraft = { ...passDraft, toPlayer: player.capNumber };
                        setPassDraft(nextDraft);
                        setPlayerPicker(null);
                        addPass(nextDraft);
                      }
                    }}
                  >
                  #{player.capNumber} {player.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
