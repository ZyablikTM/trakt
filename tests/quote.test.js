import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, LINKS } from '../js/data/cities.js';
import { TARIFFS, OPTIONS, LIMITS } from '../js/data/tariffs.js';
import { haversineKm, roadDistanceKm } from '../js/logic/distance.js';
import { quote } from '../js/logic/quote.js';

const byId = (id) => CITIES.find((c) => c.id === id);
const base = { from: 'msk', to: 'kzn', weight: 240, volume: 1.2, tariff: 'standard', options: {} };

test('Moscow–Kazan haversine ≈ 718 km, road distance is plausible', () => {
  const h = haversineKm(byId('msk'), byId('kzn'));
  assert.ok(h > 715 && h < 721, h);
  const d = roadDistanceKm(byId('msk'), byId('kzn'));
  assert.ok(d >= 850 && d <= 950, d);
  assert.equal(d % 10, 0);
  assert.equal(roadDistanceKm(byId('msk'), byId('nnv')), 500);
});

test('standard quote msk→kzn', () => {
  const q = quote(base);
  assert.equal(q.ok, true);
  assert.equal(q.distanceKm, 900);
  assert.equal(q.chargeableWeight, 300);
  assert.equal(q.lines.find((l) => l.key === 'transport').amount, 17200);
  assert.equal(q.total, 17200);
  assert.equal(q.daysMin, 3);
  assert.equal(q.daysMax, 4);
});

test('express is pricier and faster than economy', () => {
  const e = quote({ ...base, tariff: 'economy' });
  const x = quote({ ...base, tariff: 'express' });
  assert.ok(x.total > e.total);
  assert.ok(x.daysMin < e.daysMin);
});

test('minimum order applies', () => {
  assert.equal(quote({ ...base, weight: 1, volume: 0.01, to: 'nnv' }).total >= 3500, true);
  assert.equal(quote({ ...base, weight: 1, volume: 0.01, to: 'nnv' }).total, 3500);
});

test('options add lines', () => {
  const q = quote({ ...base, options: { insurance: true, declaredValue: 200000, packing: true, pickup: true, delivery: true } });
  const amt = (k) => q.lines.find((l) => l.key === k).amount;
  assert.equal(amt('insurance'), 1000);
  assert.equal(amt('packing'), 1080);
  assert.equal(amt('pickup'), 1500);
  assert.equal(amt('delivery'), 1500);
  assert.equal(q.total, 17200 + 1000 + 1080 + 1500 + 1500);
  assert.deepEqual(q.lines.map((l) => l.key), ['transport', 'insurance', 'packing', 'pickup', 'delivery']);
});

test('insurance and packing minimums apply; options off add no lines', () => {
  const q = quote({ ...base, options: { insurance: true, declaredValue: 1000, packing: true } });
  assert.equal(q.lines.find((l) => l.key === 'insurance').amount, 300);
  assert.equal(q.lines.find((l) => l.key === 'packing').amount, 1080);
  const q2 = quote({ ...base, volume: 0.1, options: { packing: true } });
  assert.equal(q2.lines.find((l) => l.key === 'packing').amount, 500);
  assert.deepEqual(quote({ ...base, options: { insurance: false, declaredValue: NaN } }).lines.map((l) => l.key), ['transport']);
});

test('errors', () => {
  assert.deepEqual(quote({ ...base, to: 'msk' }).errors, { to: 'same_city' });
  assert.equal(quote({ ...base, weight: NaN }).errors.weight, 'weight_invalid');
  assert.equal(quote({ ...base, weight: 0 }).errors.weight, 'weight_invalid');
  assert.equal(quote({ ...base, weight: 20001 }).errors.weight, 'weight_too_big');
  assert.equal(quote({ ...base, volume: -1 }).errors.volume, 'volume_invalid');
  assert.equal(quote({ ...base, volume: 82.5 }).errors.volume, 'volume_too_big');
  assert.equal(quote({ ...base, from: 'zzz' }).errors.from, 'unknown_city');
  assert.equal(quote({ ...base, to: 'zzz' }).errors.to, 'unknown_city');
  assert.equal(quote({ ...base, options: { insurance: true, declaredValue: NaN } }).errors.declaredValue, 'declared_value_invalid');
  assert.equal(quote({ ...base, options: { insurance: true } }).errors.declaredValue, 'declared_value_invalid');
  assert.equal(quote({ ...base, options: { insurance: true, declaredValue: -5 } }).errors.declaredValue, 'declared_value_invalid');
  assert.equal(quote({ ...base }).ok, true);
});

test('all field errors are collected at once; never NaN/Infinity', () => {
  const q = quote({ from: 'zzz', to: 'kzn', weight: '', volume: Infinity, tariff: 'standard', options: { insurance: true, declaredValue: 'abc' } });
  assert.equal(q.ok, false);
  assert.deepEqual(q.errors, { from: 'unknown_city', weight: 'weight_invalid', volume: 'volume_invalid', declaredValue: 'declared_value_invalid' });
  assert.equal(quote({ ...base, weight: Infinity }).errors.weight, 'weight_invalid');
  assert.equal(quote({ ...base, weight: 20000, volume: 82 }).ok, true);
});

test('garbage input does not throw', () => {
  for (const bad of [undefined, null, {}, 'x', 5]) {
    const q = quote(bad);
    assert.equal(q.ok, false);
    assert.ok(Object.keys(q.errors).length > 0);
  }
  assert.equal(quote({ ...base, tariff: 'nope' }).ok, false);
  assert.equal(quote({ ...base, options: undefined }).ok, true);
});

test('all amounts are multiples of 10 and totals are finite', () => {
  for (const tariff of Object.keys(TARIFFS)) {
    const q = quote({ ...base, to: 'vvo', weight: 777.7, volume: 3.33, tariff, options: { insurance: true, declaredValue: 123457, packing: true, pickup: true, delivery: true } });
    assert.equal(q.ok, true);
    assert.ok(Number.isFinite(q.total));
    for (const l of q.lines) assert.equal(l.amount % 10, 0, `${tariff}:${l.key}`);
    assert.equal(q.total, q.lines.reduce((s, l) => s + l.amount, 0));
  }
});

test('config constants match the brief', () => {
  assert.deepEqual(TARIFFS.standard, { base: 1000, ratePerKgKm: 0.06, min: 3500, kmPerDay: 600 });
  assert.equal(OPTIONS.pickup.fixed, 1500);
  assert.equal(LIMITS.roadFactor, 1.25);
});

test('cities: enough of them, required ids, unique, coordinates inside viewBox', () => {
  assert.ok(CITIES.length >= 12);
  for (const id of ['msk', 'spb', 'kzn', 'nnv', 'vvo']) assert.ok(byId(id), id);
  assert.equal(new Set(CITIES.map((c) => c.id)).size, CITIES.length);
  assert.deepEqual([byId('msk').lat, byId('msk').lon], [55.7558, 37.6173]);
  assert.deepEqual([byId('vvo').lat, byId('vvo').lon], [43.1155, 131.8855]);
  for (const c of CITIES) {
    assert.ok(c.name.ru && c.name.en, c.id);
    assert.ok(c.x >= 0 && c.x <= 1000 && c.y >= 0 && c.y <= 420, c.id);
  }
  assert.equal(Math.max(...CITIES.map((c) => c.x)), byId('vvo').x);
});

test('LINKS reference existing cities and form a connected graph', () => {
  const ids = new Set(CITIES.map((c) => c.id));
  const adj = new Map([...ids].map((id) => [id, []]));
  for (const [a, b] of LINKS) {
    assert.ok(ids.has(a), `unknown link endpoint ${a}`);
    assert.ok(ids.has(b), `unknown link endpoint ${b}`);
    assert.notEqual(a, b);
    adj.get(a).push(b);
    adj.get(b).push(a);
  }
  const seen = new Set(['msk']);
  const queue = ['msk'];
  while (queue.length) for (const n of adj.get(queue.shift())) if (!seen.has(n)) { seen.add(n); queue.push(n); }
  assert.deepEqual([...ids].filter((id) => !seen.has(id)), []);
});
