import { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_PREFERENCES = {
  rememberLastTab: true,
  showHubTips: true,
  showStatTooltips: true,
  showAdvancedModules: false
};

export const usePersistedUiState = ({ sessionUser, moduleConfig, seasons, loadingSeasons }) => {
  const [activeTab, setActiveTab] = useState('hub');
  const [selectedSeasonId, setSelectedSeasonId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [moduleVisibility, setModuleVisibility] = useState({});
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const didApplyStartTab = useRef(false);
  const didApplyWorkspaceSelection = useRef(false);

  useEffect(() => {
    if (!sessionUser) return;
    const defaults = moduleConfig.reduce((acc, item) => {
      if (!item.alwaysVisible) acc[item.key] = true;
      return acc;
    }, {});

    try {
      const raw = localStorage.getItem(`waterpolo_module_visibility_${sessionUser.id}`);
      const parsed = raw ? JSON.parse(raw) : {};
      setModuleVisibility({ ...defaults, ...parsed });
    } catch {
      setModuleVisibility(defaults);
    }
  }, [moduleConfig, sessionUser]);

  useEffect(() => {
    if (!sessionUser) return;
    localStorage.setItem(
      `waterpolo_module_visibility_${sessionUser.id}`,
      JSON.stringify(moduleVisibility)
    );
  }, [moduleVisibility, sessionUser]);

  useEffect(() => {
    if (!sessionUser) return;
    try {
      const raw = localStorage.getItem(`waterpolo_preferences_${sessionUser.id}`);
      const parsed = raw ? JSON.parse(raw) : {};
      setPreferences((prev) => ({
        ...prev,
        ...parsed,
        showStatTooltips:
          parsed.showStatTooltips != null
            ? parsed.showStatTooltips
            : parsed.showHelpTooltips ?? prev.showStatTooltips
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

  const navItems = useMemo(
    () =>
      moduleConfig.filter((item) => {
        if (item.advanced && !preferences.showAdvancedModules) return false;
        return item.alwaysVisible || moduleVisibility[item.key] !== false;
      }),
    [moduleConfig, moduleVisibility, preferences.showAdvancedModules]
  );

  useEffect(() => {
    const visibleKeys = new Set([...navItems.map((item) => item.key), 'privacy']);
    if (!visibleKeys.has(activeTab)) setActiveTab('hub');
  }, [activeTab, navItems]);

  useEffect(() => {
    if (!sessionUser || !preferences.rememberLastTab || didApplyStartTab.current) return;
    if (!selectedSeason || !selectedTeam) return;
    const last = localStorage.getItem(`waterpolo_last_tab_${sessionUser.id}`);
    if (last && navItems.some((item) => item.key === last)) {
      setActiveTab(last);
    }
    didApplyStartTab.current = true;
  }, [navItems, preferences.rememberLastTab, selectedSeason, selectedTeam, sessionUser]);

  useEffect(() => {
    if (!sessionUser || !preferences.rememberLastTab || !didApplyStartTab.current) return;
    localStorage.setItem(`waterpolo_last_tab_${sessionUser.id}`, activeTab);
  }, [activeTab, preferences.rememberLastTab, sessionUser]);

  useEffect(() => {
    if (!selectedSeason && selectedSeasonId) {
      setSelectedSeasonId('');
      setSelectedTeamId('');
      return;
    }
    if (selectedSeason && !selectedTeam) {
      setSelectedTeamId(selectedSeason.teams?.[0]?.id || '');
    }
  }, [selectedSeason, selectedSeasonId, selectedTeam, selectedTeamId]);

  const sidebarStorageKey = sessionUser
    ? `waterpolo_sidebar_collapsed_${sessionUser.id}`
    : 'waterpolo_sidebar_collapsed';

  useEffect(() => {
    if (!sessionUser) return;
    try {
      const raw = localStorage.getItem(sidebarStorageKey);
      setSidebarCollapsed(raw === '1');
    } catch {
      setSidebarCollapsed(false);
    }
  }, [sessionUser, sidebarStorageKey]);

  useEffect(() => {
    if (!sessionUser) return;
    localStorage.setItem(sidebarStorageKey, sidebarCollapsed ? '1' : '0');
  }, [sessionUser, sidebarCollapsed, sidebarStorageKey]);

  const mobilePrimaryKeys = ['hub', 'matches', 'shotmap', 'analytics'];
  const mobilePrimaryItems = navItems.filter((item) => mobilePrimaryKeys.includes(item.key));
  const mobileOverflowItems = navItems.filter((item) => !mobilePrimaryKeys.includes(item.key));

  return {
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
  };
};
