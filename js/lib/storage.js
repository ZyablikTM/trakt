// JSON storage with an in-memory fallback. Never throws.
// Pass `null` (or any falsy backend) for a memory-only store.
export function createStorage(backend) {
  if (backend === undefined) {
    // Reading window.localStorage itself can throw (SecurityError, blocked site data).
    try { backend = globalThis.localStorage; } catch { backend = null; }
  }
  const mem = new Map();
  return {
    get(key, fallback = null) {
      if (backend) {
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
      if (backend) {
        try { backend.setItem(key, JSON.stringify(value)); } catch { /* memory only */ }
      }
    },
  };
}
