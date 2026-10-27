// Детерминированный демо-трекинг: статус посылки выводится из хэша номера.
import { CITIES } from '../data/cities.js';

export const STAGES = ['accepted', 'warehouse', 'transit', 'arrived', 'delivered'];

const TRACK_RE = /^TR-\d{4}-\d{4}$/;
const DAY_MS = 86400000;

export function normalizeTrack(s) {
  return String(s ?? '').trim().toUpperCase();
}

export function isValidTrack(s) {
  return TRACK_RE.test(normalizeTrack(s));
}

// FNV-1a, 32 бита, беззнаковая арифметика.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function ymdUTC(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export function trackStatus(code, { now = new Date(), cities = CITIES } = {}) {
  if (!isValidTrack(code)) return null;
  const norm = normalizeTrack(code);
  const n = cities.length;
  if (n < 2) return null;

  const h = fnv1a(norm);
  const fromIdx = h % n;
  const toIdx = (fromIdx + 1 + ((h >>> 8) % (n - 1))) % n;
  const stageIndex = (h >>> 16) % STAGES.length;

  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const stages = STAGES.map((key, i) => ({
    key,
    date: ymdUTC(base + (i - stageIndex) * DAY_MS),
    done: i <= stageIndex,
  }));

  return { code: norm, from: cities[fromIdx].id, to: cities[toIdx].id, stageIndex, stages };
}
