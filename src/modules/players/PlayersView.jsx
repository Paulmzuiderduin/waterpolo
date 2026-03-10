import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { distanceMeters } from '../../utils/field';
import { computeAge, timeToSeconds } from '../../utils/time';
import ModuleHeader from '../../components/ModuleHeader';
import ModuleEmptyState from '../../components/ModuleEmptyState';
import StatTooltipLabel from '../../components/StatTooltipLabel';
import ToolbarButton from '../../components/ToolbarButton';
import { withSignedRosterPhotos } from '../../lib/waterpolo/photos';
import { normalizeScoringEventType } from '../../lib/waterpolo/scoring';

const pct = (value, total) => (total ? ((value / total) * 100).toFixed(1) : '0.0');

const sortByPeriodAndTimeDesc = (a, b) => {
  const periodDiff = Number(b.period || 0) - Number(a.period || 0);
  if (periodDiff !== 0) return periodDiff;
  return timeToSeconds(b.time || '0:00') - timeToSeconds(a.time || '0:00');
};

const PLAYER_TOOLTIPS = {
  shotsPerMatch: 'Average scoring actions or shot attempts per selected match, depending on the selected source.',
  onTargetPct: 'Goals + saves divided by total shots.',
  conversionOnTarget: 'Goals divided by on-target shots.',
  turnoverNet: 'Turnovers won minus turnovers lost.',
  disciplineLoad: 'Personal fouls, ordinary fouls, misconducts, and violent actions combined.',
  scoringImpact: 'Shot goals as percentage of total logged scoring actions.'
};

const PlayersView = ({
  seasonId,
  teamId,
  userId,
  seasons = [],
  onSelectSeason,
  onSelectTeam,
  loadData,
  showTooltips = true,
  showAdvancedMetrics = false,
  onOpenModule
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
        const rosterWithPhotos = await withSignedRosterPhotos(payload.roster);
        if (!active) return;
        const mappedRoster = rosterWithPhotos.map((player) => ({
          id: player.id,
          name: player.name,
          capNumber: player.cap_number,
          birthday: player.birthday,
          heightCm: player.height_cm,
          weightKg: player.weight_kg,
          dominantHand: player.dominant_hand,
          notes: player.notes,
          photoUrl: player.photo_url,
          photoPath: player.photo_path || ''
        }));
        setData({ roster: mappedRoster, matches: payload.matches });
        if (!scoringError) {
          setScoringEvents(
            (scoringData || []).map((evt) => ({
              id: evt.id,
              matchId: evt.match_id,
              type: normalizeScoringEventType(evt.event_type),
              playerCap: evt.player_cap || '',
              period: evt.period,
              time: evt.time,
              createdAt: evt.created_at
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
    () =>
      scopedMatches.flatMap((match) =>
        (match.shots || []).map((shot, index) => ({
          ...shot,
          matchName: match.info?.name || 'Match',
          matchDate: match.info?.date || '',
          rowId: shot.id || `${match.info?.id || 'match'}_${index}_${shot.playerCap}_${shot.period}_${shot.time}`
        }))
      ),
    [scopedMatches]
  );

  const scopedScoringEvents = useMemo(() => {
    if (!selectedMatches.length) return [];
    const matchSet = new Set(selectedMatches);
    const matchLookup = Object.fromEntries(
      matches.map((match) => [match.info.id, { name: match.info?.name || 'Match', date: match.info?.date || '' }])
    );
    return scoringEvents
      .filter((evt) => matchSet.has(evt.matchId))
      .map((evt) => ({
        ...evt,
        matchName: matchLookup[evt.matchId]?.name || 'Match',
        matchDate: matchLookup[evt.matchId]?.date || ''
      }));
  }, [scoringEvents, selectedMatches, matches]);

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
    const playerShots = shots
      .filter((shot) => shot.playerCap === player.capNumber)
      .sort(sortByPeriodAndTimeDesc);
    const goals = playerShots.filter((shot) => shot.result === 'raak');
    const saves = playerShots.filter((shot) => shot.result === 'redding');
    const misses = playerShots.filter((shot) => shot.result === 'mis');
    const onTarget = goals.length + saves.length;
    const goalPct = pct(goals.length, playerShots.length);
    const onTargetPct = pct(onTarget, playerShots.length);
    const conversionOnTargetPct = pct(goals.length, onTarget);
    const avgDistance = goals.length
      ? (goals.reduce((sum, shot) => sum + distanceMeters(shot), 0) / goals.length).toFixed(1)
      : '—';
    const avgAllDistance = playerShots.length
      ? (playerShots.reduce((sum, shot) => sum + distanceMeters(shot), 0) / playerShots.length).toFixed(1)
      : '—';
    const zoneCount = {};
    const zoneBreakdown = {};
    const periodBreakdown = {};
    const attackBreakdown = {};
    playerShots.forEach((shot) => {
      zoneCount[shot.zone] = (zoneCount[shot.zone] || 0) + (shot.result === 'raak' ? 1 : 0);
      zoneBreakdown[shot.zone] = zoneBreakdown[shot.zone] || { attempts: 0, goals: 0 };
      zoneBreakdown[shot.zone].attempts += 1;
      if (shot.result === 'raak') zoneBreakdown[shot.zone].goals += 1;

      periodBreakdown[shot.period] = periodBreakdown[shot.period] || {
        attempts: 0,
        goals: 0,
        onTarget: 0
      };
      periodBreakdown[shot.period].attempts += 1;
      if (shot.result === 'raak') periodBreakdown[shot.period].goals += 1;
      if (shot.result === 'raak' || shot.result === 'redding') periodBreakdown[shot.period].onTarget += 1;

      attackBreakdown[shot.attackType] = attackBreakdown[shot.attackType] || {
        attempts: 0,
        goals: 0
      };
      attackBreakdown[shot.attackType].attempts += 1;
      if (shot.result === 'raak') attackBreakdown[shot.attackType].goals += 1;
    });
    const preferredZone = Object.keys(zoneCount).sort((a, b) => zoneCount[b] - zoneCount[a])[0] || '—';
    const topZones = Object.entries(zoneBreakdown)
      .map(([zone, values]) => ({
        zone,
        attempts: values.attempts,
        goals: values.goals,
        goalPct: pct(values.goals, values.attempts)
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 5);
    const periodRows = Object.entries(periodBreakdown)
      .map(([period, values]) => ({
        period,
        attempts: values.attempts,
        goals: values.goals,
        onTargetPct: pct(values.onTarget, values.attempts),
        goalPct: pct(values.goals, values.attempts)
      }))
      .sort((a, b) => Number(a.period) - Number(b.period));
    const attackRows = Object.entries(attackBreakdown)
      .map(([attackType, values]) => ({
        attackType,
        attempts: values.attempts,
        goals: values.goals,
        goalPct: pct(values.goals, values.attempts)
      }))
      .sort((a, b) => b.attempts - a.attempts);
    const recentShots = playerShots.slice(0, 8);
    const byMatch = {};
    playerShots.forEach((shot) => {
      const key = `${shot.matchName}|${shot.matchDate}`;
      byMatch[key] = byMatch[key] || { match: key, shots: 0, goals: 0, date: shot.matchDate || '' };
      byMatch[key].shots += 1;
      if (shot.result === 'raak') byMatch[key].goals += 1;
    });
    const matchSeries = Object.values(byMatch).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const lastFive = matchSeries.slice(-5);
    const avgShotsAll = matchSeries.length
      ? matchSeries.reduce((sum, item) => sum + item.shots, 0) / matchSeries.length
      : 0;
    const avgShotsLastFive = lastFive.length ? lastFive.reduce((sum, item) => sum + item.shots, 0) / lastFive.length : 0;
    const shotStdDev = matchSeries.length
      ? Math.sqrt(
          matchSeries.reduce((sum, item) => sum + (item.shots - avgShotsAll) ** 2, 0) / matchSeries.length
        )
      : 0;
    return {
      total: playerShots.length,
      goals: goals.length,
      saves: saves.length,
      misses: misses.length,
      goalPct,
      onTarget,
      onTargetPct,
      conversionOnTargetPct,
      avgDistance,
      avgAllDistance,
      preferredZone,
      shots: playerShots,
      topZones,
      periodRows,
      attackRows,
      recentShots,
      trend: {
        avgShotsAll: avgShotsAll.toFixed(1),
        avgShotsLastFive: avgShotsLastFive.toFixed(1),
        shotStdDev: shotStdDev.toFixed(1)
      }
    };
  };

  const buildScoringStats = (player) => {
    if (!player) return null;
    const playerEvents = scopedScoringEvents
      .filter((evt) => evt.playerCap === player.capNumber)
      .sort(sortByPeriodAndTimeDesc);
    const countBy = (type) => playerEvents.filter((evt) => evt.type === type).length;
    const periodBreakdown = {};
    playerEvents.forEach((evt) => {
      periodBreakdown[evt.period] = periodBreakdown[evt.period] || {
        total: 0,
        shotGoals: 0,
        personalFouls: 0,
        ordinaryFouls: 0
      };
      periodBreakdown[evt.period].total += 1;
      if (evt.type === 'shot_goal') periodBreakdown[evt.period].shotGoals += 1;
      if (evt.type === 'exclusion_foul' || evt.type === 'penalty_foul') periodBreakdown[evt.period].personalFouls += 1;
      if (evt.type === 'ordinary_foul') periodBreakdown[evt.period].ordinaryFouls += 1;
    });
    const goals = countBy('shot_goal');
    const shotSaved = countBy('shot_saved');
    const shotMissed = countBy('shot_missed');
    const shots = goals + shotSaved + shotMissed;
    const turnoversWon = countBy('turnover_won');
    const turnoversLost = countBy('turnover_lost');
    const exclusionFouls = countBy('exclusion_foul');
    const penaltyFouls = countBy('penalty_foul');
    const personalFouls = exclusionFouls + penaltyFouls;
    const ordinaryFouls = countBy('ordinary_foul');
    const misconducts = countBy('misconduct');
    const violentActions = countBy('violent_action');
    const periodRows = Object.entries(periodBreakdown)
      .map(([period, values]) => ({ period, ...values }))
      .sort((a, b) => Number(a.period) - Number(b.period));
    const byMatch = {};
    playerEvents.forEach((evt) => {
      const key = `${evt.matchName}|${evt.matchDate}`;
      byMatch[key] = byMatch[key] || { match: key, events: 0, goals: 0, date: evt.matchDate || '' };
      byMatch[key].events += 1;
      if (evt.type === 'shot_goal') byMatch[key].goals += 1;
    });
    const matchSeries = Object.values(byMatch).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const lastFive = matchSeries.slice(-5);
    const avgEventsAll = matchSeries.length
      ? matchSeries.reduce((sum, item) => sum + item.events, 0) / matchSeries.length
      : 0;
    const avgEventsLastFive = lastFive.length ? lastFive.reduce((sum, item) => sum + item.events, 0) / lastFive.length : 0;
    const eventStdDev = matchSeries.length
      ? Math.sqrt(
          matchSeries.reduce((sum, item) => sum + (item.events - avgEventsAll) ** 2, 0) / matchSeries.length
        )
      : 0;
    return {
      goals,
      shotSaved,
      shotMissed,
      shots,
      exclusionFouls,
      penaltyFouls,
      personalFouls,
      ordinaryFouls,
      misconducts,
      violentActions,
      turnoversWon,
      turnoversLost,
      turnoverNet: turnoversWon - turnoversLost,
      disciplineLoad: personalFouls + ordinaryFouls + misconducts + violentActions,
      total: playerEvents.length,
      scoringImpactPct: pct(goals, playerEvents.length),
      periodRows,
      recentEvents: playerEvents.slice(0, 8),
      trend: {
        avgEventsAll: avgEventsAll.toFixed(1),
        avgEventsLastFive: avgEventsLastFive.toFixed(1),
        eventStdDev: eventStdDev.toFixed(1)
      }
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
  const selectedMatchCount = selectedMatches.length || 0;
  const playerBmi =
    selectedPlayer?.heightCm && selectedPlayer?.weightKg
      ? (selectedPlayer.weightKg / ((selectedPlayer.heightCm / 100) ** 2)).toFixed(1)
      : '—';
  const selectedShotsPerMatch =
    selectedStats && reportSource === 'shotmap' && selectedMatchCount
      ? (selectedStats.total / selectedMatchCount).toFixed(1)
      : '—';
  const selectedEventsPerMatch =
    selectedStats && reportSource === 'scoring' && selectedMatchCount
      ? (selectedStats.total / selectedMatchCount).toFixed(1)
      : '—';

  const exportPDF = async () => {
    if (!selectedPlayer || !selectedStats) {
      return;
    }

    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 40;
    const right = pageWidth - margin;
    let y = margin;

    const ensureSpace = (height) => {
      if (y + height > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
    };

    const drawRight = (text, x, yy) => {
      const value = String(text ?? '');
      pdf.text(value, x - pdf.getTextWidth(value), yy);
    };

    const sectionTitle = (label) => {
      ensureSpace(28);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(12);
      pdf.text(label, margin, y);
      y += 8;
      pdf.setDrawColor(226, 232, 240);
      pdf.line(margin, y, right, y);
      y += 16;
    };

    const keyValue = (label, value) => {
      ensureSpace(20);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.setFontSize(10);
      pdf.text(label, margin, y);
      pdf.setTextColor(15, 23, 42);
      drawRight(value, right, y);
      y += 6;
      pdf.setDrawColor(241, 245, 249);
      pdf.line(margin, y, right, y);
      y += 14;
    };

    const sourceLabel = reportSource === 'shotmap' ? 'Shotmap' : 'Scoring';
    const createdAt = new Date().toLocaleDateString('en-GB');
    const infoLines = [
      `Player: #${selectedPlayer.capNumber} ${selectedPlayer.name}`,
      `Source: ${sourceLabel}`,
      `Season: ${selectedSeason?.name || 'Unknown'}`,
      `Team: ${selectedTeam?.name || 'Unknown'}`,
      `Matches included: ${selectedMatchCount}`,
      `Generated: ${createdAt}`
    ];

    pdf.setFillColor(15, 23, 42);
    pdf.roundedRect(margin, y, pageWidth - margin * 2, 72, 10, 10, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('Waterpolo Player Report Card', margin + 16, y + 24);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`#${selectedPlayer.capNumber} ${selectedPlayer.name}`, margin + 16, y + 44);
    drawRight(sourceLabel, right - 16, y + 24);
    drawRight(createdAt, right - 16, y + 44);
    y += 92;

    sectionTitle('Context');
    infoLines.forEach((line) => {
      keyValue(line.split(':')[0], line.slice(line.indexOf(':') + 1).trim());
    });

    sectionTitle('Profile');
    keyValue('Age', computeAge(selectedPlayer.birthday) ?? '—');
    keyValue('Dominant hand', selectedPlayer.dominantHand || '—');
    keyValue('Height', selectedPlayer.heightCm ? `${selectedPlayer.heightCm} cm` : '—');
    keyValue('Weight', selectedPlayer.weightKg ? `${selectedPlayer.weightKg} kg` : '—');
    keyValue('BMI', playerBmi);

    sectionTitle(sourceLabel === 'Shotmap' ? 'Shot Performance' : 'Scoring Performance');
    if (reportSource === 'shotmap') {
      keyValue('Shots', selectedStats.total);
      keyValue('Goals', selectedStats.goals);
      keyValue('Saved', selectedStats.saves);
      keyValue('Missed', selectedStats.misses);
      keyValue('Goal %', `${selectedStats.goalPct}%`);
      keyValue('On target %', `${selectedStats.onTargetPct}%`);
      keyValue('Shots per match', selectedShotsPerMatch);
      keyValue('Average shot distance', `${selectedStats.avgAllDistance}m`);
      keyValue('Preferred goal zone', `Zone ${selectedStats.preferredZone}`);
      if (showAdvancedMetrics) {
        keyValue('Conversion on target', `${selectedStats.conversionOnTargetPct}%`);
        keyValue('Average goal distance', `${selectedStats.avgDistance}m`);
        keyValue('Consistency (σ shots)', selectedStats.trend.shotStdDev);
      }
    } else {
      keyValue('Events', selectedStats.total);
      keyValue('Shot goals', selectedStats.goals);
      keyValue('Shots', selectedStats.shots);
      keyValue('Scoring impact', `${selectedStats.scoringImpactPct}%`);
      keyValue('Events per match', selectedEventsPerMatch);
      keyValue('Personal fouls', selectedStats.personalFouls);
      keyValue('Turnovers won', selectedStats.turnoversWon);
      keyValue('Turnovers lost', selectedStats.turnoversLost);
      keyValue('Turnover net', selectedStats.turnoverNet);
      if (showAdvancedMetrics) {
        keyValue('Ordinary fouls', selectedStats.ordinaryFouls);
        keyValue('Misconducts', selectedStats.misconducts);
        keyValue('Violent actions', selectedStats.violentActions);
        keyValue('Discipline load', selectedStats.disciplineLoad);
        keyValue('Consistency (σ events)', selectedStats.trend.eventStdDev);
      }
    }

    const recentRows =
      reportSource === 'shotmap'
        ? selectedStats.recentShots.slice(0, 6).map((row) => ({
            label: `${row.matchName} · P${row.period} ${row.time}`,
            value: `Zone ${row.zone} · ${row.result}`
          }))
        : selectedStats.recentEvents.slice(0, 6).map((row) => ({
            label: `${row.matchName} · P${row.period} ${row.time}`,
            value: row.type
          }));

    sectionTitle(reportSource === 'shotmap' ? 'Recent Shots' : 'Recent Events');
    if (!recentRows.length) {
      keyValue('Log', 'No recent entries in selected scope');
    } else {
      recentRows.forEach((row, index) => keyValue(`${index + 1}. ${row.label}`, row.value));
    }

    const file = `player_report_${selectedPlayer.capNumber}_${sourceLabel.toLowerCase()}.pdf`;
    pdf.save(file);
  };
  const teamShotLeaders = useMemo(
    () =>
      roster
        .map((player) => {
          const stats = buildShotmapStats(player);
          return {
            id: player.id,
            capNumber: player.capNumber,
            name: player.name,
            goals: stats?.goals || 0,
            total: stats?.total || 0,
            goalPct: stats?.goalPct || '0.0'
          };
        })
        .filter((item) => item.total > 0)
        .sort((a, b) => b.goals - a.goals || b.total - a.total)
        .slice(0, 5),
    [roster, shots]
  );
  const teamScoringLeaders = useMemo(
    () =>
      roster
        .map((player) => {
          const stats = buildScoringStats(player);
          return {
            id: player.id,
            capNumber: player.capNumber,
            name: player.name,
            goals: stats?.goals || 0,
            events: stats?.total || 0,
            turnoverNet: stats?.turnoverNet || 0
          };
        })
        .filter((item) => item.events > 0)
        .sort((a, b) => b.goals - a.goals || b.events - a.events)
        .slice(0, 5),
    [roster, scopedScoringEvents]
  );

  if (loading) {
    return <div className="p-10 text-slate-700">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        eyebrow="Players"
        title="Player Report Card"
        description="Compare player output across selected matches using shotmap or scoring data."
        actions={
          <ToolbarButton variant="primary" onClick={exportPDF} disabled={!selectedPlayer}>
            <Download size={16} />
            Export PDF
          </ToolbarButton>
        }
      />

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
                  <ModuleEmptyState
                    compact
                    title="No matches yet"
                    description="Create matches first so the report card can be filtered by real games."
                    actions={[
                      {
                        label: 'Open Matches',
                        onClick: () => onOpenModule?.('matches')
                      }
                    ]}
                  />
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

          <div
            ref={reportRef}
            className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-6 shadow-sm"
          >
            {selectedPlayer ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
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
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs">
                    <div className="font-semibold uppercase tracking-wide text-slate-500">Report source</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {reportSource === 'shotmap' ? 'Shotmap' : 'Scoring'}
                    </div>
                    <div className="mt-2 text-slate-500">
                      Matches included: <span className="font-semibold text-slate-700">{selectedMatchCount}</span>
                    </div>
                  </div>
                </div>

                {selectedStats && reportSource === 'shotmap' && (
                  <>
                    <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                      <div className="rounded-xl border border-slate-100 p-3">
                        <div className="text-xs text-slate-500">Shots</div>
                        <div className="text-lg font-semibold">{selectedStats.total}</div>
                      </div>
                      <div className="rounded-xl border border-slate-100 p-3">
                        <div className="text-xs text-slate-500">Goals</div>
                        <div className="text-lg font-semibold">{selectedStats.goals}</div>
                      </div>
                      <div className="rounded-xl border border-slate-100 p-3">
                        <div className="text-xs text-slate-500">Goal %</div>
                        <div className="text-lg font-semibold">{selectedStats.goalPct}%</div>
                      </div>
                      <div className="rounded-xl border border-slate-100 p-3">
                        <div className="text-xs text-slate-500">
                          <StatTooltipLabel
                            label="On target %"
                            tooltip={PLAYER_TOOLTIPS.onTargetPct}
                            enabled={showTooltips}
                          />
                        </div>
                        <div className="text-lg font-semibold">{selectedStats.onTargetPct}%</div>
                      </div>
                      <div className="rounded-xl border border-slate-100 p-3">
                        <div className="text-xs text-slate-500">
                          <StatTooltipLabel
                            label="Shots / match"
                            tooltip={PLAYER_TOOLTIPS.shotsPerMatch}
                            enabled={showTooltips}
                          />
                        </div>
                        <div className="text-lg font-semibold">{selectedShotsPerMatch}</div>
                      </div>
                      <div className="rounded-xl border border-slate-100 p-3">
                        <div className="text-xs text-slate-500">Avg shot distance</div>
                        <div className="text-lg font-semibold">{selectedStats.avgAllDistance}m</div>
                      </div>
                      {showAdvancedMetrics && (
                        <>
                          <div className="rounded-xl border border-slate-100 p-3">
                            <div className="text-xs text-slate-500">
                              <StatTooltipLabel
                                label="Conv. (on target)"
                                tooltip={PLAYER_TOOLTIPS.conversionOnTarget}
                                enabled={showTooltips}
                              />
                            </div>
                            <div className="text-lg font-semibold">{selectedStats.conversionOnTargetPct}%</div>
                          </div>
                          <div className="rounded-xl border border-slate-100 p-3">
                            <div className="text-xs text-slate-500">Avg goal distance</div>
                            <div className="text-lg font-semibold">{selectedStats.avgDistance}m</div>
                          </div>
                          <div className="rounded-xl border border-slate-100 p-3">
                            <div className="text-xs text-slate-500">Last 5 avg shots</div>
                            <div className="text-lg font-semibold">{selectedStats.trend.avgShotsLastFive}</div>
                          </div>
                          <div className="rounded-xl border border-slate-100 p-3">
                            <div className="text-xs text-slate-500">Season avg shots</div>
                            <div className="text-lg font-semibold">{selectedStats.trend.avgShotsAll}</div>
                          </div>
                          <div className="rounded-xl border border-slate-100 p-3">
                            <div className="text-xs text-slate-500">Consistency (σ shots)</div>
                            <div className="text-lg font-semibold">{selectedStats.trend.shotStdDev}</div>
                          </div>
                        </>
                      )}
                    </div>

                    {showAdvancedMetrics && (
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="rounded-xl border border-slate-100 p-3 text-sm">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">By Period</div>
                          <div className="space-y-2">
                            {selectedStats.periodRows.map((row) => (
                              <div key={row.period} className="grid grid-cols-4 gap-2 text-xs">
                                <span className="font-semibold text-slate-700">P{row.period}</span>
                                <span className="text-slate-600">{row.attempts} att</span>
                                <span className="text-slate-600">{row.goalPct}% goal</span>
                                <span className="text-slate-600">{row.onTargetPct}% on target</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-100 p-3 text-sm">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">By Attack Type</div>
                          <div className="space-y-2">
                            {selectedStats.attackRows.slice(0, 6).map((row) => (
                              <div key={row.attackType} className="grid grid-cols-3 gap-2 text-xs">
                                <span className="font-semibold text-slate-700">{row.attackType}</span>
                                <span className="text-slate-600">{row.attempts} att</span>
                                <span className="text-slate-600">{row.goalPct}% goal</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {showAdvancedMetrics && (
                      <div className="rounded-xl border border-slate-100 p-3 text-sm">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Top Zones</div>
                        <div className="space-y-2">
                          {selectedStats.topZones.map((zone) => (
                            <div key={zone.zone} className="grid grid-cols-4 gap-2 text-xs">
                              <span className="font-semibold text-slate-700">Zone {zone.zone}</span>
                              <span className="text-slate-600">{zone.attempts} att</span>
                              <span className="text-slate-600">{zone.goals} goals</span>
                              <span className="text-slate-600">{zone.goalPct}% goal</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {selectedStats && reportSource === 'scoring' && (
                  <>
                    <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                      <div className="rounded-xl border border-slate-100 p-3">
                        <div className="text-xs text-slate-500">Events</div>
                        <div className="text-lg font-semibold">{selectedStats.total}</div>
                      </div>
                      <div className="rounded-xl border border-slate-100 p-3">
                        <div className="text-xs text-slate-500">Shot goals</div>
                        <div className="text-lg font-semibold">{selectedStats.goals}</div>
                      </div>
                      <div className="rounded-xl border border-slate-100 p-3">
                        <div className="text-xs text-slate-500">
                          <StatTooltipLabel
                            label="Scoring impact"
                            tooltip={PLAYER_TOOLTIPS.scoringImpact}
                            enabled={showTooltips}
                          />
                        </div>
                        <div className="text-lg font-semibold">{selectedStats.scoringImpactPct}%</div>
                      </div>
                      <div className="rounded-xl border border-slate-100 p-3">
                        <div className="text-xs text-slate-500">Events / match</div>
                        <div className="text-lg font-semibold">{selectedEventsPerMatch}</div>
                      </div>
                      <div className="rounded-xl border border-slate-100 p-3">
                        <div className="text-xs text-slate-500">Shots</div>
                        <div className="text-lg font-semibold">{selectedStats.shots}</div>
                      </div>
                      <div className="rounded-xl border border-slate-100 p-3">
                        <div className="text-xs text-slate-500">Personal fouls</div>
                        <div className="text-lg font-semibold">{selectedStats.personalFouls}</div>
                      </div>
                      <div className="rounded-xl border border-slate-100 p-3">
                        <div className="text-xs text-slate-500">
                          <StatTooltipLabel
                            label="Turnover net"
                            tooltip={PLAYER_TOOLTIPS.turnoverNet}
                            enabled={showTooltips}
                          />
                        </div>
                        <div className={`text-lg font-semibold ${selectedStats.turnoverNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {selectedStats.turnoverNet}
                        </div>
                      </div>
                      {showAdvancedMetrics && (
                        <>
                          <div className="rounded-xl border border-slate-100 p-3">
                            <div className="text-xs text-slate-500">
                              <StatTooltipLabel
                                label="Discipline load"
                                tooltip={PLAYER_TOOLTIPS.disciplineLoad}
                                enabled={showTooltips}
                              />
                            </div>
                            <div className="text-lg font-semibold">{selectedStats.disciplineLoad}</div>
                          </div>
                          <div className="rounded-xl border border-slate-100 p-3">
                            <div className="text-xs text-slate-500">Last 5 avg events</div>
                            <div className="text-lg font-semibold">{selectedStats.trend.avgEventsLastFive}</div>
                          </div>
                          <div className="rounded-xl border border-slate-100 p-3">
                            <div className="text-xs text-slate-500">Season avg events</div>
                            <div className="text-lg font-semibold">{selectedStats.trend.avgEventsAll}</div>
                          </div>
                          <div className="rounded-xl border border-slate-100 p-3">
                            <div className="text-xs text-slate-500">Consistency (σ events)</div>
                            <div className="text-lg font-semibold">{selectedStats.trend.eventStdDev}</div>
                          </div>
                        </>
                      )}
                    </div>

                    {showAdvancedMetrics && (
                      <div className="rounded-xl border border-slate-100 p-3 text-sm">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">By Period</div>
                        <div className="space-y-2">
                          {selectedStats.periodRows.map((row) => (
                            <div key={row.period} className="grid grid-cols-5 gap-2 text-xs">
                              <span className="font-semibold text-slate-700">P{row.period}</span>
                              <span className="text-slate-600">{row.total} events</span>
                              <span className="text-slate-600">{row.shotGoals} goals</span>
                              <span className="text-slate-600">{row.personalFouls} p.f.</span>
                              <span className="text-slate-600">{row.ordinaryFouls} ord.</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
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
                  <div className="rounded-xl border border-slate-100 p-3">
                    <div className="text-xs text-slate-500">BMI</div>
                    <div className="text-lg font-semibold">{playerBmi}</div>
                  </div>
                </div>

                {selectedStats && reportSource === 'shotmap' && (
                  <div className="rounded-xl border border-slate-100 p-3 text-sm">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Shots</div>
                    <div className="space-y-2">
                      {selectedStats.recentShots.length === 0 && (
                        <div className="text-xs text-slate-500">No shots in selected scope.</div>
                      )}
                      {selectedStats.recentShots.map((shot) => (
                        <div key={shot.rowId} className="grid grid-cols-[1.3fr_1fr_1fr_1fr] gap-2 text-xs">
                          <span className="truncate font-medium text-slate-700">{shot.matchName}</span>
                          <span className="text-slate-600">P{shot.period} {shot.time}</span>
                          <span className="text-slate-600">Zone {shot.zone}</span>
                          <span className="text-slate-600">{shot.result}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedStats && reportSource === 'scoring' && (
                  <div className="rounded-xl border border-slate-100 p-3 text-sm">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Events</div>
                    <div className="space-y-2">
                      {selectedStats.recentEvents.length === 0 && (
                        <div className="text-xs text-slate-500">No scoring events in selected scope.</div>
                      )}
                      {selectedStats.recentEvents.map((evt) => (
                        <div key={evt.id} className="grid grid-cols-[1.3fr_1fr_1fr] gap-2 text-xs">
                          <span className="truncate font-medium text-slate-700">{evt.matchName}</span>
                          <span className="text-slate-600">P{evt.period} {evt.time}</span>
                          <span className="text-slate-600">{evt.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPlayer.notes && (
                  <div className="rounded-xl border border-slate-100 p-3 text-sm text-slate-600">
                    {selectedPlayer.notes}
                  </div>
                )}
              </div>
            ) : (
              <ModuleEmptyState
                title={data.roster.length ? 'No player selected' : 'No roster yet'}
                description={
                  data.roster.length
                    ? 'Choose a player from the roster to open a report card.'
                    : 'Add players in the Roster module before using report cards.'
                }
                actions={
                  data.roster.length
                    ? []
                    : [
                        {
                          label: 'Open Roster',
                          onClick: () => onOpenModule?.('roster')
                        }
                      ]
                }
              />
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
            {comparePlayerA && comparePlayerB && compareStatsA && compareStatsB && (
              <div className="mt-4 space-y-2 text-sm">
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                  <span>Metric</span>
                  <span className="truncate">#{comparePlayerA.capNumber} {comparePlayerA.name}</span>
                  <span className="truncate">#{comparePlayerB.capNumber} {comparePlayerB.name}</span>
                </div>
                {(reportSource === 'shotmap'
                  ? [
                      {
                        label: 'Shots',
                        a: compareStatsA.total,
                        b: compareStatsB.total,
                        better: 'higher'
                      },
                      {
                        label: 'Goals',
                        a: compareStatsA.goals,
                        b: compareStatsB.goals,
                        better: 'higher'
                      },
                      {
                        label: 'Goal %',
                        a: Number(compareStatsA.goalPct),
                        b: Number(compareStatsB.goalPct),
                        aLabel: `${compareStatsA.goalPct}%`,
                        bLabel: `${compareStatsB.goalPct}%`,
                        better: 'higher'
                      },
                      {
                        label: 'On target %',
                        a: Number(compareStatsA.onTargetPct),
                        b: Number(compareStatsB.onTargetPct),
                        aLabel: `${compareStatsA.onTargetPct}%`,
                        bLabel: `${compareStatsB.onTargetPct}%`,
                        better: 'higher'
                      },
                      {
                        label: 'Avg goal distance',
                        a: Number(compareStatsA.avgDistance) || 0,
                        b: Number(compareStatsB.avgDistance) || 0,
                        aLabel: `${compareStatsA.avgDistance}m`,
                        bLabel: `${compareStatsB.avgDistance}m`,
                        better: 'lower'
                      }
                    ]
                  : [
                      {
                        label: 'Events',
                        a: compareStatsA.total,
                        b: compareStatsB.total,
                        better: 'higher'
                      },
                      {
                        label: 'Goals',
                        a: compareStatsA.goals,
                        b: compareStatsB.goals,
                        better: 'higher'
                      },
                      {
                        label: 'Scoring impact %',
                        a: Number(compareStatsA.scoringImpactPct),
                        b: Number(compareStatsB.scoringImpactPct),
                        aLabel: `${compareStatsA.scoringImpactPct}%`,
                        bLabel: `${compareStatsB.scoringImpactPct}%`,
                        better: 'higher'
                      },
                      {
                        label: 'Turnover net',
                        a: compareStatsA.turnoverNet,
                        b: compareStatsB.turnoverNet,
                        better: 'higher'
                      },
                      {
                        label: 'Discipline load',
                        a: compareStatsA.disciplineLoad,
                        b: compareStatsB.disciplineLoad,
                        better: 'lower'
                      }
                    ]
                ).map((row) => {
                  const aWins =
                    row.better === 'lower' ? row.a < row.b : row.a > row.b;
                  const bWins =
                    row.better === 'lower' ? row.b < row.a : row.b > row.a;
                  return (
                    <div key={row.label} className="grid grid-cols-3 gap-2 rounded-lg border border-slate-100 px-3 py-2">
                      <span className="text-slate-500">{row.label}</span>
                      <span className={`font-semibold ${aWins ? 'text-emerald-700' : 'text-slate-800'}`}>
                        {row.aLabel ?? row.a}
                      </span>
                      <span className={`font-semibold ${bWins ? 'text-emerald-700' : 'text-slate-800'}`}>
                        {row.bLabel ?? row.b}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Team leaderboard (selected scope)</h3>
            {reportSource === 'shotmap' ? (
              <div className="mt-3 space-y-2 text-sm">
                {teamShotLeaders.length === 0 && (
                  <div className="text-xs text-slate-500">No shot data in current scope.</div>
                )}
                {teamShotLeaders.map((player, index) => (
                  <div key={player.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-xs">
                    <span className="font-semibold text-slate-500">#{index + 1}</span>
                    <span className="truncate font-semibold text-slate-700">
                      #{player.capNumber} {player.name}
                    </span>
                    <span className="text-slate-600">{player.goals} goals</span>
                    <span className="text-slate-600">{player.goalPct}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 space-y-2 text-sm">
                {teamScoringLeaders.length === 0 && (
                  <div className="text-xs text-slate-500">No scoring event data in current scope.</div>
                )}
                {teamScoringLeaders.map((player, index) => (
                  <div key={player.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-xs">
                    <span className="font-semibold text-slate-500">#{index + 1}</span>
                    <span className="truncate font-semibold text-slate-700">
                      #{player.capNumber} {player.name}
                    </span>
                    <span className="text-slate-600">{player.goals} goals</span>
                    <span className={`${player.turnoverNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      TO net {player.turnoverNet}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayersView;
