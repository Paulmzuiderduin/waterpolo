import { normalizeScoringEventType } from './scoring.js';

const toDisplayName = (player) => `#${player.cap_number} ${player.name}`;

const createRow = ({ capNumber = '', playerId = '', name = '' }) => ({
  capNumber,
  playerId,
  name,
  matches: new Set(),
  totalEvents: 0,
  shots: 0,
  shotGoals: 0,
  shotSaved: 0,
  shotMissed: 0,
  exclusionFouls: 0,
  penaltyFouls: 0,
  personalFouls: 0,
  ordinaryFouls: 0,
  turnoversWon: 0,
  turnoversLost: 0,
  misconducts: 0,
  violentActions: 0,
  goalP1: 0,
  goalP2: 0,
  goalP3: 0,
  goalP4: 0,
  goalOT: 0,
  sixVsSixShots: 0,
  manUpShots: 0,
  penaltyShots: 0
});

const attachEvent = (bucket, eventType, matchId, period = '') => {
  bucket.totalEvents += 1;
  if (matchId) bucket.matches.add(matchId);

  if (eventType === 'shot_goal') {
    bucket.shotGoals += 1;
    bucket.shots += 1;
    if (period === '1') bucket.goalP1 += 1;
    if (period === '2') bucket.goalP2 += 1;
    if (period === '3') bucket.goalP3 += 1;
    if (period === '4') bucket.goalP4 += 1;
    if (period === 'OT') bucket.goalOT += 1;
  }
  if (eventType === 'shot_saved') {
    bucket.shotSaved += 1;
    bucket.shots += 1;
  }
  if (eventType === 'shot_missed') {
    bucket.shotMissed += 1;
    bucket.shots += 1;
  }
  if (eventType === 'exclusion_foul') bucket.exclusionFouls += 1;
  if (eventType === 'penalty_foul') bucket.penaltyFouls += 1;
  if (eventType === 'ordinary_foul') bucket.ordinaryFouls += 1;
  if (eventType === 'turnover_won') bucket.turnoversWon += 1;
  if (eventType === 'turnover_lost') bucket.turnoversLost += 1;
  if (eventType === 'misconduct') bucket.misconducts += 1;
  if (eventType === 'violent_action') bucket.violentActions += 1;
  bucket.personalFouls = bucket.exclusionFouls + bucket.penaltyFouls;
};

const attachShotSplit = (bucket, attackType) => {
  if (attackType === '6vs6') {
    bucket.sixVsSixShots += 1;
    return;
  }
  if (attackType === '6vs5' || attackType === '6vs4') {
    bucket.manUpShots += 1;
    return;
  }
  if (attackType === 'strafworp') {
    bucket.penaltyShots += 1;
  }
};

const finalizeRow = (row) => ({
  ...row,
  matches: row.matches.size,
  shotPct: row.shots ? ((row.shotGoals / row.shots) * 100).toFixed(1) : '0.0'
});

const compareByCap = (a, b) => {
  const ai = Number(a.capNumber);
  const bi = Number(b.capNumber);
  if (!Number.isNaN(ai) && !Number.isNaN(bi)) return ai - bi;
  return String(a.capNumber).localeCompare(String(b.capNumber));
};

export const buildStatSheet = ({
  roster = [],
  matches = [],
  events = [],
  shots = [],
  scope = 'season',
  matchId = ''
}) => {
  const matchSet =
    scope === 'match' && matchId
      ? new Set([matchId])
      : new Set(matches.map((match) => match.id || match.info?.id).filter(Boolean));

  const normalizedEvents = events
    .map((evt) => ({
      ...evt,
      type: normalizeScoringEventType(evt.event_type || evt.type || ''),
      matchId: evt.match_id || evt.matchId || ''
    }))
    .filter((evt) => !matchSet.size || matchSet.has(evt.matchId));

  const rowsByCap = new Map();
  roster.forEach((player) => {
    if (!player.cap_number) return;
    rowsByCap.set(
      player.cap_number,
      createRow({
        capNumber: player.cap_number,
        playerId: player.id,
        name: toDisplayName(player)
      })
    );
  });

  const teamTotals = {
    ...createRow({ name: 'Team total' }),
    timeouts: 0
  };

  normalizedEvents.forEach((evt) => {
    if (evt.type === 'timeout') {
      teamTotals.timeouts += 1;
      return;
    }
    const cap = evt.player_cap || evt.playerCap || '';
    if (!cap) return;
    if (!rowsByCap.has(cap)) {
      rowsByCap.set(
        cap,
        createRow({
          capNumber: cap,
          name: `#${cap} (not in roster)`
        })
      );
    }
    attachEvent(rowsByCap.get(cap), evt.type, evt.matchId, evt.period);
    attachEvent(teamTotals, evt.type, evt.matchId, evt.period);
  });

  shots
    .map((shot) => ({
      ...shot,
      matchId: shot.match_id || shot.matchId || '',
      playerCap: shot.player_cap || shot.playerCap || '',
      attackType: shot.attack_type || shot.attackType || ''
    }))
    .filter((shot) => !matchSet.size || matchSet.has(shot.matchId))
    .forEach((shot) => {
      if (!shot.playerCap) return;
      if (!rowsByCap.has(shot.playerCap)) {
        rowsByCap.set(
          shot.playerCap,
          createRow({
            capNumber: shot.playerCap,
            name: `#${shot.playerCap} (not in roster)`
          })
        );
      }
      attachShotSplit(rowsByCap.get(shot.playerCap), shot.attackType);
      attachShotSplit(teamTotals, shot.attackType);
    });

  const rows = Array.from(rowsByCap.values())
    .map((row) => finalizeRow(row))
    .sort(compareByCap);
  const total = finalizeRow(teamTotals);

  return {
    rows,
    total,
    summary: {
      scopeMatches: matchSet.size,
      events: total.totalEvents,
      shots: total.shots,
      timeouts: teamTotals.timeouts,
      personalFouls: total.personalFouls
    }
  };
};

export const exportStatSheetCsv = ({ rows = [], total, scopeLabel = 'Season' }) => {
  const header = [
    'Scope',
    'Player',
    'Cap',
    'Matches',
    'Events',
    'Shots',
    'Shot goals',
    'Shot saved',
    'Shot missed',
    'Shot %',
    'Exclusion fouls',
    'Penalty fouls',
    'Personal fouls',
    'Ordinary fouls',
    'Turnovers won',
    'Turnovers lost',
    'Misconduct',
    'Violent action',
    'Goal P1',
    'Goal P2',
    'Goal P3',
    'Goal P4',
    'Goal OT',
    'Shots 6v6',
    'Shots 6v5/6v4',
    'Shots penalty'
  ];

  const table = [header];
  rows.forEach((row) => {
    table.push([
      scopeLabel,
      row.name,
      row.capNumber,
      row.matches,
      row.totalEvents,
      row.shots,
      row.shotGoals,
      row.shotSaved,
      row.shotMissed,
      row.shotPct,
      row.exclusionFouls,
      row.penaltyFouls,
      row.personalFouls,
      row.ordinaryFouls,
      row.turnoversWon,
      row.turnoversLost,
      row.misconducts,
      row.violentActions,
      row.goalP1,
      row.goalP2,
      row.goalP3,
      row.goalP4,
      row.goalOT,
      row.sixVsSixShots,
      row.manUpShots,
      row.penaltyShots
    ]);
  });

  if (total) {
    table.push([
      scopeLabel,
      'Team total',
      '',
      total.matches,
      total.totalEvents,
      total.shots,
      total.shotGoals,
      total.shotSaved,
      total.shotMissed,
      total.shotPct,
      total.exclusionFouls,
      total.penaltyFouls,
      total.personalFouls,
      total.ordinaryFouls,
      total.turnoversWon,
      total.turnoversLost,
      total.misconducts,
      total.violentActions,
      total.goalP1,
      total.goalP2,
      total.goalP3,
      total.goalP4,
      total.goalOT,
      total.sixVsSixShots,
      total.manUpShots,
      total.penaltyShots
    ]);
  }

  const escapeCsvCell = (value) => {
    const cell = String(value ?? '');
    if (/[",\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
    return cell;
  };

  return table.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
};

export const getStatSheetExportTable = ({ rows = [], total, scopeLabel = 'Season' }) => {
  const header = [
    'Scope',
    'Player',
    'Cap',
    'Matches',
    'Events',
    'Shots',
    'Shot goals',
    'Shot saved',
    'Shot missed',
    'Shot %',
    'Exclusion fouls',
    'Penalty fouls',
    'Personal fouls',
    'Ordinary fouls',
    'Turnovers won',
    'Turnovers lost',
    'Misconduct',
    'Violent action',
    'Goal P1',
    'Goal P2',
    'Goal P3',
    'Goal P4',
    'Goal OT',
    'Shots 6v6',
    'Shots 6v5/6v4',
    'Shots penalty'
  ];

  const table = [header];
  rows.forEach((row) => {
    table.push([
      scopeLabel,
      row.name,
      row.capNumber,
      row.matches,
      row.totalEvents,
      row.shots,
      row.shotGoals,
      row.shotSaved,
      row.shotMissed,
      Number(row.shotPct),
      row.exclusionFouls,
      row.penaltyFouls,
      row.personalFouls,
      row.ordinaryFouls,
      row.turnoversWon,
      row.turnoversLost,
      row.misconducts,
      row.violentActions,
      row.goalP1,
      row.goalP2,
      row.goalP3,
      row.goalP4,
      row.goalOT,
      row.sixVsSixShots,
      row.manUpShots,
      row.penaltyShots
    ]);
  });

  if (total) {
    table.push([
      scopeLabel,
      'Team total',
      '',
      total.matches,
      total.totalEvents,
      total.shots,
      total.shotGoals,
      total.shotSaved,
      total.shotMissed,
      Number(total.shotPct),
      total.exclusionFouls,
      total.penaltyFouls,
      total.personalFouls,
      total.ordinaryFouls,
      total.turnoversWon,
      total.turnoversLost,
      total.misconducts,
      total.violentActions,
      total.goalP1,
      total.goalP2,
      total.goalP3,
      total.goalP4,
      total.goalOT,
      total.sixVsSixShots,
      total.manUpShots,
      total.penaltyShots
    ]);
  }

  return table;
};
