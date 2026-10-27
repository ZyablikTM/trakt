// JSON storage with an in-memory fallback. Never throws.
export function createStorage(backend = globalThis.localStorage) {
  const mem = new Map();
  const usable = () => {
    try { return Boolean(backend); } catch { return false; }
  };
  return {
    get(key, fallback = null) {
      if (usable()) {
        try {
          const raw = backend.getItem(key);
          if (raw !== null && raw !== undefined) return JSON.parse(raw);
        } catch {
          // backend threw or JSON invalid: use memory copy if any, else fallback
        }
      }
      return mem.has(key) ? mem.get(key) : fallback;
    },
    set(key, value) {
      mem.set(key, value);
      if (usable()) {
        try { backend.setItem(key, JSON.stringify(value)); } catch { /* memory only */ }
      }
    },
  };
}
