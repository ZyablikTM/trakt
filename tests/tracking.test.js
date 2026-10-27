import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, normalizeTrack, isValidTrack, trackStatus } from '../js/logic/tracking.js';
import { CITIES } from '../js/data/cities.js';

const NOW = new Date(Date.UTC(2026, 9, 27, 15, 30));
const NOW_STR = '2026-10-27';

test('STAGES order', () => {
  assert.deepEqual(STAGES, ['accepted', 'warehouse', 'transit', 'arrived', 'delivered']);
});

test('normalizeTrack trims and uppercases', () => {
  assert.equal(normalizeTrack('  tr-2026-0001 '), 'TR-2026-0001');
});

test('isValidTrack', () => {
  assert.equal(isValidTrack('tr-2026-0001'), true);
  assert.equal(isValidTrack(' TR-2026-0001 '), true);
  assert.equal(isValidTrack('TR-26-1'), false);
  assert.equal(isValidTrack('TR-2026-00012'), false);
  assert.equal(isValidTrack(''), false);
  assert.equal(isValidTrack(undefined), false);
});

test('trackStatus is deterministic', () => {
  const a = trackStatus('TR-2026-0001', { now: NOW });
  const b = trackStatus('tr-2026-0001', { now: NOW });
  assert.deepEqual(a, b);
  assert.equal(a.code, 'TR-2026-0001');
});

test('trackStatus shape: from !== to, 5 stages, done count, current date is now', () => {
  const s = trackStatus('TR-2026-0001', { now: NOW });
  assert.notEqual(s.from, s.to);
  assert.ok(CITIES.some((c) => c.id === s.from));
  assert.ok(CITIES.some((c) => c.id === s.to));
  assert.equal(s.stages.length, 5);
  assert.deepEqual(s.stages.map((x) => x.key), STAGES);
  assert.equal(s.stages.filter((x) => x.done).length, s.stageIndex + 1);
  assert.equal(s.stages[s.stageIndex].date, NOW_STR);
  for (const st of s.stages) assert.match(st.date, /^\d{4}-\d{2}-\d{2}$/);
});

test('stage dates are consecutive days', () => {
  const s = trackStatus('TR-2026-0007', { now: NOW });
  for (let i = 1; i < 5; i++) {
    const d = (Date.parse(s.stages[i].date) - Date.parse(s.stages[i - 1].date)) / 86400000;
    assert.equal(d, 1);
  }
});

test('trackStatus returns null for invalid code', () => {
  assert.equal(trackStatus('nope', { now: NOW }), null);
  assert.equal(trackStatus('', { now: NOW }), null);
  assert.equal(trackStatus(null, { now: NOW }), null);
});

test('200 generated codes: from !== to, stageIndex in 0..4', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const code = `TR-${2000 + (i * 7) % 100}-${String(i * 37 % 10000).padStart(4, '0')}`;
    const s = trackStatus(code, { now: NOW });
    assert.ok(s, code);
    assert.notEqual(s.from, s.to, code);
    assert.ok(s.stageIndex >= 0 && s.stageIndex <= 4, code);
    seen.add(s.stageIndex);
  }
  assert.equal(seen.size, 5);
});

test('works with a custom cities list', () => {
  const two = CITIES.slice(0, 2);
  const s = trackStatus('TR-2026-0001', { now: NOW, cities: two });
  assert.notEqual(s.from, s.to);
});
