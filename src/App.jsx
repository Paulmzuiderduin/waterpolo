import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import ScoringView from './modules/scoring/ScoringView';
import PossessionView from './modules/possession/PossessionView';
import MatchesView from './modules/matches/MatchesView';
import ShotmapView from './modules/shotmap/ShotmapView';
import AnalyticsView from './modules/analytics/AnalyticsView';
import RosterView from './modules/roster/RosterView';
import PlayersView from './modules/players/PlayersView';
import HelpView from './modules/help/HelpView';
import SettingsView from './modules/settings/SettingsView';
import PrivacyView from './modules/privacy/PrivacyView';
import HubView from './modules/hub/HubView';
import { useAuthSession } from './hooks/useAuthSession';
import { useSeasonsTeams } from './hooks/useSeasonsTeams';

import {
  ATTACK_TYPES,
  HEAT_TYPES,
  PERIOD_ORDER,
  PERIODS,
  POSSESSION_OUTCOMES,
  RESULT_COLORS,
  ZONES
} from './lib/waterpolo/constants';
import {
  loadTeamData,
  loadTeamMatchesOverview,
  loadTeamPossessions,
  loadTeamScoring,
  notifyDataUpdated
} from './lib/waterpolo/dataLoaders';
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
            <div className="flex items-center gap-4">
              <a
                className="font-semibold text-cyan-700 underline decoration-transparent transition hover:decoration-current"
                href="https://mail.google.com/mail/?view=cm&fs=1&to=info@paulzuiderduin.com&su=Waterpolo%20Feature%20Request"
              >
                Request Feature
              </a>
              <button
                className="font-semibold text-slate-700 underline decoration-transparent transition hover:decoration-current"
                onClick={() => setActiveTab('privacy')}
              >
                Privacy
              </button>
            </div>
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
            loadOverview={loadTeamMatchesOverview}
            onDataUpdated={notifyDataUpdated}
          />
        )}
        {activeTab === 'shotmap' && (
          <ShotmapView
            seasonId={selectedSeasonId}
            teamId={selectedTeamId}
            userId={session.user.id}
            confirmAction={confirmAction}
            toast={toast}
            loadData={loadTeamData}
            onDataUpdated={notifyDataUpdated}
            periods={PERIODS}
            attackTypes={ATTACK_TYPES}
            zones={ZONES}
            resultColors={RESULT_COLORS}
          />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsView
            seasonId={selectedSeasonId}
            teamId={selectedTeamId}
            userId={session.user.id}
            loadData={loadTeamData}
            zones={ZONES}
            heatTypes={HEAT_TYPES}
            attackTypes={ATTACK_TYPES}
            periods={PERIODS}
          />
        )}
        {activeTab === 'scoring' && (
          <ScoringView
            seasonId={selectedSeasonId}
            teamId={selectedTeamId}
            userId={session.user.id}
            confirmAction={confirmAction}
            toast={toast}
            loadData={loadTeamScoring}
            onDataUpdated={notifyDataUpdated}
            periods={PERIODS}
            periodOrder={PERIOD_ORDER}
          />
        )}
        {activeTab === 'possession' && (
          <PossessionView
            seasonId={selectedSeasonId}
            teamId={selectedTeamId}
            userId={session.user.id}
            confirmAction={confirmAction}
            toast={toast}
            loadData={loadTeamPossessions}
            onDataUpdated={notifyDataUpdated}
            outcomes={POSSESSION_OUTCOMES}
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
            loadData={loadTeamData}
          />
        )}
        {activeTab === 'roster' && (
          <RosterView
            seasonId={selectedSeasonId}
            teamId={selectedTeamId}
            userId={session.user.id}
            confirmAction={confirmAction}
            toast={toast}
            loadData={loadTeamData}
            onDataUpdated={notifyDataUpdated}
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
          <div className="flex items-center gap-4">
            <a
              className="font-semibold text-cyan-700 underline decoration-transparent transition hover:decoration-current"
              href="https://mail.google.com/mail/?view=cm&fs=1&to=info@paulzuiderduin.com&su=Waterpolo%20Feature%20Request"
            >
              Request Feature
            </a>
            <button
              className="font-semibold text-slate-700 underline decoration-transparent transition hover:decoration-current"
              onClick={() => setActiveTab('privacy')}
            >
              Privacy Policy
            </button>
          </div>
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


export default App;
