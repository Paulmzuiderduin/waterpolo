export const ZONES = [
  { id: 1, label: '1', left: 0, top: 0, width: 26.67, height: 16 },
  { id: 2, label: '2', left: 26.67, top: 0, width: 46.66, height: 16 },
  { id: 3, label: '3', left: 73.33, top: 0, width: 26.67, height: 16 },
  { id: 4, label: '4', left: 0, top: 16, width: 20, height: 32 },
  { id: 5, label: '5', left: 20, top: 16, width: 20, height: 32 },
  { id: 6, label: '6', left: 40, top: 16, width: 20, height: 32 },
  { id: 7, label: '7', left: 60, top: 16, width: 20, height: 32 },
  { id: 8, label: '8', left: 80, top: 16, width: 20, height: 32 },
  { id: 9, label: '9', left: 0, top: 48, width: 20, height: 52 },
  { id: 10, label: '10', left: 20, top: 48, width: 20, height: 52 },
  { id: 11, label: '11', left: 40, top: 48, width: 20, height: 52 },
  { id: 12, label: '12', left: 60, top: 48, width: 20, height: 52 },
  { id: 13, label: '13', left: 80, top: 48, width: 20, height: 27 },
  { id: 14, label: '14', left: 80, top: 75, width: 20, height: 25 }
];

export const RESULT_COLORS = {
  raak: 'bg-green-500',
  redding: 'bg-orange-400',
  mis: 'bg-red-500'
};

export const ATTACK_TYPES = ['6vs6', '6vs5', '6vs4', 'strafworp'];
export const PERIODS = ['1', '2', '3', '4', 'OT'];
export const PERIOD_ORDER = { '1': 1, '2': 2, '3': 3, '4': 4, OT: 5 };

export const POSSESSION_OUTCOMES = [
  { key: 'goal', label: 'Goal' },
  { key: 'miss', label: 'Miss' },
  { key: 'exclusion', label: 'Exclusion' },
  { key: 'turnover_won', label: 'Turnover won' },
  { key: 'turnover_lost', label: 'Turnover lost' }
];

export const HEAT_TYPES = [
  { key: 'count', label: 'Count', metric: 'count', color: 'viridis' },
  { key: 'success', label: '% Goal', metric: 'success', color: 'viridis' },
  { key: 'save', label: '% Saved', metric: 'save', color: 'viridisReverse' },
  { key: 'miss', label: '% Miss', metric: 'miss', color: 'viridisReverse' },
  { key: 'distance', label: '📏 Distance', metric: 'distance', color: 'none' }
];
