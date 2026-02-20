import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { distanceMeters } from '../../utils/field';
import { computeAge } from '../../utils/time';

const PlayersView = ({
  seasonId,
  teamId,
  userId,
  seasons = [],
  onSelectSeason,
  onSelectTeam,
  loadData
}) => {
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
        const payload = await loadData(teamId);
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

export default PlayersView;
