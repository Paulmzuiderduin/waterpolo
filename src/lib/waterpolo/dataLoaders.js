import { supabase } from '../supabase';

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
      event_type: 'goal',
      team_side: 'for',
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

export const notifyDataUpdated = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('waterpolo-data-updated'));
};

export const loadTeamData = async (teamId) => {
  if (IS_E2E_SMOKE) {
    return {
      roster: E2E_SAMPLE.roster,
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
  if (!teamId) return { roster: [], matches: [] };
  const [rosterRes, matchRes, shotRes] = await Promise.all([
    supabase.from('roster').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
    supabase.from('matches').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
    supabase.from('shots').select('*').eq('team_id', teamId)
  ]);
  if (rosterRes.error || matchRes.error || shotRes.error) {
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
  return { roster: rosterRes.data || [], matches: Array.from(matchMap.values()) };
};

export const loadTeamScoring = async (teamId) => {
  if (IS_E2E_SMOKE) {
    return {
      roster: E2E_SAMPLE.roster,
      matches: E2E_SAMPLE.matches,
      events: E2E_SAMPLE.events
    };
  }
  if (!teamId) return { roster: [], matches: [], events: [] };
  const [rosterRes, matchRes, eventRes] = await Promise.all([
    supabase.from('roster').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
    supabase.from('matches').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
    supabase.from('scoring_events').select('*').eq('team_id', teamId)
  ]);
  if (rosterRes.error || matchRes.error || eventRes.error) {
    throw new Error('Failed to load scoring data');
  }
  return {
    roster: rosterRes.data || [],
    matches: matchRes.data || [],
    events: eventRes.data || []
  };
};

export const loadTeamPossessions = async (teamId) => {
  if (IS_E2E_SMOKE) {
    return {
      roster: E2E_SAMPLE.roster,
      matches: E2E_SAMPLE.matches,
      possessions: E2E_SAMPLE.possessions,
      passes: E2E_SAMPLE.passes
    };
  }
  if (!teamId) return { roster: [], matches: [], possessions: [], passes: [] };
  const [rosterRes, matchRes, possessionRes, passRes] = await Promise.all([
    supabase.from('roster').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
    supabase.from('matches').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
    supabase.from('possessions').select('*').eq('team_id', teamId),
    supabase.from('passes').select('*').eq('team_id', teamId)
  ]);
  if (rosterRes.error || matchRes.error || possessionRes.error || passRes.error) {
    throw new Error('Failed to load possession data');
  }
  return {
    roster: rosterRes.data || [],
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
    item.events += 1;
    if (evt.event_type === 'goal') item.goals += 1;
    if (evt.event_type === 'exclusion') item.exclusions += 1;
    if (evt.event_type === 'foul') item.fouls += 1;
    if (evt.event_type === 'penalty') item.penalties += 1;
    if (evt.event_type === 'turnover_won') item.turnoversWon += 1;
    if (evt.event_type === 'turnover_lost') item.turnoversLost += 1;
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
