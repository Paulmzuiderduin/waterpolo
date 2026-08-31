import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Maximize2, Minimize2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { loadTeamLineups, saveMatchLineup } from '../../lib/waterpolo/dataLoaders';
import { detectZone, penaltyPosition } from '../../utils/field';
import { formatShotTime, normalizeTime, splitTimeParts, timeToSeconds } from '../../utils/time';
import ModuleEmptyState from '../../components/ModuleEmptyState';
import ModuleHeader from '../../components/ModuleHeader';
import StatTooltipLabel from '../../components/StatTooltipLabel';
import ToolbarButton from '../../components/ToolbarButton';

const SHOTMAP_TOOLTIPS = {
  matchMode: 'Track and edit shots for one selected match.',
  seasonMode: 'View and filter shots across multiple matches in the selected team scope.',
  interactiveField:
    'Click on the field to create a shot draft. Zone 14 is reserved for penalties via the + Penalty button.',
  result: 'Shot outcome: Goal (scored), Saved (keeper save), or Miss.',
  attackType: 'Situation at time of shot: even strength, powerplay, or penalty.',
  period: 'Quarter number in the match timeline.',
  playClock: 'Remaining time in the period, counting down from a maximum of 7:00.',
  shotsList: 'Sorted by period, then by descending clock time within each period.'
};

const ShotmapView = ({
  seasonId,
  teamId,
  userId,
  confirmAction,
  toast,
  loadData,
  onDataUpdated,
  periods,
  attackTypes,
  zones,
  resultColors,
  showTooltips = true,
  selectedMatchId,
  onSelectMatch,
  onMatchesChange
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roster, setRoster] = useState([]);
  const [matches, setMatches] = useState([]);
  const [lineups, setLineups] = useState([]);
  const [currentMatchId, setCurrentMatchId] = useState('');
  const [pendingShot, setPendingShot] = useState(null);
  const [editingShotId, setEditingShotId] = useState(null);
  const [seasonMode, setSeasonMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showExports, setShowExports] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [liveMode, setLiveMode] = useState(false);
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);
  const [setupPanel, setSetupPanel] = useState('');
  const [setupSaving, setSetupSaving] = useState(false);
  const [newMatch, setNewMatch] = useState({ name: '', opponentName: '', date: new Date().toISOString().slice(0, 10) });
  const [newPlayer, setNewPlayer] = useState({ name: '', capNumber: '' });
  const [lineupSelection, setLineupSelection] = useState({});
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
  const liveModeContainerRef = useRef(null);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreenActive(Boolean(document.fullscreenElement || document.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!liveMode) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setLiveMode(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [liveMode]);

  useEffect(() => {
    if (!teamId) return;
    let active = true;
    const loadAll = async () => {
      try {
        setLoading(true);
        const [payload, lineupPayload] = await Promise.all([loadData(teamId), loadTeamLineups(teamId)]);
        if (!active) return;
        const mappedRoster = payload.roster.map((player) => ({
          id: player.id,
          playerId: player.player_id || player.id,
          name: player.name,
          capNumber: player.cap_number
        }));
        setRoster(mappedRoster);
        setMatches(payload.matches);
        setLineups(lineupPayload.lineups || []);
        const sortedPayloadMatches = [...payload.matches].sort((a, b) => {
          const ad = a.info?.date ? new Date(a.info.date).getTime() : 0;
          const bd = b.info?.date ? new Date(b.info.date).getTime() : 0;
          return bd - ad;
        });
        setCurrentMatchId(selectedMatchId || sortedPayloadMatches[0]?.info?.id || '');
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

  const sortedMatches = useMemo(() => {
    const readDate = (match) => {
      const raw = match.info?.date || '';
      const stamp = raw ? new Date(raw).getTime() : 0;
      return Number.isNaN(stamp) ? 0 : stamp;
    };
    return [...matches].sort((a, b) => readDate(b) - readDate(a));
  }, [matches]);

  const currentMatch = useMemo(
    () => matches.find((match) => match.info.id === currentMatchId) || matches[0],
    [matches, currentMatchId]
  );

  const activeLineup = useMemo(() => {
    if (!currentMatch) return [];
    const selectedCaps = new Set(
      lineups
        .filter((row) => row.match_id === currentMatch.info.id && (row.status || 'playing') === 'playing')
        .map((row) => row.cap_number)
    );
    // Historic matches without lineup rows retain access to the existing team roster.
    return selectedCaps.size ? roster.filter((player) => selectedCaps.has(player.capNumber)) : roster;
  }, [currentMatch, lineups, roster]);

  const liveScore = useMemo(() => {
    if (!currentMatch) return { team: 0, opponent: 0 };
    const goals = (currentMatch.shots || []).filter((shot) => shot.result === 'raak').length;
    return {
      team: goals + Number(currentMatch.info.teamScoreAdjustment || 0),
      opponent: Number(currentMatch.info.opponentScore || 0)
    };
  }, [currentMatch]);

  const toggleLiveMode = async () => {
    if (liveMode) {
      setLiveMode(false);
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        try {
          if (document.exitFullscreen) await document.exitFullscreen();
          else document.webkitExitFullscreen?.();
        } catch {
          // The in-app fallback has already exited, so a browser refusal is harmless.
        }
      }
      return;
    }

    setSeasonMode(false);
    setLiveMode(true);
    window.setTimeout(async () => {
      const element = liveModeContainerRef.current;
      try {
        if (element?.requestFullscreen) await element.requestFullscreen();
        else if (element?.webkitRequestFullscreen) element.webkitRequestFullscreen();
      } catch {
        // iOS Safari does not support arbitrary-element fullscreen; use the full-viewport layout.
      }
    }, 0);
  };

  const scoreStateLabel = (shot) => {
    if (shot.scoreFor == null || shot.scoreAgainst == null) return 'Not recorded';
    if (Number(shot.scoreFor) > Number(shot.scoreAgainst)) return 'Leading';
    if (Number(shot.scoreFor) < Number(shot.scoreAgainst)) return 'Trailing';
    return 'Tied';
  };

  useEffect(() => {
    if (!currentMatch) return;
    setCurrentMatchId(currentMatch.info.id);
  }, [currentMatch]);

  useEffect(() => {
    if (selectedMatchId && matches.some((match) => match.info.id === selectedMatchId)) {
      setCurrentMatchId(selectedMatchId);
    }
  }, [matches, selectedMatchId]);

  useEffect(() => {
    onMatchesChange?.(sortedMatches);
  }, [onMatchesChange, sortedMatches]);

  useEffect(() => {
    if (currentMatchId) onSelectMatch?.(currentMatchId);
  }, [currentMatchId, onSelectMatch]);

  const refreshData = async () => {
    const [payload, lineupPayload] = await Promise.all([loadData(teamId), loadTeamLineups(teamId)]);
    const mappedRoster = payload.roster.map((player) => ({
      id: player.id,
      playerId: player.player_id || player.id,
      name: player.name,
      capNumber: player.cap_number
    }));
    setRoster(mappedRoster);
    setMatches(payload.matches);
    setLineups(lineupPayload.lineups || []);
  };

  const createMatch = async () => {
    if (!newMatch.name.trim()) {
      setError('Enter a match name.');
      return;
    }
    try {
      setSetupSaving(true);
      const { data, error: insertError } = await supabase
        .from('matches')
        .insert({
          user_id: userId,
          season_id: seasonId,
          team_id: teamId,
          name: newMatch.name.trim(),
          opponent_name: newMatch.opponentName.trim(),
          date: newMatch.date || new Date().toISOString().slice(0, 10)
        })
        .select('*')
        .single();
      if (insertError) throw insertError;
      if (roster.length) {
        await saveMatchLineup({
          matchId: data.id,
          seasonId,
          teamId,
          userId,
          lineupRows: roster.map((player) => ({ id: player.id, player_id: player.playerId, cap_number: player.capNumber, status: 'playing' }))
        });
      }
      await refreshData();
      setCurrentMatchId(data.id);
      setNewMatch({ name: '', opponentName: '', date: new Date().toISOString().slice(0, 10) });
      setSetupPanel('');
      toast('Match created. The current roster is in the lineup.', 'success');
      onDataUpdated?.();
    } catch (e) {
      setError(e.message || 'Could not create match.');
    } finally {
      setSetupSaving(false);
    }
  };

  const addPlayer = async () => {
    if (!newPlayer.name.trim() || !newPlayer.capNumber.trim()) {
      setError('Enter a player name and cap number.');
      return;
    }
    try {
      setSetupSaving(true);
      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert({ user_id: userId, name: newPlayer.name.trim() })
        .select('id')
        .single();
      if (playerError) throw playerError;
      const { error: teamPlayerError } = await supabase.from('team_players').insert({
        user_id: userId,
        team_id: teamId,
        player_id: player.id,
        cap_number: newPlayer.capNumber.trim(),
        is_active: true
      });
      if (teamPlayerError) throw teamPlayerError;
      await refreshData();
      setNewPlayer({ name: '', capNumber: '' });
      toast('Player added to the team.', 'success');
      onDataUpdated?.();
    } catch (e) {
      setError(e.message || 'Could not add player. Run the team access SQL update first.');
    } finally {
      setSetupSaving(false);
    }
  };

  const openLineupSetup = () => {
    if (!currentMatch) return;
    const playingCaps = new Set(
      lineups.filter((row) => row.match_id === currentMatch.info.id && (row.status || 'playing') === 'playing').map((row) => row.cap_number)
    );
    setLineupSelection(Object.fromEntries(roster.map((player) => [player.id, playingCaps.size ? playingCaps.has(player.capNumber) : true])));
    setSetupPanel('lineup');
  };

  const saveLineup = async () => {
    if (!currentMatch) return;
    const selected = roster.filter((player) => lineupSelection[player.id]);
    if (!selected.length) {
      setError('Select at least one player for the lineup.');
      return;
    }
    try {
      setSetupSaving(true);
      await saveMatchLineup({
        matchId: currentMatch.info.id,
        seasonId,
        teamId,
        userId,
        lineupRows: selected.map((player) => ({ id: player.id, player_id: player.playerId, cap_number: player.capNumber, status: 'playing' }))
      });
      await refreshData();
      setSetupPanel('');
      toast('Lineup saved.', 'success');
      onDataUpdated?.();
    } catch (e) {
      setError(e.message || 'Could not save lineup. Run the team access SQL update first.');
    } finally {
      setSetupSaving(false);
    }
  };

  const updateScore = async (field, amount) => {
    if (!currentMatch) return;
    const currentValue = Number(currentMatch.info[field] || 0);
    const nextValue = Math.max(0, currentValue + amount);
    const databaseField = field === 'teamScoreAdjustment' ? 'team_score_adjustment' : 'opponent_score';
    const { error: updateError } = await supabase.from('matches').update({ [databaseField]: nextValue }).eq('id', currentMatch.info.id);
    if (updateError) {
      setError('Could not update score. Run the Shotmap MVP SQL update first.');
      return;
    }
    setMatches((prev) => prev.map((match) => match.info.id === currentMatch.info.id ? { ...match, info: { ...match.info, [field]: nextValue } } : match));
  };

  const handleFieldClick = (event) => {
    if (seasonMode) {
      setError('Adding shots is disabled in Season mode. Switch to Match mode.');
      return;
    }
    if (!fieldRef.current) return;
    if (!currentMatch) {
      setError('Create a match first.');
      return;
    }
    const rect = fieldRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    if (x >= 80 && y >= 75) return;
    const zone = detectZone(x, y, zones);
    if (!zone) return;
    setPendingShot({
      x,
      y,
      zone,
      attackType: '6vs6',
      result: 'raak',
      playerCap: activeLineup[0]?.capNumber || '',
      period: lastShotMeta?.period || '1',
      time: lastShotMeta?.time || formatShotTime(),
      followUpOutcome: 'goal'
    });
  };

  const handlePenaltyClick = () => {
    if (seasonMode) {
      setError('Adding shots is disabled in Season mode. Switch to Match mode.');
      return;
    }
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
      playerCap: activeLineup[0]?.capNumber || '',
      period: lastShotMeta?.period || '1',
      time: lastShotMeta?.time || formatShotTime(),
      followUpOutcome: 'goal'
    });
  };

  const closeShotEditor = () => {
    setPendingShot(null);
    setEditingShotId(null);
  };

  const saveShot = async () => {
    if (!pendingShot || !currentMatch) return;
    if (seasonMode && !editingShotId) {
      setError('Adding shots is disabled in Season mode. Switch to Match mode.');
      return;
    }
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
      period: pendingShot.period,
      score_for: liveScore.team + (!editingShotId && pendingShot.result === 'raak' ? 1 : 0),
      score_against: liveScore.opponent,
      follow_up_outcome: pendingShot.followUpOutcome || (pendingShot.result === 'raak' ? 'goal' : null)
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
                      matchId: currentMatch.info.id,
                      scoreFor: data.score_for,
                      scoreAgainst: data.score_against,
                      followUpOutcome: data.follow_up_outcome || ''
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
                        matchId: currentMatch.info.id,
                        scoreFor: data.score_for,
                        scoreAgainst: data.score_against,
                        followUpOutcome: data.follow_up_outcome || ''
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
    onDataUpdated?.();
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
    onDataUpdated?.();
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
      const periodA = periods.indexOf(a.period);
      const periodB = periods.indexOf(b.period);
      if (periodA !== periodB) return periodA - periodB;
      return timeToSeconds(b.time) - timeToSeconds(a.time);
    });
  }, [filteredShots]);

  const summary = useMemo(() => {
    const total = displayShots.length;
    const goals = displayShots.filter((shot) => shot.result === 'raak').length;
    const saves = displayShots.filter((shot) => shot.result === 'redding').length;
    const misses = displayShots.filter((shot) => shot.result === 'mis').length;
    const conversion = total ? ((goals / total) * 100).toFixed(1) : '0.0';
    const byPeriod = periods.reduce((acc, period) => {
      acc[period] = displayShots.filter((shot) => shot.period === period).length;
      return acc;
    }, {});
    const byZone = displayShots.reduce((acc, shot) => {
      acc[shot.zone] = (acc[shot.zone] || 0) + 1;
      return acc;
    }, {});
    const topZone = Object.entries(byZone).sort((a, b) => b[1] - a[1])[0];
    const topPeriod = Object.entries(byPeriod).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    return { total, goals, saves, misses, conversion, byPeriod, topZone, topPeriod };
  }, [displayShots, periods]);

  const outcomeInsights = useMemo(() => {
    const toRows = (items, key, label) => {
      const buckets = new Map();
      items.forEach((shot) => {
        const value = key(shot);
        if (!value || value === 'Not recorded') return;
        const bucket = buckets.get(value) || { label: label(value), shots: 0, goals: 0 };
        bucket.shots += 1;
        if (shot.result === 'raak') bucket.goals += 1;
        buckets.set(value, bucket);
      });
      return [...buckets.values()]
        .map((row) => ({ ...row, conversion: row.shots ? Math.round((row.goals / row.shots) * 100) : 0 }))
        .sort((a, b) => b.shots - a.shots || b.goals - a.goals);
    };

    return {
      zones: toRows(displayShots, (shot) => String(shot.zone), (zone) => `Zone ${zone}`),
      players: toRows(displayShots, (shot) => shot.playerCap, (cap) => `#${cap}`),
      periods: toRows(displayShots, (shot) => shot.period, (period) => `P${period}`),
      scoreStates: toRows(displayShots, scoreStateLabel, (state) => state),
      followUps: toRows(
        displayShots,
        (shot) => shot.followUpOutcome || '',
        (outcome) => ({
          goal: 'Goal',
          saved_recovered: 'Saved, recovered',
          rebound_retained: 'Rebound retained',
          rebound_lost: 'Rebound lost',
          exclusion_won: 'Exclusion won',
          turnover: 'Turnover'
        })[outcome] || outcome
      )
    };
  }, [displayShots]);

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
      const targetX = 0;
      const targetY = 100;
      const targetWidth = 1440;
      const targetHeight = 1200;
      const sourceWidth = canvas.width || 1;
      const sourceHeight = canvas.height || 1;
      const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
      const drawWidth = sourceWidth * scale;
      const drawHeight = sourceHeight * scale;
      const offsetX = targetX + (targetWidth - drawWidth) / 2;
      const offsetY = targetY + (targetHeight - drawHeight) / 2;

      // Keep field proportions stable in export, even on narrow mobile layouts.
      ctx.fillStyle = '#0b4a7a';
      ctx.fillRect(targetX, targetY, targetWidth, targetHeight);
      ctx.drawImage(canvas, offsetX, offsetY, drawWidth, drawHeight);
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

  useEffect(() => {
    if (seasonMode && pendingShot && !editingShotId) {
      setPendingShot(null);
      setEditingShotId(null);
    }
  }, [seasonMode, pendingShot, editingShotId]);

  if (loading) {
    return <div className="p-10 text-slate-700">Loading...</div>;
  }

  return (
    <div
      ref={liveModeContainerRef}
      className={liveMode ? 'fixed inset-0 z-50 overflow-y-auto bg-slate-950 p-2 text-white sm:p-3' : 'space-y-6'}
    >
      {!liveMode && <ModuleHeader
        eyebrow="Shotmap workspace"
        title={currentMatch ? currentMatch.info.name : 'Start a match'}
        description={currentMatch ? `${currentMatch.info.opponent ? `vs ${currentMatch.info.opponent} · ` : ''}${currentMatch.info.date}` : 'Create a match, set a lineup, and map shots from one workspace.'}
        actions={
          <>
            <ToolbarButton onClick={() => setSetupPanel('match')}>New match</ToolbarButton>
            <ToolbarButton onClick={() => setSetupPanel('roster')}>Roster</ToolbarButton>
            <ToolbarButton onClick={openLineupSetup} disabled={!currentMatch}>Lineup</ToolbarButton>
            <ToolbarButton variant="primary" onClick={toggleLiveMode} disabled={!currentMatch}>
              <Maximize2 size={15} /> Live mode
            </ToolbarButton>
            <ToolbarButton onClick={() => setShowSummary((prev) => !prev)}>
              {showSummary ? 'Hide summary' : 'Show summary'}
            </ToolbarButton>
            <ToolbarButton onClick={() => setShowFilters((prev) => !prev)}>
              {showFilters ? 'Hide filters' : 'Filters'}
            </ToolbarButton>
            <ToolbarButton onClick={() => setShowExports((prev) => !prev)}>
              {showExports ? 'Hide export' : 'Export'}
            </ToolbarButton>
          </>
        }
      />}

      {liveMode && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/15 bg-slate-900 px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{currentMatch?.info.name || 'Live match'}</div>
            <div className="text-xs text-slate-400">{currentMatch?.info.opponent ? `vs ${currentMatch.info.opponent}` : 'Shot logging'}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-slate-800 px-3 py-1.5 text-lg font-semibold">
              {liveScore.team} <span className="text-slate-500">-</span> {liveScore.opponent}
            </div>
            <label className="text-xs text-slate-300">P
              <select aria-label="Live period" className="ml-1 rounded bg-slate-800 px-2 py-1 text-sm text-white" value={lastShotMeta.period} onChange={(event) => setLastShotMeta((prev) => ({ ...prev, period: event.target.value }))}>
                {periods.map((period) => <option key={period} value={period}>{period}</option>)}
              </select>
            </label>
            <button className="rounded-lg border border-white/20 p-2 text-white" onClick={toggleLiveMode} title="Exit live mode">
              {isFullscreenActive ? <Minimize2 size={16} /> : 'Exit'}
            </button>
          </div>
        </div>
      )}

      {!liveMode && showSummary && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shots</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{summary.total}</div>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Goals</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{summary.goals}</div>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conversion</div>
              <div className="mt-1 text-2xl font-semibold text-emerald-700">{summary.conversion}%</div>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Result split</div>
              <div className="mt-1 text-sm text-slate-700">
                G {summary.goals} · S {summary.saves} · M {summary.misses}
              </div>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top zone</div>
              <div className="mt-1 text-sm text-slate-700">
                {summary.topZone ? `Zone ${summary.topZone[0]} (${summary.topZone[1]})` : 'No shots yet'}
              </div>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">
              <div className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                Location trend
              </div>
              <div className="mt-1 font-semibold">
                {summary.topZone
                  ? `Most volume comes from Zone ${summary.topZone[0]}.`
                  : 'No location trend yet.'}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Period trend
              </div>
              <div className="mt-1 font-semibold">
                {summary.topPeriod
                  ? `Highest shot volume in P${summary.topPeriod[0]} (${summary.topPeriod[1]} shots).`
                  : 'No period trend yet.'}
              </div>
            </div>
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Outcome analysis</div>
                <h3 className="mt-1 text-sm font-semibold text-slate-900">Where, who, when, and under what game state</h3>
              </div>
              <div className="text-xs text-slate-500">Conversion = goals / shots</div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ['Zones', outcomeInsights.zones],
                ['Players', outcomeInsights.players],
                ['Periods', outcomeInsights.periods],
                ['Score state', outcomeInsights.scoreStates],
                ['After shot', outcomeInsights.followUps]
              ].map(([title, rows]) => (
                <div key={title} className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
                  <div className="mt-2 space-y-1.5 text-xs">
                    {rows.slice(0, 3).map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-2 text-slate-700">
                        <span className="truncate font-medium">{row.label}</span>
                        <span className="whitespace-nowrap text-slate-500">{row.shots} · {row.conversion}%</span>
                      </div>
                    ))}
                    {rows.length === 0 && <div className="text-slate-400">No data yet</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!seasonMode && currentMatch && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Live match state</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">
              {liveScore.team} <span className="text-slate-400">-</span> {liveScore.opponent}
            </div>
            <div className="text-xs text-slate-600">Our goals are derived from mapped goals. Adjust only unmatched goals.</div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-slate-700">Our adjustment</span>
              <button className="rounded-md border border-cyan-200 px-2 py-1" onClick={() => updateScore('teamScoreAdjustment', -1)}>-</button>
              <button className="rounded-md border border-cyan-200 px-2 py-1" onClick={() => updateScore('teamScoreAdjustment', 1)}>+</button>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-slate-700">Opponent</span>
              <button className="rounded-md border border-cyan-200 px-2 py-1" onClick={() => updateScore('opponentScore', -1)}>-</button>
              <button className="rounded-md border border-cyan-200 px-2 py-1" onClick={() => updateScore('opponentScore', 1)}>+</button>
            </div>
          </div>
        </div>
      )}

      {!liveMode && setupPanel && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-800">
              {setupPanel === 'match' ? 'Create match' : setupPanel === 'roster' ? 'Team roster' : 'Match lineup'}
            </h3>
            <button className="text-xs font-semibold text-slate-500" onClick={() => setSetupPanel('')}>Close</button>
          </div>
          {setupPanel === 'match' && (
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_10rem_auto]">
              <input aria-label="Match name" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Match name" value={newMatch.name} onChange={(event) => setNewMatch((prev) => ({ ...prev, name: event.target.value }))} />
              <input aria-label="Opponent" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Opponent" value={newMatch.opponentName} onChange={(event) => setNewMatch((prev) => ({ ...prev, opponentName: event.target.value }))} />
              <input aria-label="Match date" type="date" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={newMatch.date} onChange={(event) => setNewMatch((prev) => ({ ...prev, date: event.target.value }))} />
              <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={setupSaving} onClick={createMatch}>Create</button>
            </div>
          )}
          {setupPanel === 'roster' && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                <input aria-label="Player name" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Player name" value={newPlayer.name} onChange={(event) => setNewPlayer((prev) => ({ ...prev, name: event.target.value }))} />
                <input aria-label="Cap number" className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Cap #" value={newPlayer.capNumber} onChange={(event) => setNewPlayer((prev) => ({ ...prev, capNumber: event.target.value }))} />
                <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={setupSaving} onClick={addPlayer}>Add player</button>
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-slate-700">
                {roster.map((player) => <span key={player.id} className="rounded-full bg-slate-100 px-3 py-1">#{player.capNumber} {player.name}</span>)}
              </div>
            </div>
          )}
          {setupPanel === 'lineup' && (
            <div className="mt-3">
              <p className="text-xs text-slate-500">Only selected players can be chosen while mapping shots.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {roster.map((player) => (
                  <label key={player.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <input type="checkbox" checked={Boolean(lineupSelection[player.id])} onChange={(event) => setLineupSelection((prev) => ({ ...prev, [player.id]: event.target.checked }))} />
                    #{player.capNumber} {player.name}
                  </label>
                ))}
              </div>
              <button className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={setupSaving} onClick={saveLineup}>Save lineup</button>
            </div>
          )}
        </section>
      )}

      <div className={liveMode ? 'grid min-h-[calc(100vh-5.25rem)] grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.65fr)]' : 'grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]'}>
        <div className="space-y-4">
          {!liveMode && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <ToolbarButton
                variant={!seasonMode ? 'primary' : 'secondary'}
                className={!seasonMode ? '' : 'text-slate-600'}
                onClick={() => setSeasonMode(false)}
              >
                <StatTooltipLabel
                  label="Match mode"
                  tooltip={SHOTMAP_TOOLTIPS.matchMode}
                  enabled={showTooltips}
                />
              </ToolbarButton>
              <ToolbarButton
                variant={seasonMode ? 'primary' : 'secondary'}
                className={seasonMode ? '' : 'text-slate-600'}
                onClick={() => setSeasonMode(true)}
              >
                <StatTooltipLabel
                  label="Season mode"
                  tooltip={SHOTMAP_TOOLTIPS.seasonMode}
                  enabled={showTooltips}
                />
              </ToolbarButton>
            </div>
            {matches.length === 0 && (
              <button className="text-xs font-semibold text-cyan-700" onClick={() => setSetupPanel('match')}>Create your first match</button>
            )}
          </div>}
          {!liveMode && !seasonMode && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Match selection</h3>
              {matches.length === 0 && (
                <div className="mt-3">
                  <ModuleEmptyState
                    compact
                    title="No matches available"
                    description="Create a match here, then set the lineup and track shots on the field."
                    actions={[
                      {
                        label: 'Create match',
                        onClick: () => setSetupPanel('match')
                      }
                    ]}
                  />
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                {sortedMatches.map((match) => (
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
                  Tracking is disabled until a match is created above.
                </div>
              )}
            </div>
          )}

          {!liveMode && showFilters && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-700">Quick filters</h3>
                <button
                  className="text-xs font-semibold text-slate-500 underline decoration-transparent hover:decoration-current"
                  onClick={() =>
                    setFilters({
                      players: [],
                      results: [],
                      periods: [],
                      attackTypes: [],
                      matches: []
                    })
                  }
                >
                  Clear all
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {seasonMode && (
                  <div className="w-full">
                    <div className="mb-2 text-xs font-semibold text-slate-500">Matches</div>
                    <div className="flex flex-wrap gap-2">
                      {sortedMatches.map((match) => (
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
                )}
                <div className="w-full">
                  <div className="mb-2 text-xs font-semibold text-slate-500">Players</div>
                  <div className="flex flex-wrap gap-2">
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
                  <div className="mb-2 text-xs font-semibold text-slate-500">Outcome</div>
                  <div className="flex flex-wrap gap-2">
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
                  <div className="mb-2 text-xs font-semibold text-slate-500">Period</div>
                  <div className="flex flex-wrap gap-2">
                    {periods.map((period) => (
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
                  <div className="mb-2 text-xs font-semibold text-slate-500">Attack type</div>
                  <div className="flex flex-wrap gap-2">
                    {attackTypes.map((type) => (
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

          <div className={liveMode ? 'h-full rounded-2xl bg-slate-900 p-2 shadow-sm' : 'rounded-2xl bg-white p-4 shadow-sm'}>
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-semibold ${liveMode ? 'text-white' : 'text-slate-700'}`}>
                <StatTooltipLabel
                  label="Interactive field"
                  tooltip={SHOTMAP_TOOLTIPS.interactiveField}
                  enabled={showTooltips}
                />
              </h3>
              <div className={`text-xs ${liveMode ? 'text-slate-300' : 'text-slate-500'}`}>
                {seasonMode ? 'Season mode: field is view-only' : 'Click to add a shot'}
              </div>
            </div>
            <div className={liveMode ? 'mt-2 flex h-[calc(100%-2rem)] justify-center' : 'mt-4 flex justify-center'}>
              <div
                ref={fieldRef}
                data-testid="shotmap-field"
                className={`relative ${liveMode ? 'h-full max-w-none' : 'h-[600px] max-w-[720px]'} w-full overflow-hidden rounded-2xl bg-gradient-to-b from-[#4aa3d6] via-[#2c7bb8] to-[#1f639a] ${
                  seasonMode ? 'cursor-default' : 'cursor-crosshair'
                }`}
                onClick={handleFieldClick}
              >
                <div className="absolute left-0 top-[48%] h-[2px] w-full bg-yellow-300" />
                <div className="absolute left-[40%] top-0 h-[6%] w-[20%] border-2 border-white bg-white/10" />

                {zones.map((zone) => (
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
                          className={`col-span-3 rounded-lg px-2 py-1 text-xs font-semibold ${
                            seasonMode
                              ? 'cursor-not-allowed bg-slate-300 text-slate-600'
                              : 'bg-yellow-400 text-slate-900'
                          }`}
                          disabled={seasonMode}
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
                    ? penaltyPosition(penaltyShots.findIndex((item) => item.id === shot.id), zones)
                    : { x: shot.x, y: shot.y };
                  return (
                    <div
                      key={shot.id}
                      className={`absolute flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-lg ${
                        resultColors[shot.result]
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
          {!liveMode && showExports && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <ToolbarButton variant="primary" onClick={downloadPNG}>
                  <Download size={16} />
                  Download PNG
                </ToolbarButton>
                <ToolbarButton onClick={exportCSV}>Export CSV</ToolbarButton>
              </div>
            </div>
          )}

          {!liveMode && <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Roster</h3>
            <p className="mt-2 text-sm text-slate-500">
              Add players or change the active lineup from the setup actions above.
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
          </div>}

          <div className={liveMode ? 'h-full overflow-hidden rounded-2xl bg-white p-3 shadow-sm' : 'rounded-2xl bg-white p-4 shadow-sm'}>
            <h3 className="text-sm font-semibold text-slate-700">
              <StatTooltipLabel
                label="Shots"
                tooltip={SHOTMAP_TOOLTIPS.shotsList}
                enabled={showTooltips}
              />
            </h3>
            <div className={liveMode ? 'mt-3 h-[calc(100%-2.5rem)] space-y-2 overflow-y-auto text-sm' : 'mt-3 max-h-[320px] space-y-2 overflow-y-auto text-sm'}>
              {displayShots.length === 0 && (
                <ModuleEmptyState
                  compact
                  title="No shots recorded"
                  description={
                    seasonMode
                      ? 'Use filters or log shots in Shotmap to populate this list.'
                      : 'Log the first shot for the selected match to start building the list.'
                  }
                  actions={[
                    {
                      label: seasonMode ? 'Clear filters' : 'Create match',
                      onClick: seasonMode
                        ? () =>
                            setFilters({
                              players: [],
                              results: [],
                              periods: [],
                              attackTypes: [],
                              matches: []
                            })
                        : () => setSetupPanel('match'),
                      variant: seasonMode ? 'secondary' : undefined
                    }
                  ]}
                />
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
                      {shot.followUpOutcome ? ` · ${shot.followUpOutcome.replaceAll('_', ' ')}` : ''}
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
                          time: shot.time,
                          followUpOutcome: shot.followUpOutcome || ''
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

      {pendingShot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl shadow-slate-950/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                  {editingShotId ? 'Edit shot' : 'New shot'}
                </p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">Shot details</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Zone {pendingShot.zone} · X {pendingShot.x.toFixed(1)}% · Y {pendingShot.y.toFixed(1)}%
                </p>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600"
                onClick={closeShotEditor}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <div>
                <label className="text-xs font-semibold text-slate-500">Player</label>
                <select
                  aria-label="Shot player"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={pendingShot.playerCap}
                  onChange={(event) =>
                    setPendingShot((prev) => ({ ...prev, playerCap: event.target.value }))
                  }
                >
                  <option value="">Select player</option>
                  {activeLineup.map((player) => (
                    <option key={player.id} value={player.capNumber}>
                      #{player.capNumber} {player.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-slate-500">
                    <StatTooltipLabel
                      label="Result"
                      tooltip={SHOTMAP_TOOLTIPS.result}
                      enabled={showTooltips}
                    />
                  </div>
                  <select
                    aria-label="Shot result"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={pendingShot.result}
                    onChange={(event) => {
                      const result = event.target.value;
                      setPendingShot((prev) => ({
                        ...prev,
                        result,
                        followUpOutcome:
                          result === 'raak'
                            ? prev.followUpOutcome || 'goal'
                            : prev.followUpOutcome === 'goal'
                            ? ''
                            : prev.followUpOutcome
                      }));
                    }}
                  >
                    <option value="raak">Goal</option>
                    <option value="redding">Saved</option>
                    <option value="mis">Miss</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500">
                    <StatTooltipLabel
                      label="Attack"
                      tooltip={SHOTMAP_TOOLTIPS.attackType}
                      enabled={showTooltips}
                    />
                  </div>
                  <select
                    aria-label="Shot attack"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={pendingShot.attackType}
                    onChange={(event) =>
                      setPendingShot((prev) => ({ ...prev, attackType: event.target.value }))
                    }
                    disabled={pendingShot.zone === 14}
                  >
                    {attackTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-slate-500">
                    <StatTooltipLabel
                      label="Period"
                      tooltip={SHOTMAP_TOOLTIPS.period}
                      enabled={showTooltips}
                    />
                  </div>
                  <select
                    aria-label="Shot period"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={pendingShot.period}
                    onChange={(event) =>
                      setPendingShot((prev) => ({ ...prev, period: event.target.value }))
                    }
                  >
                    {periods.map((period) => (
                      <option key={period} value={period}>
                        P{period}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500">
                    <StatTooltipLabel
                      label="Time"
                      tooltip={SHOTMAP_TOOLTIPS.playClock}
                      enabled={showTooltips}
                    />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        aria-label="Shot minutes"
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
                        aria-label="Shot seconds"
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
                          type="button"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500">After the shot</label>
                <select
                  aria-label="Shot follow-up outcome"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={pendingShot.followUpOutcome || ''}
                  onChange={(event) => setPendingShot((prev) => ({ ...prev, followUpOutcome: event.target.value }))}
                >
                  <option value="">Not recorded</option>
                  <option value="goal">Goal</option>
                  <option value="saved_recovered">Saved, recovered</option>
                  <option value="rebound_retained">Rebound retained</option>
                  <option value="rebound_lost">Rebound lost</option>
                  <option value="exclusion_won">Exclusion won</option>
                  <option value="turnover">Turnover</option>
                </select>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                  onClick={closeShotEditor}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  onClick={saveShot}
                  type="button"
                >
                  {editingShotId ? 'Update shot' : 'Save shot'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShotmapView;
