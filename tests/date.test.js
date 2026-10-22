import test from 'node:test';
import assert from 'node:assert/strict';
import {isISODate, weekStart} from '../shared/date.js';

test('invalid Sheets dates never throw during weekly grouping', () => {
  for (const value of [undefined, null, '', 'not a date', '2026-13-01', '2026-02-30', '2026-1-2']) {
    assert.equal(isISODate(value), false);
    assert.equal(weekStart(value), '');
  }
});

test('calendar validation handles leap years', () => {
  assert.equal(isISODate('2024-02-29'), true);
  assert.equal(isISODate('2026-02-29'), false);
});

test('weekly grouping uses Monday consistently across month and year boundaries', () => {
  assert.equal(weekStart('2026-10-22'), '2026-10-19');
  assert.equal(weekStart('2026-10-25'), '2026-10-19');
  assert.equal(weekStart('2026-10-26'), '2026-10-26');
  assert.equal(weekStart('2026-01-01'), '2025-12-29');
});
