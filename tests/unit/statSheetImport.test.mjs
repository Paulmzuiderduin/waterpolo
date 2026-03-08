import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStatSheetImportCsv } from '../../src/lib/waterpolo/statSheetImport.js';
import { buildStatSheet } from '../../src/lib/waterpolo/statSheet.js';

test('parses event-row CSV format', () => {
  const csv = [
    'match_name,match_date,opponent_name,event_type,player_cap,period,time,count',
    'Match A,2026-03-01,Polar,shot_goal,5,1,6:40,2'
  ].join('\n');
  const parsed = parseStatSheetImportCsv(csv);
  assert.equal(parsed.events.length, 2);
  assert.equal(parsed.events[0].eventType, 'shot_goal');
  assert.equal(parsed.events[0].playerCap, '5');
});

test('parses aggregate CSV format', () => {
  const csv = [
    'scope,player,player_cap,shot_goals,shot_saved,shot_missed,exclusion_fouls',
    'Match Demo,#5 Name,5,2,1,0,1'
  ].join('\n');
  const parsed = parseStatSheetImportCsv(csv);
  assert.equal(parsed.events.length, 4);
  const goals = parsed.events.filter((item) => item.eventType === 'shot_goal').length;
  assert.equal(goals, 2);
});

test('buildStatSheet includes per-period goals and shot splits', () => {
  const sheet = buildStatSheet({
    roster: [{ id: 'p1', name: 'A', cap_number: '5' }],
    matches: [{ id: 'm1', name: 'Match', date: '2026-03-01' }],
    events: [
      { match_id: 'm1', event_type: 'shot_goal', player_cap: '5', period: '1' },
      { match_id: 'm1', event_type: 'shot_goal', player_cap: '5', period: '2' }
    ],
    shots: [
      { match_id: 'm1', player_cap: '5', attack_type: '6vs6' },
      { match_id: 'm1', player_cap: '5', attack_type: '6vs5' },
      { match_id: 'm1', player_cap: '5', attack_type: 'strafworp' }
    ],
    scope: 'season'
  });
  assert.equal(sheet.rows[0].goalP1, 1);
  assert.equal(sheet.rows[0].goalP2, 1);
  assert.equal(sheet.rows[0].sixVsSixShots, 1);
  assert.equal(sheet.rows[0].manUpShots, 1);
  assert.equal(sheet.rows[0].penaltyShots, 1);
});
