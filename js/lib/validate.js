export function normalizePhone(s) {
  const d = String(s ?? '').replace(/\D/g, '');
  if (d.length === 11 && (d[0] === '7' || d[0] === '8')) return '+7' + d.slice(1);
  if (d.length === 10 && d[0] === '9') return '+7' + d;
  return null;
}

export function validateName(s) {
  const v = String(s ?? '').trim();
  if (!v) return 'name_required';
  if (v.length > 60) return 'name_too_long';
  return null;
}

export function validateContact(s) {
  const v = String(s ?? '').trim();
  if (!v) return 'contact_required';
  if (normalizePhone(v) || /^@[A-Za-z0-9_]{5,32}$/.test(v)) return null;
  return 'contact_invalid';
}
