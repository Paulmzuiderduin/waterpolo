import { normalizeTime } from '../../utils/time';
import { normalizeScoringEventType } from './scoring';

const HEADER_ALIASES = {
  match_name: ['match_name', 'match', 'game', 'wedstrijd'],
  match_date: ['match_date', 'date', 'datum'],
  opponent_name: ['opponent_name', 'opponent', 'tegenstander'],
  event_type: ['event_type', 'event', 'action', 'type'],
  player_cap: ['player_cap', 'cap', 'cap_number', 'player_number', 'playercap'],
  period: ['period', 'quarter', 'q'],
  time: ['time', 'clock'],
  count: ['count', 'amount', 'qty', 'aantal'],
  player: ['player', 'name', 'player_name'],
  shot_goals: ['shot_goals', 'shot_goals_count', 'goals', 'shot goals'],
  shot_saved: ['shot_saved', 'shot_saved_count', 'saved', 'shot saved'],
  shot_missed: ['shot_missed', 'shot_missed_count', 'missed', 'shot missed'],
  exclusion_fouls: ['exclusion_fouls', 'excl_f', 'exclusion fouls'],
  penalty_fouls: ['penalty_fouls', 'pen_f', 'penalty fouls'],
  ordinary_fouls: ['ordinary_fouls', 'ord_f', 'ordinary fouls'],
  turnovers_won: ['turnovers_won', 'to_won', 'turnovers won'],
  turnovers_lost: ['turnovers_lost', 'to_lost', 'turnovers lost'],
  misconducts: ['misconducts', 'misconduct'],
  violent_actions: ['violent_actions', 'violent action'],
  scope: ['scope']
};

const EVENT_TYPE_ALIASES = {
  goal: 'shot_goal',
  goals: 'shot_goal',
  shotgoal: 'shot_goal',
  shot_goal: 'shot_goal',
  shotsaved: 'shot_saved',
  shot_saved: 'shot_saved',
  saved: 'shot_saved',
  shotmissed: 'shot_missed',
  shot_missed: 'shot_missed',
  missed: 'shot_missed',
  exclusion: 'exclusion_foul',
  exclusionfoul: 'exclusion_foul',
  exclusion_foul: 'exclusion_foul',
  penalty: 'penalty_foul',
  penaltyfoul: 'penalty_foul',
  penalty_foul: 'penalty_foul',
  foul: 'ordinary_foul',
  ordinaryfoul: 'ordinary_foul',
  ordinary_foul: 'ordinary_foul',
  misconduct: 'misconduct',
  violentaction: 'violent_action',
  violent_action: 'violent_action',
  turnoverwon: 'turnover_won',
  turnover_won: 'turnover_won',
  won: 'turnover_won',
  turnoverlost: 'turnover_lost',
  turnover_lost: 'turnover_lost',
  lost: 'turnover_lost',
  timeout: 'timeout'
};

const VALID_EVENT_TYPES = new Set([
  'shot_goal',
  'shot_saved',
  'shot_missed',
  'exclusion_foul',
  'penalty_foul',
  'ordinary_foul',
  'misconduct',
  'violent_action',
  'turnover_won',
  'turnover_lost',
  'timeout'
]);

const normalizeHeader = (value = '') =>
  value
    .trim()
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

const normalizeValueToken = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const parseCsvRows = (text = '') => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      row.push(field.trim());
      field = '';
      continue;
    }
    if (char === '\n') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    if (char === '\r') continue;
    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }
  return rows.filter((line) => line.some((cell) => String(cell || '').trim().length > 0));
};

const resolveCanonicalHeaders = (rawHeaders = []) =>
  rawHeaders.map((header) => {
    const normalized = normalizeHeader(header);
    const canonical =
      Object.entries(HEADER_ALIASES).find(([, aliases]) => aliases.includes(normalized))?.[0] || normalized;
    return canonical;
  });

const toCount = (value) => {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  if (Number.isNaN(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 500);
};

const normalizePeriod = (value) => {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^P/, '');
  if (['1', '2', '3', '4', 'OT'].includes(raw)) return raw;
  return '1';
};

const normalizeClock = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '7:00';
  if (/^[0-7]:[0-5][0-9]$/.test(raw)) return normalizeTime(raw);
  if (/^[0-7]\.[0-5][0-9]$/.test(raw)) return normalizeTime(raw.replace('.', ':'));
  return '7:00';
};

const normalizeDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

const parseEventType = (value = '') => {
  const compact = normalizeValueToken(value);
  const aliased = EVENT_TYPE_ALIASES[compact] || EVENT_TYPE_ALIASES[normalizeHeader(value)] || value;
  const normalized = normalizeScoringEventType(String(aliased).trim().toLowerCase().replace(/\s+/g, '_'));
  if (VALID_EVENT_TYPES.has(normalized)) return normalized;
  return '';
};

const expandCountedEvent = (target, baseRow, eventType, count) => {
  for (let i = 0; i < count; i += 1) {
    target.push({ ...baseRow, eventType });
  }
};

const parseScopeMatchName = (scopeValue) => {
  const scopeRaw = String(scopeValue || '').trim();
  if (!scopeRaw) return '';
  if (scopeRaw.toLowerCase().startsWith('match ')) return scopeRaw.slice(6).trim();
  return '';
};

export const parseStatSheetImportCsv = (text) => {
  const rawRows = parseCsvRows(text || '');
  if (rawRows.length < 2) {
    return { events: [], warnings: ['CSV is empty or has no data rows.'] };
  }

  const headers = resolveCanonicalHeaders(rawRows[0]);
  const rows = rawRows.slice(1).map((values, index) => {
    const row = {};
    headers.forEach((header, cellIndex) => {
      row[header] = values[cellIndex] ?? '';
    });
    row.__line = index + 2;
    return row;
  });

  const hasEventColumn = headers.includes('event_type');
  const warnings = [];
  const parsedEvents = [];

  if (hasEventColumn) {
    rows.forEach((row) => {
      const eventType = parseEventType(row.event_type);
      if (!eventType) {
        warnings.push(`Line ${row.__line}: unknown event type "${row.event_type}".`);
        return;
      }
      const base = {
        matchName: String(row.match_name || row.match || 'Imported match').trim() || 'Imported match',
        matchDate: normalizeDate(row.match_date || row.date),
        opponentName: String(row.opponent_name || '').trim(),
        playerCap: String(row.player_cap || '').trim(),
        period: normalizePeriod(row.period),
        time: normalizeClock(row.time)
      };
      expandCountedEvent(parsedEvents, base, eventType, toCount(row.count));
    });
    return { events: parsedEvents, warnings };
  }

  const aggregateColumns = [
    'shot_goals',
    'shot_saved',
    'shot_missed',
    'exclusion_fouls',
    'penalty_fouls',
    'ordinary_fouls',
    'turnovers_won',
    'turnovers_lost',
    'misconducts',
    'violent_actions'
  ];
  const hasAggregateColumns = aggregateColumns.some((column) => headers.includes(column));
  if (!hasAggregateColumns) {
    return {
      events: [],
      warnings: [
        'Unsupported CSV format. Use columns: match_name,event_type,player_cap,period,time,count (recommended).'
      ]
    };
  }

  rows.forEach((row) => {
    const cap = String(row.player_cap || row.cap || '').trim();
    const label = String(row.player || '').trim().toLowerCase();
    if (!cap && label.includes('team total')) return;
    if (!cap) {
      warnings.push(`Line ${row.__line}: missing cap number, skipped.`);
      return;
    }

    const base = {
      matchName:
        String(row.match_name || parseScopeMatchName(row.scope) || 'Imported match').trim() || 'Imported match',
      matchDate: normalizeDate(row.match_date || row.date),
      opponentName: String(row.opponent_name || '').trim(),
      playerCap: cap,
      period: normalizePeriod(row.period),
      time: normalizeClock(row.time)
    };

    const countsByType = [
      ['shot_goal', 'shot_goals'],
      ['shot_saved', 'shot_saved'],
      ['shot_missed', 'shot_missed'],
      ['exclusion_foul', 'exclusion_fouls'],
      ['penalty_foul', 'penalty_fouls'],
      ['ordinary_foul', 'ordinary_fouls'],
      ['turnover_won', 'turnovers_won'],
      ['turnover_lost', 'turnovers_lost'],
      ['misconduct', 'misconducts'],
      ['violent_action', 'violent_actions']
    ];

    countsByType.forEach(([eventType, sourceKey]) => {
      const sourceValue = row[sourceKey];
      const numeric = Number.parseInt(String(sourceValue || '0').trim(), 10);
      if (Number.isNaN(numeric) || numeric <= 0) return;
      expandCountedEvent(parsedEvents, base, eventType, Math.min(numeric, 500));
    });
  });

  return { events: parsedEvents, warnings };
};

export const getStatSheetImportTemplateCsv = () =>
  [
    'match_name,match_date,opponent_name,event_type,player_cap,period,time,count',
    'League Round 1,2026-03-01,Polar Bears,shot_goal,5,1,6:42,1',
    'League Round 1,2026-03-01,Polar Bears,shot_saved,7,1,5:31,1',
    'League Round 1,2026-03-01,Polar Bears,exclusion_foul,3,2,4:10,1',
    'League Round 1,2026-03-01,Polar Bears,timeout,,3,2:15,1'
  ].join('\n');
