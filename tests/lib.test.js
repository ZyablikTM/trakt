import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../js/lib/storage.js';
import { createI18n } from '../js/lib/i18n.js';
import { createStore } from '../js/lib/store.js';
import { formatPrice, parseDecimal } from '../js/lib/format.js';
import { validateContact, validateName, normalizePhone } from '../js/lib/validate.js';
import { createSubmitter } from '../js/lib/submit.js';
import { prefersReducedMotion } from '../js/lib/motion.js';

test('storage falls back to memory when backend throws', () => {
  const bad = { getItem() { throw new Error('x') }, setItem() { throw new Error('x') } };
  const s = createStorage(bad);
  s.set('k', { a: 1 });
  assert.deepEqual(s.get('k', null), { a: 1 });
});
test('storage returns fallback on invalid JSON', () => {
  const s = createStorage({ getItem: () => '{oops', setItem() {} });
  assert.equal(s.get('k', 42), 42);
});
test('storage(null) is memory-only', () => {
  const s = createStorage(null);
  assert.equal(s.get('k', 'fb'), 'fb');
  s.set('k', [1, 2]);
  assert.deepEqual(s.get('k', null), [1, 2]);
});
test('createStorage() does not throw when globalThis.localStorage getter throws', () => {
  const orig = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('SecurityError'); },
  });
  try {
    let s;
    assert.doesNotThrow(() => { s = createStorage(); });
    s.set('k', { a: 1 });
    assert.deepEqual(s.get('k', null), { a: 1 });
    assert.equal(s.get('missing', 'fb'), 'fb');
  } finally {
    if (orig) Object.defineProperty(globalThis, 'localStorage', orig);
    else delete globalThis.localStorage;
  }
});
test('storage round-trips through a working backend', () => {
  const m = new Map();
  const s = createStorage({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) });
  s.set('k', { x: 1 });
  assert.equal(m.get('k'), '{"x":1}');
  assert.deepEqual(s.get('k', null), { x: 1 });
});
test('i18n interpolates, falls back to ru, then to key', () => {
  const i = createI18n({ dicts: { ru: { a: { b: 'Привет, {name}' }, only: 'ру' }, en: { a: { b: 'Hi, {name}' } } }, storage: createStorage(null) });
  assert.equal(i.t('a.b', { name: 'Ян' }), 'Привет, Ян');
  i.setLang('en');
  assert.equal(i.t('a.b', { name: 'Jan' }), 'Hi, Jan');
  assert.equal(i.t('only'), 'ру');
  assert.equal(i.t('missing.key'), 'missing.key');
  i.setLang('de'); assert.equal(i.lang(), 'en');
});
test('i18n persists lang and notifies listeners', () => {
  const storage = createStorage(null);
  const i = createI18n({ dicts: { ru: { a: 'а' }, en: { a: 'a' } }, storage });
  let seen = null;
  i.onChange((l) => { seen = l; });
  i.setLang('en');
  assert.equal(seen, 'en');
  assert.equal(storage.get('lang', null), 'en');
  const j = createI18n({ dicts: { ru: { a: 'а' }, en: { a: 'a' } }, storage });
  assert.equal(j.lang(), 'en');
});
test('i18n ignores an inherited key (constructor) in storage', () => {
  const storage = createStorage(null);
  storage.set('lang', 'constructor');
  const i = createI18n({ dicts: { ru: { a: 'а' }, en: { a: 'a' } }, storage });
  assert.equal(i.lang(), 'ru');
});
test('i18n setLang ignores an inherited key (toString)', () => {
  const i = createI18n({ dicts: { ru: { a: 'а' }, en: { a: 'a' } }, storage: createStorage(null) });
  i.setLang('toString');
  assert.equal(i.lang(), 'ru');
});
test('store notifies only on change', () => {
  const st = createStore({ a: 1 }); let n = 0; st.subscribe(() => n++);
  st.set({ a: 1 }); st.set({ a: 2 }); assert.equal(n, 1);
});
test('store supports fn patch, (state, prev) args and unsubscribe', () => {
  const st = createStore({ a: 1, b: 1 }); const calls = [];
  const off = st.subscribe((s, p) => calls.push([s, p]));
  st.set((s) => ({ a: s.a + 1 }));
  assert.deepEqual(st.get(), { a: 2, b: 1 });
  assert.deepEqual(calls[0], [{ a: 2, b: 1 }, { a: 1, b: 1 }]);
  off(); st.set({ a: 5 });
  assert.equal(calls.length, 1);
});
test('formatPrice / parseDecimal', () => {
  assert.equal(formatPrice(14820, 'ru').replace(/\s/g, ' '), '14 820 ₽');
  assert.equal(formatPrice(14820, 'en'), '14,820\u00A0₽');
  assert.equal(parseDecimal('1,5'), 1.5);
  assert.equal(parseDecimal(' 240 '), 240);
  assert.ok(Number.isNaN(parseDecimal('')));
  assert.ok(Number.isNaN(parseDecimal('abc')));
});
test('validateContact accepts real formats', () => {
  for (const ok of ['+7 (999) 123-45-67', '8 999 123 45 67', '9991234567', '@ivan_petrov']) assert.equal(validateContact(ok), null, ok);
  assert.equal(validateContact('12345'), 'contact_invalid');
  assert.equal(validateContact('@ab'), 'contact_invalid');
  assert.equal(validateContact('  '), 'contact_required');
  assert.equal(normalizePhone('8 (999) 123-45-67'), '+79991234567');
  assert.equal(validateName('А'.repeat(61)), 'name_too_long');
});
test('validateName basics', () => {
  assert.equal(validateName('  '), 'name_required');
  assert.equal(validateName('Иван'), null);
  assert.equal(validateName('А'.repeat(60)), null);
});
test('submitter dedupes pending, honours honeypot, maps errors', async () => {
  let calls = 0;
  const sub = createSubmitter({ prefix: 'TR', delayMs: 10 });
  const p1 = sub({ name: 'a' }); const p2 = sub({ name: 'a' });
  assert.equal(p1, p2);
  const r = await p1; assert.equal(r.ok, true); assert.match(r.id, /^TR-\d{4}$/);
  const net = createSubmitter({ prefix: 'TR', endpoint: 'https://x', fetchImpl: async () => { calls++; return { ok: false }; } });
  assert.deepEqual(await net({ name: 'a' }), { ok: false, error: 'network' });
  await net({ name: 'a', _hp: 'bot' }); assert.equal(calls, 1);
});
test('submitter maps thrown fetch to network error and allows a new submit after settle', async () => {
  const net = createSubmitter({ prefix: 'TR', endpoint: 'https://x', fetchImpl: async () => { throw new Error('down'); } });
  assert.deepEqual(await net({ name: 'a' }), { ok: false, error: 'network' });
  const ok = createSubmitter({ prefix: 'TR', delayMs: 1 });
  const a = await ok({}); const bp = ok({});
  assert.notEqual(bp, undefined);
  assert.equal((await bp).ok, true); assert.equal(a.ok, true);
});
test('prefersReducedMotion is safe without matchMedia', () => {
  assert.equal(prefersReducedMotion(), false);
});
