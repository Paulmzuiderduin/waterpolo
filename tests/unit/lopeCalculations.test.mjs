import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getAttendanceStats, getLessonsForWeek, getProgressAverage, getWeekRange } from '../../src/modules/lope-toolkit/calculations.js';

const makeLesson = (overrides = {}) => ({
  date: '2026-03-24',
  attendance: {},
  progress: {},
  ...overrides
});

const students = [
  { id: 's1', name: 'Mila' },
  { id: 's2', name: 'Sam' },
  { id: 's3', name: 'Noa' }
];

const skills = [
  { id: 'basis', label: 'Basisvaardigheid' },
  { id: 'motoriek', label: 'Motoriek' }
];

describe('calculations', () => {
  it('telt aanwezigheid op met default aanwezig', () => {
    const lesson = makeLesson({ attendance: { s2: 'absent', s3: 'late' } });
    const stats = getAttendanceStats(lesson, students);
    assert.equal(stats.present, 1);
    assert.equal(stats.absent, 1);
    assert.equal(stats.late, 1);
    assert.equal(stats.total, 3);
  });

  it('berekent gemiddelde voortgang', () => {
    const lesson = makeLesson({
      progress: {
        s1: { basis: 2, motoriek: 3 },
        s2: { basis: 1, motoriek: 2 }
      }
    });
    const avg = getProgressAverage(lesson, students, skills);
    assert.equal(avg, 2);
  });

  it('filtert lessen op week', () => {
    const lessons = [
      makeLesson({ date: '2026-03-23' }),
      makeLesson({ date: '2026-03-27' }),
      makeLesson({ date: '2026-04-02' })
    ];
    const range = getWeekRange('2026-03-27');
    const filtered = getLessonsForWeek(lessons, '2026-03-27');
    assert.equal(filtered.length, 2);
    assert.ok(new Date(filtered[0].date) >= range.start);
    assert.ok(new Date(filtered[1].date) <= range.end);
  });
});
