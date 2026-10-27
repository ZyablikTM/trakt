const resolve = (dict, key) => {
  let cur = dict;
  for (const part of String(key).split('.')) {
    if (cur == null || typeof cur !== 'object' || !(part in cur)) return undefined;
    cur = cur[part];
  }
  return typeof cur === 'string' ? cur : undefined;
};

export function createI18n({ dicts, storage, defaultLang = 'ru', key = 'lang' }) {
  const saved = storage ? storage.get(key, null) : null;
  let current = typeof saved === 'string' && dicts[saved] ? saved : defaultLang;
  const listeners = new Set();

  const t = (k, params) => {
    let s = resolve(dicts[current], k);
    if (s === undefined) s = resolve(dicts.ru, k);
    if (s === undefined) return k;
    if (params) s = s.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
    return s;
  };

  return {
    lang: () => current,
    setLang(l) {
      if (!dicts[l]) return;
      current = l;
      if (storage) storage.set(key, l);
      listeners.forEach((fn) => fn(l));
    },
    t,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

// DOM helper (not unit-tested).
export function applyI18n(root, i18n) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = i18n.t(el.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.getAttribute('data-i18n-attr').split(';').forEach((pair) => {
      const idx = pair.indexOf(':');
      if (idx < 1) return;
      const attr = pair.slice(0, idx).trim();
      const k = pair.slice(idx + 1).trim();
      if (attr && k) el.setAttribute(attr, i18n.t(k));
    });
  });
  const doc = root.ownerDocument || (root.nodeType === 9 ? root : null);
  if (doc && doc.documentElement) doc.documentElement.lang = i18n.lang();
}
