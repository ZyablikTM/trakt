const locale = (lang) => (lang === 'en' ? 'en-US' : 'ru-RU');

export function formatNumber(n, lang) {
  return new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 0 }).format(n);
}

export function formatPrice(n, lang) {
  return formatNumber(n, lang) + ' ₽';
}

export function parseDecimal(str) {
  if (str === null || str === undefined) return NaN;
  const s = String(str).replace(/[\s ]+/g, '').replace(',', '.');
  if (s === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}
