import { supabase } from '../supabase';
import { normalizeScoringEventType } from './scoring';

const IS_E2E_SMOKE = import.meta.env.VITE_E2E_SMOKE === '1';
const E2E_DATE = '2026-01-20';
const E2E_SAMPLE = {
  roster: [
    { id: 'smoke-r1', name: 'Alex Example', cap_number: '1', dominant_hand: 'right', birthday: '2000-01-01' },
    { id: 'smoke-r2', name: 'Sam Demo', cap_number: '5', dominant_hand: 'left', birthday: '2002-06-05' }
  ],
  matches: [{ id: 'smoke-m1', name: 'Demo Match', date: E2E_DATE, opponent_name: 'Test Club' }],
  shots: [
    {
      id: 'smoke-s1',
      match_id: 'smoke-m1',
      x: 42,
      y: 24,
      zone: 6,
      result: 'raak',
      player_cap: '1',
      attack_type: '6vs6',
      period: '1',
      time: '6:21'
    }
  ],
  events: [
    {
      id: 'smoke-e1',
      match_id: 'smoke-m1',
      event_type: 'shot_goal',
      player_cap: '1',
      period: '1',
      time: '6:21',
      created_at: new Date().toISOString()
    }
  ],
  possessions: [
    {
      id: 'smoke-p1',
      match_id: 'smoke-m1',
      outcome: 'goal',
      created_at: new Date().toISOString()
    }
  ],
  passes: [
    {
      id: 'smoke-pass-1',
      match_id: 'smoke-m1',
      possession_id: 'smoke-p1',
      from_player_cap: '1',
      to_player_cap: '5',
      from_x: 30,
      from_y: 70,
      to_x: 50,
      to_y: 45,
      sequence: 1,
      created_at: new Date().toISOString()
    }
  ]
};

const isMissingRelationError = (error) =>
  error?.code === '42P01' ||
  /relation .* does not exist/i.test(error?.message || '') ||
  /could not find .* in the schema cache/i.test(error?.message || '');

const mapTeamPlayerRowsToRoster = (rows) =>
  (rows || []).map((row) => {
    const player = row.players || {};
    return {
      id: row.id,
      team_player_id: row.id,
      player_id: row.player_id,
      team_id: row.team_id,
      user_id: row.user_id || player.user_id || '',
      name: player.name || '',
      cap_number: row.cap_number || '',
      birthday: player.birthday || null,
      height_cm: player.height_cm ?? null,
      weight_kg: player.weight_kg ?? null,
      dominant_hand: player.dominant_hand || null,
      notes: player.notes || '',
      photo_path: player.photo_path || '',
      photo_url: player.photo_url || '',
      created_at: row.created_at
    };
  });

export const loadTeamRoster = async (teamId) => {
  if (IS_E2E_SMOKE) {
    return { roster: E2E_SAMPLE.roster, usesTeamPlayers: false };
  }
  if (!teamId) return { roster: [], usesTeamPlayers: false };

  const teamPlayersRes = await supabase
    .from('team_players')
    .select(
      'id,user_id,team_id,player_id,cap_number,created_at,players(id,user_id,name,birthday,height_cm,weight_kg,dominant_hand,notes,photo_path,photo_url)'
    )
    .eq('team_id', teamId)
    .order('created_at', { ascending: true });

  if (!teamPlayersRes.error) {
    return {
      roster: mapTeamPlayerRowsToRoster(teamPlayersRes.data),
      usesTeamPlayers: true
    };
  }

  if (!isMissingRelationError(teamPlayersRes.error)) {
    throw new Error(`Failed to load team roster: ${teamPlayersRes.error.message || 'unknown error'}`);
  }

  const rosterRes = await supabase
    .from('roster')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true });
  if (rosterRes.error) {
    throw new Error(`Failed to load team roster: ${rosterRes.error.message || 'unknown error'}`);
  }
  const legacy = (rosterRes.data || []).map((row) => ({
    ...row,
    team_player_id: row.id,
    player_id: row.player_id || row.id
  }));
  return { roster: legacy, usesTeamPlayers: false };
};

export const loadTeamLineups = async (teamId) => {
  if (IS_E2E_SMOKE) {
    return {
      lineups: [
        {
          id: 'smoke-lineup-1',
          match_id: 'smoke-m1',
          team_player_id: 'smoke-r1',
          player_id: 'smoke-r1',
          cap_number: '1',
          status: 'playing'
        },
        {
          id: 'smoke-lineup-2',
          match_id: 'smoke-m1',
          team_player_id: 'smoke-r2',
          player_id: 'smoke-r2',
          cap_number: '5',
          status: 'playing'
        }
      ],
      supported: true
    };
  }
  if (!teamId) return { lineups: [], supported: false };

  const lineupRes = await supabase
    .from('match_lineups')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true });

  if (lineupRes.error) {
    if (isMissingRelationError(lineupRes.error)) return { lineups: [], supported: false };
    throw new Error(`Failed to load lineups: ${lineupRes.error.message || 'unknown error'}`);
  }
  return { lineups: lineupRes.data || [], supported: true };
};

export const saveMatchLineup = async ({ matchId, seasonId, teamId, userId, lineupRows = [] }) => {
  if (IS_E2E_SMOKE) return;
  if (!matchId || !seasonId || !teamId || !userId) {
    throw new Error('Missing required lineup context.');
  }

  const { error: deleteError } = await supabase
    .from('match_lineups')
    .delete()
    .eq('match_id', matchId)
    .eq('team_id', teamId);
  if (deleteError) {
    if (isMissingRelationError(deleteError)) {
      throw new Error('match_lineups table is not available yet. Run the DB update first.');
    }
    throw new Error(deleteError.message || 'Failed to reset lineup');
  }

  if (!lineupRows.length) return;

  const payload = lineupRows.map((row) => ({
    user_id: userId,
    season_id: seasonId,
    team_id: teamId,
    match_id: matchId,
    team_player_id: row.team_player_id || row.id,
    player_id: row.player_id || row.id,
    cap_number: row.cap_number || '',
    status: row.status || 'playing'
  }));
  const { error: insertError } = await supabase.from('match_lineups').insert(payload);
  if (insertError) {
    throw new Error(insertError.message || 'Failed to save lineup');
  }
};

export const notifyDataUpdated = () => {
  if (IS_E2E_SMOKE) return;
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('waterpolo-data-updated'));
};

export const loadTeamData = async (teamId) => {
  if (IS_E2E_SMOKE) {
    return {
      roster: E2E_SAMPLE.roster,
      usesTeamPlayers: false,
      matches: E2E_SAMPLE.matches.map((match) => ({
        info: {
          id: match.id,
          name: match.name,
          date: match.date,
          opponent: match.opponent_name || ''
        },
        shots: E2E_SAMPLE.shots
          .filter((shot) => shot.match_id === match.id)
          .map((shot) => ({
            id: shot.id,
            matchId: shot.match_id,
            x: shot.x,
            y: shot.y,
            zone: shot.zone,
            result: shot.result,
            playerCap: shot.player_cap,
            attackType: shot.attack_type,
            time: shot.time,
            period: shot.period
          }))
      }))
    };
  }
  if (!teamId) return { roster: [], usesTeamPlayers: false, matches: [] };
  const [rosterPayload, matchRes, shotRes] = await Promise.all([
    loadTeamRoster(teamId),
    supabase.from('matches').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
    supabase.from('shots').select('*').eq('team_id', teamId)
  ]);
  if (matchRes.error || shotRes.error) {
    throw new Error('Failed to load team data');
  }
  const matchMap = new Map();
  (matchRes.data || []).forEach((match) => {
    matchMap.set(match.id, {
      info: {
        id: match.id,
        name: match.name,
        date: match.date,
        opponent: match.opponent_name || ''
      },
      shots: []
    });
  });
  (shotRes.data || []).forEach((shot) => {
    const target = matchMap.get(shot.match_id);
    if (!target) return;
    target.shots.push({
      id: shot.id,
      matchId: shot.match_id,
      x: shot.x,
      y: shot.y,
      zone: shot.zone,
      result: shot.result,
      playerCap: shot.player_cap,
      attackType: shot.attack_type,
      time: shot.time,
      period: shot.period
    });
  });
  return {
    roster: rosterPayload.roster || [],
    usesTeamPlayers: rosterPayload.usesTeamPlayers,
    matches: Array.from(matchMap.values())
  };
};

export const loadTeamScoring = async (teamId) => {
  if (IS_E2E_SMOKE) {
    return {
      roster: E2E_SAMPLE.roster,
      usesTeamPlayers: false,
      matches: E2E_SAMPLE.matches,
      events: E2E_SAMPLE.events,
      shots: E2E_SAMPLE.shots,
      lineups: [
        {
          id: 'smoke-lineup-1',
          match_id: 'smoke-m1',
          team_player_id: 'smoke-r1',
          player_id: 'smoke-r1',
          cap_number: '1',
          status: 'playing'
        },
        {
          id: 'smoke-lineup-2',
          match_id: 'smoke-m1',
          team_player_id: 'smoke-r2',
          player_id: 'smoke-r2',
          cap_number: '5',
          status: 'playing'
        }
      ]
    };
  }
  if (!teamId) return { roster: [], usesTeamPlayers: false, matches: [], events: [], shots: [], lineups: [] };
  const [rosterPayload, lineupPayload, matchRes, eventRes, shotRes] = await Promise.all([
    loadTeamRoster(teamId),
    loadTeamLineups(teamId),
    supabase.from('matches').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
    supabase.from('scoring_events').select('*').eq('team_id', teamId),
    supabase.from('shots').select('*').eq('team_id', teamId)
  ]);
  if (matchRes.error || eventRes.error || shotRes.error) {
    throw new Error('Failed to load scoring data');
  }
  return {
    roster: rosterPayload.roster || [],
    usesTeamPlayers: rosterPayload.usesTeamPlayers,
    matches: matchRes.data || [],
    events: eventRes.data || [],
    shots: shotRes.data || [],
    lineups: lineupPayload.lineups || [],
    lineupsSupported: lineupPayload.supported
  };
};

export const loadTeamPossessions = async (teamId) => {
  if (IS_E2E_SMOKE) {
    return {
      roster: E2E_SAMPLE.roster,
      usesTeamPlayers: false,
      matches: E2E_SAMPLE.matches,
      possessions: E2E_SAMPLE.possessions,
      passes: E2E_SAMPLE.passes
    };
  }
  if (!teamId) return { roster: [], usesTeamPlayers: false, matches: [], possessions: [], passes: [] };
  const [rosterPayload, matchRes, possessionRes, passRes] = await Promise.all([
    loadTeamRoster(teamId),
    supabase.from('matches').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
    supabase.from('possessions').select('*').eq('team_id', teamId),
    supabase.from('passes').select('*').eq('team_id', teamId)
  ]);
  if (matchRes.error || possessionRes.error || passRes.error) {
    throw new Error('Failed to load possession data');
  }
  return {
    roster: rosterPayload.roster || [],
    usesTeamPlayers: rosterPayload.usesTeamPlayers,
    matches: matchRes.data || [],
    possessions: possessionRes.data || [],
    passes: passRes.data || []
  };
};

export const loadTeamMatchesOverview = async (teamId) => {
  if (IS_E2E_SMOKE) {
    return [
      {
        id: 'smoke-m1',
        name: 'Demo Match',
        date: E2E_DATE,
        opponentName: 'Test Club',
        shots: 1,
        shotGoals: 1,
        shotSaved: 0,
        shotMissed: 0,
        penalties: 0,
        events: 1,
        goals: 1,
        exclusions: 0,
        fouls: 0,
        turnoversWon: 0,
        turnoversLost: 0,
        possessions: 1,
        passes: 1
      }
    ];
  }
  if (!teamId) return [];
  const [matchRes, shotRes, eventRes, possessionRes, passRes] = await Promise.all([
    supabase
      .from('matches')
      .select('*')
      .eq('team_id', teamId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('shots').select('match_id,result').eq('team_id', teamId),
    supabase.from('scoring_events').select('match_id,event_type').eq('team_id', teamId),
    supabase.from('possessions').select('id,match_id').eq('team_id', teamId),
    supabase.from('passes').select('id,match_id').eq('team_id', teamId)
  ]);

  if (matchRes.error || shotRes.error || eventRes.error || possessionRes.error || passRes.error) {
    throw new Error('Failed to load matches overview');
  }

  const byMatch = new Map();
  (matchRes.data || []).forEach((match) => {
    byMatch.set(match.id, {
      id: match.id,
      name: match.name,
      date: match.date,
      opponentName: match.opponent_name || '',
      shots: 0,
      shotGoals: 0,
      shotSaved: 0,
      shotMissed: 0,
      penalties: 0,
      events: 0,
      goals: 0,
      exclusions: 0,
      fouls: 0,
      turnoversWon: 0,
      turnoversLost: 0,
      possessions: 0,
      passes: 0
    });
  });

  (shotRes.data || []).forEach((shot) => {
    const item = byMatch.get(shot.match_id);
    if (!item) return;
    item.shots += 1;
    if (shot.result === 'raak') item.shotGoals += 1;
    if (shot.result === 'redding') item.shotSaved += 1;
    if (shot.result === 'mis') item.shotMissed += 1;
  });

  (eventRes.data || []).forEach((evt) => {
    const item = byMatch.get(evt.match_id);
    if (!item) return;
    const type = normalizeScoringEventType(evt.event_type);
    item.events += 1;
    if (type === 'shot_goal') item.goals += 1;
    if (type === 'exclusion_foul') item.exclusions += 1;
    if (type === 'ordinary_foul') item.fouls += 1;
    if (type === 'penalty_foul') item.penalties += 1;
    if (type === 'turnover_won') item.turnoversWon += 1;
    if (type === 'turnover_lost') item.turnoversLost += 1;
  });

  (possessionRes.data || []).forEach((possession) => {
    const item = byMatch.get(possession.match_id);
    if (!item) return;
    item.possessions += 1;
  });

  (passRes.data || []).forEach((pass) => {
    const item = byMatch.get(pass.match_id);
    if (!item) return;
    item.passes += 1;
  });

  return Array.from(byMatch.values());
};
