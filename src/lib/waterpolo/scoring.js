export const LEGACY_SCORING_EVENT_ALIASES = {
  goal: 'shot_goal',
  exclusion: 'exclusion_foul',
  foul: 'ordinary_foul',
  penalty: 'penalty_foul'
};

export const SCORING_EVENTS = [
  { key: 'shot_goal', label: 'Shot goal', player: true, color: 'bg-emerald-600', group: 'shots' },
  { key: 'shot_saved', label: 'Shot saved', player: true, color: 'bg-amber-500', group: 'shots' },
  { key: 'shot_missed', label: 'Shot missed', player: true, color: 'bg-rose-500', group: 'shots' },
  {
    key: 'exclusion_foul',
    label: 'Exclusion foul',
    player: true,
    color: 'bg-yellow-500',
    group: 'discipline'
  },
  {
    key: 'penalty_foul',
    label: 'Penalty foul',
    player: true,
    color: 'bg-indigo-600',
    group: 'discipline'
  },
  {
    key: 'ordinary_foul',
    label: 'Ordinary foul',
    player: true,
    color: 'bg-orange-500',
    group: 'discipline'
  },
  {
    key: 'misconduct',
    label: 'Misconduct',
    player: true,
    color: 'bg-fuchsia-700',
    group: 'discipline'
  },
  {
    key: 'violent_action',
    label: 'Violent action',
    player: true,
    color: 'bg-red-800',
    group: 'discipline'
  },
  { key: 'turnover_won', label: 'Turnover won', player: true, color: 'bg-sky-600', group: 'possession' },
  { key: 'turnover_lost', label: 'Turnover lost', player: true, color: 'bg-slate-700', group: 'possession' },
  { key: 'timeout', label: 'Timeout', player: false, color: 'bg-slate-500', group: 'team' }
];

export const SCORING_EVENT_MAP = Object.fromEntries(SCORING_EVENTS.map((event) => [event.key, event]));

export const normalizeScoringEventType = (type) => LEGACY_SCORING_EVENT_ALIASES[type] || type;

export const getScoringEventMeta = (type) =>
  SCORING_EVENT_MAP[normalizeScoringEventType(type)] || {
    key: normalizeScoringEventType(type),
    label: normalizeScoringEventType(type).replace(/_/g, ' '),
    player: true,
    color: 'bg-slate-600',
    group: 'misc'
  };

export const createEmptyScoringTotals = () => ({
  shot_goal: 0,
  shot_saved: 0,
  shot_missed: 0,
  exclusion_foul: 0,
  penalty_foul: 0,
  ordinary_foul: 0,
  misconduct: 0,
  violent_action: 0,
  turnover_won: 0,
  turnover_lost: 0,
  timeout: 0
});

export const createEmptyPlayerScoringStats = () => ({
  shotGoals: 0,
  shotSaved: 0,
  shotMissed: 0,
  shots: 0,
  exclusionFouls: 0,
  penaltyFouls: 0,
  ordinaryFouls: 0,
  personalFouls: 0,
  misconducts: 0,
  violentActions: 0,
  turnoversWon: 0,
  turnoversLost: 0
});
