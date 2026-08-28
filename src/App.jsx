import React, { lazy, Suspense, useCallback, useState } from 'react';
import { supabase } from './lib/supabase';
import AppHeader from './components/AppHeader';
import AppOverlays from './components/AppOverlays';
import AuthScreen from './components/AuthScreen';
import WorkspaceSetupScreen from './components/WorkspaceSetupScreen';
import { useAuthSession } from './hooks/useAuthSession';
import { usePersistedUiState } from './hooks/usePersistedUiState';
import { useSeasonsTeams } from './hooks/useSeasonsTeams';
import { loadTeamData, notifyDataUpdated } from './lib/waterpolo/dataLoaders';
import { ATTACK_TYPES, PERIODS, RESULT_COLORS, ZONES } from './lib/waterpolo/constants';

const ShotmapView = lazy(() => import('./modules/shotmap/ShotmapView'));

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
  const [headerMatches, setHeaderMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [isManagingWorkspace, setIsManagingWorkspace] = useState(false);

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

  if (!selectedSeason || !selectedTeam || isManagingWorkspace) {
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
        onClose={selectedSeason && selectedTeam ? () => setIsManagingWorkspace(false) : undefined}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader
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
        matches={headerMatches}
        selectedMatchId={selectedMatchId}
        onSelectMatch={setSelectedMatchId}
        onSignOut={() => supabase.auth.signOut()}
        onOpenSetup={() => setIsManagingWorkspace(true)}
      />

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 sm:py-5">
        <Suspense fallback={<div className="p-10 text-slate-700">Loading module...</div>}>
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
            selectedMatchId={selectedMatchId}
            onSelectMatch={setSelectedMatchId}
            onMatchesChange={setHeaderMatches}
          />
        </Suspense>
      </main>
      {overlays}
    </div>
  );
};

export default App;
