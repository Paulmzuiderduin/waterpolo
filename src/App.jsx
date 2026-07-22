import React, { lazy, Suspense, useCallback, useState } from 'react';
import { supabase } from './lib/supabase';
import AppHeader from './components/AppHeader';
import AppOverlays from './components/AppOverlays';
import AuthScreen from './components/AuthScreen';
import WorkspaceSetupScreen from './components/WorkspaceSetupScreen';
import { useAuthSession } from './hooks/useAuthSession';
import { usePersistedUiState } from './hooks/usePersistedUiState';
import { useSeasonsTeams } from './hooks/useSeasonsTeams';
import { loadTeamData, loadTeamMatchesOverview, loadTeamScoring, notifyDataUpdated } from './lib/waterpolo/dataLoaders';
import { ATTACK_TYPES, PERIOD_ORDER, PERIODS, RESULT_COLORS, ZONES } from './lib/waterpolo/constants';

const MatchesView = lazy(() => import('./modules/matches/MatchesView'));
const RosterView = lazy(() => import('./modules/roster/RosterView'));
const ScoringView = lazy(() => import('./modules/scoring/ScoringView'));
const ShotmapView = lazy(() => import('./modules/shotmap/ShotmapView'));
const StatSheetView = lazy(() => import('./modules/statsheet/StatSheetView'));

const MODULES = {
  matches: {
    label: 'Matches',
    description: 'Create and manage matches and lineups for the selected team.'
  },
  roster: {
    label: 'Roster',
    description: 'Manage players, cap numbers, and team roster profiles.'
  },
  scoring: {
    label: 'Live Scoring',
    description: 'Record live match events, goals, and fouls.'
  },
  shotmap: {
    label: 'Shotmap',
    description: 'Review shot locations and outcomes for the selected team.'
  },
  statsheet: {
    label: 'Stat Sheet',
    description: 'Generate season or match stat sheets from scoring and shot data.'
  }
};

const App = () => {
  const { session, authLoading } = useAuthSession();
  const { seasons, setSeasons, loadingSeasons } = useSeasonsTeams(session?.user?.id);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [seasonForm, setSeasonForm] = useState('');
  const [teamForm, setTeamForm] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [promptDialog, setPromptDialog] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [activeModule, setActiveModule] = useState('scoring');

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

  const {
    selectedSeasonId,
    setSelectedSeasonId,
    selectedTeamId,
    setSelectedTeamId,
    preferences,
    selectedSeason,
    selectedTeam
  } = usePersistedUiState({
    sessionUser: session?.user,
    seasons,
    loadingSeasons
  });

  const handleMagicLink = async () => {
    if (!authEmail) return;
    setAuthMessage('Sending magic link...');
    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail,
      options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` }
    });
    setAuthMessage(error ? `Failed to send link: ${error.message}` : 'Check your inbox for the magic link.');
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
    setAuthMessage(error ? `Password sign-in failed: ${error.message}` : '');
  };

  const handlePasswordSignUp = async () => {
    if (!authEmail || !authPassword) {
      setAuthMessage('Enter both email and password.');
      return;
    }
    setAuthMessage('Creating account...');
    const { error } = await supabase.auth.signUp({
      email: authEmail.trim(),
      password: authPassword,
      options: {
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`
      }
    });
    setAuthMessage(error ? `Sign-up failed: ${error.message}` : 'Check your inbox for the confirmation email.');
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
    setSeasons((prev) => [...prev, { id: data.id, name: data.name, teams: [] }]);
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
    setSeasons((prev) =>
      prev.map((season) =>
        season.id === selectedSeason.id
          ? { ...season, teams: [...(season.teams || []), data] }
          : season
      )
    );
    setTeamForm('');
    setSelectedTeamId(data.id);
    toast('Team created.', 'success');
  };

  const renameSeason = async (seasonId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase.from('seasons').update({ name: trimmed }).eq('id', seasonId);
    if (!error) {
      setSeasons((prev) =>
        prev.map((season) => (season.id === seasonId ? { ...season, name: trimmed } : season))
      );
      toast('Season renamed.', 'success');
    }
  };

  const deleteSeason = async (seasonId) => {
    if (!(await confirmAction('Delete season? All teams and data will be removed.'))) return;
    const { error } = await supabase.from('seasons').delete().eq('id', seasonId);
    if (error) {
      toast('Failed to delete season.', 'error');
      return;
    }
    setSeasons((prev) => prev.filter((season) => season.id !== seasonId));
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
    if (!error) {
      setSeasons((prev) =>
        prev.map((season) => {
          if (season.id !== seasonId) return season;
          return {
            ...season,
            teams: (season.teams || []).map((team) =>
              team.id === teamId ? { ...team, name: trimmed } : team
            )
          };
        })
      );
      toast('Team renamed.', 'success');
    }
  };

  const deleteTeam = async (seasonId, teamId) => {
    if (!(await confirmAction('Delete team? All data for this team will be removed.'))) return;
    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    if (error) {
      toast('Failed to delete team.', 'error');
      return;
    }
    setSeasons((prev) =>
      prev.map((season) =>
        season.id !== seasonId
          ? season
          : { ...season, teams: (season.teams || []).filter((team) => team.id !== teamId) }
      )
    );
    if (selectedTeamId === teamId) setSelectedTeamId('');
    toast('Team deleted.', 'success');
  };

  const overlays = (
    <AppOverlays
      confirmDialog={confirmDialog}
      setConfirmDialog={setConfirmDialog}
      promptDialog={promptDialog}
      setPromptDialog={setPromptDialog}
      toasts={toasts}
    />
  );

  if (authLoading) return <div className="p-10 text-slate-700">Loading...</div>;

  if (!session?.user) {
    return (
      <AuthScreen
        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        authPassword={authPassword}
        setAuthPassword={setAuthPassword}
        authMessage={authMessage}
        onSendMagicLink={handleMagicLink}
        onPasswordSignIn={handlePasswordSignIn}
        onPasswordSignUp={handlePasswordSignUp}
        overlays={overlays}
      />
    );
  }

  if (loadingSeasons) return <div className="p-10 text-slate-700">Loading...</div>;

  const activeModuleConfig = MODULES[activeModule] || MODULES.scoring;

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
        overlays={overlays}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader
        activeModuleLabel={activeModuleConfig.label}
        activeModuleDescription={activeModuleConfig.description}
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
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        onSignOut={() => supabase.auth.signOut()}
      />

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <Suspense fallback={<div className="p-10 text-slate-700">Loading module...</div>}>
          {activeModule === 'matches' ? (
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
          ) : activeModule === 'roster' ? (
            <RosterView
              seasonId={selectedSeasonId}
              teamId={selectedTeamId}
              userId={session.user.id}
              confirmAction={confirmAction}
              toast={toast}
              loadData={loadTeamData}
              onDataUpdated={notifyDataUpdated}
              showTooltips={preferences.showStatTooltips}
              onOpenModule={setActiveModule}
            />
          ) : activeModule === 'scoring' ? (
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
              showTooltips={preferences.showStatTooltips}
              showInAppHints={preferences.showInAppHints}
              onOpenModule={setActiveModule}
            />
          ) : activeModule === 'shotmap' ? (
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
              onOpenModule={setActiveModule}
            />
          ) : (
            <StatSheetView
              seasonId={selectedSeasonId}
              teamId={selectedTeamId}
              userId={session.user.id}
              loadData={loadTeamData}
              onOpenModule={setActiveModule}
              toast={toast}
            />
          )}
        </Suspense>
      </main>
      {overlays}
    </div>
  );
};

export default App;
