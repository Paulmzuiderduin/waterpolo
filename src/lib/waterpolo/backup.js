import { exportStatSheetCsv, buildStatSheet } from './statSheet';

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const toCsv = (headers, rows) => [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');

export const createTeamBackupBundle = ({ seasonName, teamName, roster, matches, shots, events, possessions, passes }) => {
  const timestamp = new Date().toISOString();
  const statSheet = buildStatSheet({ roster, matches, events, shots, scope: 'season' });

  const matchesCsv = toCsv(
    ['id', 'name', 'date', 'opponent_name'],
    (matches || []).map((match) => [match.id, match.name, match.date, match.opponent_name || ''])
  );
  const rosterCsv = toCsv(
    ['id', 'name', 'cap_number', 'birthday', 'dominant_hand'],
    (roster || []).map((player) => [player.id, player.name, player.cap_number, player.birthday || '', player.dominant_hand || ''])
  );
  const shotsCsv = toCsv(
    ['id', 'match_id', 'player_cap', 'result', 'attack_type', 'zone', 'period', 'time'],
    (shots || []).map((shot) => [
      shot.id,
      shot.match_id,
      shot.player_cap,
      shot.result,
      shot.attack_type,
      shot.zone,
      shot.period,
      shot.time
    ])
  );
  const scoringCsv = toCsv(
    ['id', 'match_id', 'event_type', 'player_cap', 'period', 'time'],
    (events || []).map((evt) => [evt.id, evt.match_id, evt.event_type, evt.player_cap || '', evt.period, evt.time])
  );

  return {
    metadata: {
      generatedAt: timestamp,
      seasonName,
      teamName
    },
    roster: roster || [],
    matches: matches || [],
    shots: shots || [],
    scoringEvents: events || [],
    possessions: possessions || [],
    passes: passes || [],
    csv: {
      roster: rosterCsv,
      matches: matchesCsv,
      shots: shotsCsv,
      scoringEvents: scoringCsv,
      statSheet: exportStatSheetCsv({ rows: statSheet.rows, total: statSheet.total, scopeLabel: 'Season' })
    }
  };
};

export const downloadBackupBundle = (bundle) => {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  const seasonToken = String(bundle.metadata?.seasonName || 'season').toLowerCase().replace(/\s+/g, '-');
  const teamToken = String(bundle.metadata?.teamName || 'team').toLowerCase().replace(/\s+/g, '-');
  anchor.href = url;
  anchor.download = `waterpolo-backup-${seasonToken}-${teamToken}-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};
