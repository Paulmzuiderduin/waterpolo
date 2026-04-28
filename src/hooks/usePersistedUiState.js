import { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_PREFERENCES = {
  showHubTips: true,
  showStatTooltips: true,
  showAdvancedPlayerMetrics: false,
  showInAppHints: true,
  showBackupReminder: true,
  lastBackupAt: ''
};

export const usePersistedUiState = ({
  sessionUser,
  seasons,
  loadingSeasons
}) => {
  const [selectedSeasonId, setSelectedSeasonId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const didApplyWorkspaceSelection = useRef(false);

  useEffect(() => {
    if (!sessionUser) return;
    try {
      const raw = localStorage.getItem(`waterpolo_preferences_${sessionUser.id}`);
      const parsed = raw ? JSON.parse(raw) : {};
      setPreferences((prev) => ({
        ...prev,
        ...parsed,
        showInAppHints:
          parsed.showInAppHints != null ? parsed.showInAppHints : prev.showInAppHints,
        showAdvancedPlayerMetrics:
          parsed.showAdvancedPlayerMetrics != null
            ? parsed.showAdvancedPlayerMetrics
            : prev.showAdvancedPlayerMetrics,
        showStatTooltips: parsed.showStatTooltips != null ? parsed.showStatTooltips : prev.showStatTooltips
      }));
    } catch {
      setPreferences(DEFAULT_PREFERENCES);
    }
  }, [sessionUser]);

  useEffect(() => {
    if (!sessionUser) return;
    localStorage.setItem(`waterpolo_preferences_${sessionUser.id}`, JSON.stringify(preferences));
  }, [preferences, sessionUser]);

  useEffect(() => {
    if (!sessionUser) {
      didApplyWorkspaceSelection.current = false;
      return;
    }
    if (loadingSeasons || didApplyWorkspaceSelection.current) return;
    if (!seasons.length) return;

    const getFallbackSeason = () => {
      if (!seasons.length) return null;
      return seasons.find((season) => (season.teams || []).length > 0) || seasons[0];
    };

    try {
      const raw = localStorage.getItem(`waterpolo_workspace_${sessionUser.id}`);
      const parsed = raw ? JSON.parse(raw) : null;
      const storedSeasonId = parsed?.seasonId || '';
      const storedTeamId = parsed?.teamId || '';
      const matchedSeason = seasons.find((season) => season.id === storedSeasonId) || getFallbackSeason();
      const matchedTeam =
        matchedSeason?.teams?.find((team) => team.id === storedTeamId) || matchedSeason?.teams?.[0];

      setSelectedSeasonId(matchedSeason?.id || '');
      setSelectedTeamId(matchedTeam?.id || '');
    } catch {
      const fallbackSeason = getFallbackSeason();
      setSelectedSeasonId(fallbackSeason?.id || '');
      setSelectedTeamId(fallbackSeason?.teams?.[0]?.id || '');
    }

    didApplyWorkspaceSelection.current = true;
  }, [loadingSeasons, seasons, sessionUser]);

  useEffect(() => {
    if (!sessionUser || !didApplyWorkspaceSelection.current) return;
    if (!selectedSeasonId || !selectedTeamId) return;
    localStorage.setItem(
      `waterpolo_workspace_${sessionUser.id}`,
      JSON.stringify({
        seasonId: selectedSeasonId || '',
        teamId: selectedTeamId || ''
      })
    );
  }, [selectedSeasonId, selectedTeamId, sessionUser]);

  const selectedSeason = useMemo(
    () => seasons.find((season) => season.id === selectedSeasonId),
    [seasons, selectedSeasonId]
  );
  const selectedTeam = useMemo(
    () => selectedSeason?.teams?.find((team) => team.id === selectedTeamId),
    [selectedSeason, selectedTeamId]
  );

  useEffect(() => {
    if (!selectedSeason && selectedSeasonId) {
      setSelectedSeasonId('');
      setSelectedTeamId('');
    }
  }, [selectedSeason, selectedSeasonId, selectedTeam, selectedTeamId]);

  return {
    selectedSeasonId,
    setSelectedSeasonId,
    selectedTeamId,
    setSelectedTeamId,
    preferences,
    setPreferences,
    selectedSeason,
    selectedTeam
  };
};
