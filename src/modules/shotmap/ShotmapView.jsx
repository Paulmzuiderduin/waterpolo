import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
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
  onOpenModule
}) => {
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
        const payload = await loadData(teamId);
        if (!active) return;
        const mappedRoster = payload.roster.map((player) => ({
          id: player.id,
          name: player.name,
          capNumber: player.cap_number
        }));
        setRoster(mappedRoster);
        setMatches(payload.matches);
        const sortedPayloadMatches = [...payload.matches].sort((a, b) => {
          const ad = a.info?.date ? new Date(a.info.date).getTime() : 0;
          const bd = b.info?.date ? new Date(b.info.date).getTime() : 0;
          return bd - ad;
        });
        setCurrentMatchId(sortedPayloadMatches[0]?.info?.id || '');
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

  useEffect(() => {
    if (!currentMatch) return;
    setCurrentMatchId(currentMatch.info.id);
  }, [currentMatch]);

  const refreshData = async () => {
    const payload = await loadData(teamId);
    const mappedRoster = payload.roster.map((player) => ({
      id: player.id,
      name: player.name,
      capNumber: player.cap_number
    }));
    setRoster(mappedRoster);
    setMatches(payload.matches);
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
      playerCap: roster[0]?.capNumber || '',
      period: lastShotMeta?.period || '1',
      time: lastShotMeta?.time || formatShotTime()
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
      playerCap: roster[0]?.capNumber || '',
      period: lastShotMeta?.period || '1',
      time: lastShotMeta?.time || formatShotTime()
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
    <div className="space-y-6">
      <ModuleHeader
        eyebrow="Water Polo Shotmap"
        title="Shot Tracking & Recording"
        description="Track match shots on the field or review the selected season scope with filters."
        actions={
          <>
            <ToolbarButton variant="primary" onClick={downloadPNG}>
              <Download size={16} />
              Download PNG
            </ToolbarButton>
            <ToolbarButton onClick={exportCSV}>
              Export CSV
            </ToolbarButton>
          </>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
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
              <div className="text-xs font-semibold text-slate-500">
                Create matches in the Matches tab first.
              </div>
            )}
          </div>
          {!seasonMode && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Match selection</h3>
              {matches.length === 0 && (
                <div className="mt-3">
                  <ModuleEmptyState
                    compact
                    title="No matches available"
                    description="Create a match first, then return here to track shots on the field."
                    actions={[
                      {
                        label: 'Open Matches',
                        onClick: () => onOpenModule?.('matches')
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
                  <label className="text-xs font-semibold text-slate-500">Attack type</label>
                  <div className="mt-2 flex flex-wrap gap-2">
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

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">
                <StatTooltipLabel
                  label="Interactive field"
                  tooltip={SHOTMAP_TOOLTIPS.interactiveField}
                  enabled={showTooltips}
                />
              </h3>
              <div className="text-xs text-slate-500">
                {seasonMode ? 'Season mode: field is view-only' : 'Click to add a shot'}
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <div
                ref={fieldRef}
                data-testid="shotmap-field"
                className={`relative h-[600px] w-full max-w-[720px] overflow-hidden rounded-2xl bg-gradient-to-b from-[#4aa3d6] via-[#2c7bb8] to-[#1f639a] ${
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
            <h3 className="text-sm font-semibold text-slate-700">
              <StatTooltipLabel
                label="Shots"
                tooltip={SHOTMAP_TOOLTIPS.shotsList}
                enabled={showTooltips}
              />
            </h3>
            <div className="mt-3 max-h-[280px] space-y-2 overflow-y-auto text-sm">
              {displayShots.length === 0 && (
                <ModuleEmptyState
                  compact
                  title="No shots recorded"
                  description={
                    seasonMode
                      ? 'Adjust the filters or log shots in Shotmap to populate this list.'
                      : 'Log the first shot for the selected match to start building the list.'
                  }
                  actions={[
                    {
                      label: seasonMode ? 'Clear filters' : 'Open Matches',
                      onClick: seasonMode
                        ? () =>
                            setFilters({
                              players: [],
                              results: [],
                              periods: [],
                              attackTypes: [],
                              matches: []
                            })
                        : () => onOpenModule?.('matches'),
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
                  {roster.map((player) => (
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
