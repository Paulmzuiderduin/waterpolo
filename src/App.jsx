import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clapperboard,
  BarChart2,
  Users,
  IdCard,
  HelpCircle,
  Home,
  ClipboardList,
  TableProperties,
  Share2,
  CalendarDays,
  Settings2
} from 'lucide-react';
import { supabase } from './lib/supabase';
import AppHeader from './components/AppHeader';
import AppOverlays from './components/AppOverlays';
import AuthScreen from './components/AuthScreen';
import MobileNav from './components/MobileNav';
import SidebarNav from './components/SidebarNav';
import WorkspaceSetupScreen from './components/WorkspaceSetupScreen';
import { useAuthSession } from './hooks/useAuthSession';
import { useFeatureRequestDialog } from './hooks/useFeatureRequestDialog';
import { usePersistedUiState } from './hooks/usePersistedUiState';
import { useSeasonsTeams } from './hooks/useSeasonsTeams';
import { getSeoMetadata } from './seo/metadata';
import { useSeoMeta } from './seo/useSeoMeta';
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

const ScoringView = lazy(() => import('./modules/scoring/ScoringView'));
const PossessionView = lazy(() => import('./modules/possession/PossessionView'));
const MatchesView = lazy(() => import('./modules/matches/MatchesView'));
const ShotmapView = lazy(() => import('./modules/shotmap/ShotmapView'));
const AnalyticsView = lazy(() => import('./modules/analytics/AnalyticsView'));
const RosterView = lazy(() => import('./modules/roster/RosterView'));
const PlayersView = lazy(() => import('./modules/players/PlayersView'));
const HelpView = lazy(() => import('./modules/help/HelpView'));
const SettingsView = lazy(() => import('./modules/settings/SettingsView'));
const PrivacyView = lazy(() => import('./modules/privacy/PrivacyView'));
const HubView = lazy(() => import('./modules/hub/HubView'));
const VideoAnalysisView = lazy(() => import('./modules/video/VideoAnalysisView'));
const StatSheetView = lazy(() => import('./modules/statsheet/StatSheetView'));
const ChangelogView = lazy(() => import('./modules/changelog/ChangelogView'));

const App = () => {
  const isNativeScoringMode = false;
  const { session, authLoading } = useAuthSession();
  const { seasons, setSeasons, loadingSeasons } = useSeasonsTeams(session?.user?.id);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [seasonForm, setSeasonForm] = useState('');
  const [teamForm, setTeamForm] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [promptDialog, setPromptDialog] = useState(null);
  const [toasts, setToasts] = useState([]);

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
    () =>
      isNativeScoringMode
        ? [{ key: 'scoring', label: 'Live Scoring', icon: <ClipboardList size={16} />, alwaysVisible: true }]
        : [
            { key: 'hub', label: 'Dashboard', icon: <Home size={16} />, alwaysVisible: true },
            { key: 'matches', label: 'Matches', icon: <CalendarDays size={16} /> },
            { key: 'shotmap', label: 'Shotmap', icon: <Share2 size={16} /> },
            { key: 'analytics', label: 'Analytics', icon: <BarChart2 size={16} /> },
            { key: 'scoring', label: 'Scoring', icon: <ClipboardList size={16} /> },
            { key: 'statsheet', label: 'Stat Sheet', icon: <TableProperties size={16} /> },
            { key: 'players', label: 'Players', icon: <IdCard size={16} /> },
            { key: 'roster', label: 'Roster', icon: <Users size={16} /> },
            { key: 'video', label: 'Video', icon: <Clapperboard size={16} />, advanced: true },
            { key: 'possession', label: 'Possession', icon: <Share2 size={16} />, advanced: true },
            { key: 'help', label: 'Help', icon: <HelpCircle size={16} />, alwaysVisible: true },
            { key: 'changelog', label: 'Changelog', icon: <ClipboardList size={16} />, alwaysVisible: true },
            { key: 'settings', label: 'Settings', icon: <Settings2 size={16} />, alwaysVisible: true }
          ],
    [isNativeScoringMode]
  );

  const moduleShellCopy = useMemo(
    () => ({
      hub: 'Overview of the current workspace, quick access to modules, and operational guidance.',
      matches: 'Create, edit, and manage the match list for the selected season and team.',
      shotmap: 'Log shots on the field and review match or season shot distributions.',
      analytics: 'Review shot heatmaps, conversion patterns, and distance-based trends.',
      video: 'Work with local video snippets and drawings without uploading the source video.',
      scoring: 'Track match events for your team with a fast, live-friendly workflow.',
      statsheet: 'Review match and season stat tables derived from scoring events.',
      possession: 'Map possessions and pass sequences on the full-pool field view.',
      players: 'Review report cards and compare players across the selected data scope.',
      roster: 'Manage the shared team roster used across all waterpolo modules.',
      help: 'Getting started, legends, and common workflow questions.',
      changelog: 'Recent product updates, fixes, and module-level improvements.',
      settings: 'Adjust visible modules, advanced analysis access, and workspace preferences.'
    }),
    []
  );

  const {
    activeTab,
    setActiveTab,
    selectedSeasonId,
    setSelectedSeasonId,
    selectedTeamId,
    setSelectedTeamId,
    moduleVisibility,
    setModuleVisibility,
    preferences,
    setPreferences,
    sidebarCollapsed,
    setSidebarCollapsed,
    selectedSeason,
    selectedTeam,
    navItems,
    mobilePrimaryItems,
    mobileOverflowItems
  } = usePersistedUiState({
    sessionUser: session?.user,
    moduleConfig,
    seasons,
    loadingSeasons,
    defaultTab: isNativeScoringMode ? 'scoring' : 'hub'
  });

  const { featureRequestDialog, setFeatureRequestDialog, openFeatureRequestDialog, submitFeatureRequest, featureRequestContext } =
    useFeatureRequestDialog({
      sessionUser: session?.user,
      activeTab,
      moduleConfig,
      selectedSeason,
      selectedTeam,
      selectedSeasonId,
      selectedTeamId,
      toast
    });

  const seoMeta = useMemo(
    () =>
      getSeoMetadata({
        activeTab,
        isAuthenticated: Boolean(session?.user),
        selectedSeasonName: selectedSeason?.name || '',
        selectedTeamName: selectedTeam?.name || ''
      }),
    [activeTab, selectedSeason?.name, selectedTeam?.name, session?.user]
  );
  useSeoMeta(seoMeta);

  useEffect(() => {
    const isAutomation =
      typeof navigator !== 'undefined' && Boolean(navigator.webdriver);
    if (isNativeScoringMode || !session?.user || !selectedSeason || !selectedTeam) {
      setShowOnboarding(false);
      return;
    }
    if (isAutomation) {
      setShowOnboarding(false);
      return;
    }
    if (preferences.onboardingCompleted) {
      setShowOnboarding(false);
      return;
    }
    setShowOnboarding(true);
    if (activeTab !== 'help') setActiveTab('help');
  }, [
    isNativeScoringMode,
    session?.user,
    selectedSeason,
    selectedTeam,
    preferences.onboardingCompleted,
    activeTab,
    setActiveTab
  ]);

  const activeModule = moduleConfig.find((item) => item.key === activeTab) || moduleConfig[0];

  const handleMagicLink = async () => {
    if (!authEmail) return;
    setAuthMessage('Sending magic link...');
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail,
      options: { emailRedirectTo: redirectTo }
    });
    if (error) {
      setAuthMessage(`Failed to send link: ${error.message}`);
      return;
    }
    setAuthMessage('Check your inbox for the magic link.');
  };

  const handlePasswordSignIn = async () => {
    if (!authEmail || !authPassword) {
      setAuthMessage('Enter both email and password.');
      return;
    }
    setAuthMessage('Signing in...');
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword
    });
    if (error) {
      setAuthMessage(`Password sign-in failed: ${error.message}`);
      return;
    }
    setAuthMessage('');
  };

  const handlePasswordSignUp = async () => {
    if (!authEmail || !authPassword) {
      setAuthMessage('Enter both email and password.');
      return;
    }
    setAuthMessage('Creating account...');
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const { data, error } = await supabase.auth.signUp({
      email: authEmail.trim(),
      password: authPassword,
      options: {
        emailRedirectTo: redirectTo
      }
    });
    if (error) {
      setAuthMessage(`Account creation failed: ${error.message}`);
      return;
    }
    if (data?.session) {
      setAuthMessage('');
      return;
    }
    setAuthMessage('Account created. Check your inbox to confirm email before first sign-in.');
  };

  const handleGitHubSignIn = async () => {
    setAuthMessage('Opening GitHub sign-in...');
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo
      }
    });
    if (error) {
      setAuthMessage(`Failed to sign in with GitHub: ${error.message}`);
    }
  };

  const createSeason = async () => {
    if (!seasonForm.trim() || !session?.user) return;
    const { data, error } = await supabase
      .from('seasons')
      .insert({ name: seasonForm.trim(), user_id: session.user.id })
      .select('*')
      .single();
    if (error) {
      toast(`Failed to create season: ${error.message}`, 'error');
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
      toast(`Failed to create team: ${error.message}`, 'error');
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
    setSeasons((prev) =>
      prev.map((season) => (season.id === seasonId ? { ...season, name: trimmed } : season))
    );
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
    setSeasons((prev) =>
      prev.map((season) => {
        if (season.id !== seasonId) return season;
        const teams = (season.teams || []).map((team) =>
          team.id === teamId ? { ...team, name: trimmed } : team
        );
        return { ...season, teams };
      })
    );
    toast('Team renamed.', 'success');
  };

  const deleteTeam = async (seasonId, teamId) => {
    if (!(await confirmAction('Delete team? All data for this team will be removed.'))) return;
    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    if (error) {
      toast('Failed to delete team.', 'error');
      return;
    }
    setSeasons((prev) =>
      prev.map((season) => {
        if (season.id !== seasonId) return season;
        return { ...season, teams: (season.teams || []).filter((team) => team.id !== teamId) };
      })
    );
    if (selectedTeamId === teamId) {
      setSelectedTeamId('');
    }
    toast('Team deleted.', 'success');
  };

  const updateTeamQuarterLength = async (minutes) => {
    const value = Number(minutes);
    if (!selectedTeamId || ![5, 6, 7, 8].includes(value)) return;
    const { error } = await supabase
      .from('teams')
      .update({ quarter_length_minutes: value })
      .eq('id', selectedTeamId);
    if (error) {
      toast('Failed to update team quarter length. Run latest SQL migration first.', 'error');
      return;
    }
    setSeasons((prev) =>
      prev.map((season) => ({
        ...season,
        teams: (season.teams || []).map((team) =>
          team.id === selectedTeamId ? { ...team, quarter_length_minutes: value } : team
        )
      }))
    );
    toast(`Team quarter length set to ${value} minutes.`, 'success');
  };

  const overlays = (
    <AppOverlays
      confirmDialog={confirmDialog}
      setConfirmDialog={setConfirmDialog}
      promptDialog={promptDialog}
      setPromptDialog={setPromptDialog}
      featureRequestDialog={featureRequestDialog}
      setFeatureRequestDialog={setFeatureRequestDialog}
      featureRequestContext={featureRequestContext}
      submitFeatureRequest={submitFeatureRequest}
      toasts={toasts}
    />
  );

  const openAnalyticsPreferences = useCallback(() => {
    if (typeof window !== 'undefined' && typeof window.resetAnalyticsPreferences === 'function') {
      window.resetAnalyticsPreferences();
    }
  }, []);

  if (authLoading) {
    return <div className="p-10 text-slate-700">Loading...</div>;
  }

  if (!session?.user) {
    return (
      <AuthScreen
        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        authPassword={authPassword}
        setAuthPassword={setAuthPassword}
        authMessage={authMessage}
        onSignInWithGitHub={handleGitHubSignIn}
        onSendMagicLink={handleMagicLink}
        onSignInWithPassword={handlePasswordSignIn}
        onCreatePasswordAccount={handlePasswordSignUp}
        overlays={overlays}
      />
    );
  }

  if (loadingSeasons) {
    return <div className="p-10 text-slate-700">Loading...</div>;
  }

  if (!selectedSeason || !selectedTeam) {
    return (
      <WorkspaceSetupScreen
        seasons={seasons}
        selectedSeason={selectedSeason}
        selectedSeasonId={selectedSeasonId}
        selectedTeamId={selectedTeamId}
        setSelectedSeasonId={setSelectedSeasonId}
        setSelectedTeamId={setSelectedTeamId}
        seasonForm={seasonForm}
        setSeasonForm={setSeasonForm}
        teamForm={teamForm}
        setTeamForm={setTeamForm}
        createSeason={createSeason}
        createTeam={createTeam}
        promptAction={promptAction}
        renameSeason={renameSeason}
        deleteSeason={deleteSeason}
        renameTeam={renameTeam}
        deleteTeam={deleteTeam}
        openFeatureRequestDialog={openFeatureRequestDialog}
        setActiveTab={setActiveTab}
        overlays={overlays}
      />
    );
  }

  return (
    <div
      className={
        isNativeScoringMode
          ? 'min-h-screen'
          : `min-h-screen pb-20 transition-[padding] duration-200 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`
      }
    >
      {!isNativeScoringMode && (
        <SidebarNav
          selectedSeasonName={selectedSeason.name}
          navItems={navItems}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onSwitchTeam={() => {
            setSelectedSeasonId('');
            setSelectedTeamId('');
          }}
          onRequestFeature={openFeatureRequestDialog}
          onAnalyticsPreferences={openAnalyticsPreferences}
          onSignOut={() => supabase.auth.signOut()}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        />
      )}

      <AppHeader
        activeModuleLabel={activeModule?.label || 'Waterpolo Hub'}
        activeModuleDescription={moduleShellCopy[activeTab] || 'Waterpolo team workspace.'}
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
        onOpenWorkspace={
          isNativeScoringMode
            ? () => {
                setSelectedSeasonId('');
                setSelectedTeamId('');
              }
            : undefined
        }
        onSignOut={isNativeScoringMode ? () => supabase.auth.signOut() : undefined}
      />

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <Suspense fallback={<div className="p-10 text-slate-700">Loading module...</div>}>
          {isNativeScoringMode && (
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
              quarterLengthMinutes={Number(selectedTeam?.quarter_length_minutes) || 7}
              showTooltips={preferences.showStatTooltips}
              showInAppHints={preferences.showInAppHints}
              isAppMode
            />
          )}
          {!isNativeScoringMode && activeTab === 'hub' && (
            <HubView
              showTips={preferences.showHubTips}
              showTooltips={preferences.showStatTooltips}
              showBackupReminder={preferences.showBackupReminder}
              lastBackupAt={preferences.lastBackupAt}
            />
          )}
          {!isNativeScoringMode && activeTab === 'matches' && (
            <MatchesView
              seasonId={selectedSeasonId}
              teamId={selectedTeamId}
              userId={session.user.id}
              confirmAction={confirmAction}
              toast={toast}
              loadOverview={loadTeamMatchesOverview}
              onDataUpdated={notifyDataUpdated}
              showTooltips={preferences.showStatTooltips}
            />
          )}
          {!isNativeScoringMode && activeTab === 'shotmap' && (
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
              showTooltips={preferences.showStatTooltips}
              onOpenModule={setActiveTab}
            />
          )}
          {!isNativeScoringMode && activeTab === 'analytics' && (
            <AnalyticsView
              seasonId={selectedSeasonId}
              teamId={selectedTeamId}
              userId={session.user.id}
              loadData={loadTeamData}
              zones={ZONES}
              heatTypes={HEAT_TYPES}
              attackTypes={ATTACK_TYPES}
              periods={PERIODS}
              showTooltips={preferences.showStatTooltips}
              onOpenModule={setActiveTab}
            />
          )}
          {!isNativeScoringMode && activeTab === 'video' && (
            <VideoAnalysisView
              teamId={selectedTeamId}
              seasonId={selectedSeasonId}
              toast={toast}
              showTooltips={preferences.showStatTooltips}
            />
          )}
          {!isNativeScoringMode && activeTab === 'scoring' && (
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
              quarterLengthMinutes={Number(selectedTeam?.quarter_length_minutes) || 7}
              showTooltips={preferences.showStatTooltips}
              showInAppHints={preferences.showInAppHints}
              onOpenModule={setActiveTab}
              isAppMode={false}
            />
          )}
          {!isNativeScoringMode && activeTab === 'possession' && (
            <PossessionView
              seasonId={selectedSeasonId}
              teamId={selectedTeamId}
              userId={session.user.id}
              confirmAction={confirmAction}
              toast={toast}
              loadData={loadTeamPossessions}
              onDataUpdated={notifyDataUpdated}
              outcomes={POSSESSION_OUTCOMES}
              showTooltips={preferences.showStatTooltips}
              onOpenModule={setActiveTab}
            />
          )}
          {!isNativeScoringMode && activeTab === 'statsheet' && (
            <StatSheetView
              teamId={selectedTeamId}
              seasonId={selectedSeasonId}
              userId={session.user.id}
              loadData={loadTeamScoring}
              onOpenModule={setActiveTab}
              toast={toast}
            />
          )}
          {!isNativeScoringMode && activeTab === 'players' && (
            <PlayersView
              seasonId={selectedSeasonId}
              teamId={selectedTeamId}
              userId={session.user.id}
              seasons={seasons}
              onSelectSeason={setSelectedSeasonId}
              onSelectTeam={setSelectedTeamId}
              loadData={loadTeamData}
              showTooltips={preferences.showStatTooltips}
              showAdvancedMetrics={preferences.showAdvancedPlayerMetrics}
              onOpenModule={setActiveTab}
            />
          )}
          {!isNativeScoringMode && activeTab === 'roster' && (
            <RosterView
              seasonId={selectedSeasonId}
              teamId={selectedTeamId}
              userId={session.user.id}
              confirmAction={confirmAction}
              toast={toast}
              loadData={loadTeamData}
              onDataUpdated={notifyDataUpdated}
              showTooltips={preferences.showStatTooltips}
              onOpenModule={setActiveTab}
            />
          )}
          {!isNativeScoringMode && activeTab === 'help' && <HelpView showTooltips={preferences.showStatTooltips} />}
          {!isNativeScoringMode && activeTab === 'changelog' && <ChangelogView />}
          {!isNativeScoringMode && activeTab === 'settings' && (
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
              teamQuarterLength={Number(selectedTeam?.quarter_length_minutes) || 7}
              onUpdateTeamQuarterLength={updateTeamQuarterLength}
              teamId={selectedTeamId}
              seasonName={selectedSeason.name}
              teamName={selectedTeam.name}
              userId={session.user.id}
              loadTeamData={loadTeamData}
              loadTeamScoring={loadTeamScoring}
              loadTeamPossessions={loadTeamPossessions}
              toast={toast}
            />
          )}
          {!isNativeScoringMode && activeTab === 'privacy' && <PrivacyView />}
        </Suspense>
      </main>

      {!isNativeScoringMode && (
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
      )}

      {!isNativeScoringMode && (
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
          onRequestFeature={() => {
            setMobileMenuOpen(false);
            openFeatureRequestDialog();
          }}
          onOpenAnalyticsPreferences={() => {
            setMobileMenuOpen(false);
            openAnalyticsPreferences();
          }}
        />
      )}
      {showOnboarding && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">First-time setup</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">Welcome to Waterpolo Hub</h3>
            <p className="mt-2 text-sm text-slate-600">
              You are in <span className="font-semibold">{selectedSeason?.name}</span> /{' '}
              <span className="font-semibold">{selectedTeam?.name}</span>.  
              Start with this order for match day:
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
              <li>Add roster in `Roster`.</li>
              <li>Create match in `Matches`.</li>
              <li>Track live events in `Scoring`.</li>
              <li>Review in `Stat Sheet`, `Shotmap`, and `Analytics`.</li>
            </ol>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  setPreferences((prev) => ({ ...prev, onboardingCompleted: true }));
                  setShowOnboarding(false);
                  setActiveTab('matches');
                }}
              >
                Start in Matches
              </button>
              <button
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                onClick={() => {
                  setPreferences((prev) => ({ ...prev, onboardingCompleted: true }));
                  setShowOnboarding(false);
                  setActiveTab('help');
                }}
              >
                Open full help
              </button>
            </div>
          </div>
        </div>
      )}
      {overlays}
    </div>
  );
};

export default App;
