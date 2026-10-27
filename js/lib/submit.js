export function createSubmitter({ endpoint = null, fetchImpl = globalThis.fetch, delayMs = 800, prefix } = {}) {
  let pending = null;

  const makeId = () => `${prefix}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

  const run = async (payload) => {
    if (payload && payload._hp) return { ok: true, id: makeId() };
    if (endpoint) {
      try {
        const res = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res || !res.ok) return { ok: false, error: 'network' };
        return { ok: true, id: makeId() };
      } catch {
        return { ok: false, error: 'network' };
      }
    }
    await new Promise((r) => setTimeout(r, delayMs));
    return { ok: true, id: makeId() };
  };

  // Plain (non-async) function: returns the SAME promise while one is pending.
  return function submit(payload) {
    if (pending) return pending;
    const p = run(payload);
    pending = p;
    const clear = () => { if (pending === p) pending = null; };
    p.then(clear, clear);
    return p;
  };
}
