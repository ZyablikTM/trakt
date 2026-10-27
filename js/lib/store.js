export function createStore(initial) {
  let state = { ...initial };
  const listeners = new Set();
  return {
    get: () => state,
    set(patchOrFn) {
      const patch = typeof patchOrFn === 'function' ? patchOrFn(state) : patchOrFn;
      const next = { ...state, ...patch };
      const keys = new Set([...Object.keys(state), ...Object.keys(next)]);
      let changed = false;
      for (const k of keys) {
        if (!Object.is(state[k], next[k])) { changed = true; break; }
      }
      if (!changed) return;
      const prev = state;
      state = next;
      [...listeners].forEach((fn) => fn(state, prev));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
