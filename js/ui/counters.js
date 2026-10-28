// «Компания в цифрах»: крупные числа с отсчётом от нуля при первом появлении в окне просмотра.
// Значения и подписи: js/data/company.js и словарь numbers.*. При reduced motion числа сразу итоговые.
import { COMPANY_STATS, COUNT_DURATION } from '../data/company.js';
import { formatNumber } from '../lib/format.js';
import { prefersReducedMotion } from '../lib/motion.js';
import { animateNumber } from '../lib/ticker.js';

/**
 * @param {HTMLElement} root контейнер #numbers-grid
 * @param {{ i18n: any }} deps
 * @returns {() => void} снятие подписок
 */
export function initCounters(root, { i18n }) {
  if (!root) return () => {};

  root.innerHTML = COMPANY_STATS.map(
    (s) => `
    <div class="nm-item nm-item--${s.key}" data-stat="${s.key}">
      <p class="nm-num"><span class="sr-only" data-sr></span><span data-count aria-hidden="true"></span></p>
      <p class="nm-label" data-label aria-hidden="true"></p>
    </div>`,
  ).join('');
  root.setAttribute('role', 'group');

  const fmt = (v) => formatNumber(Math.round(v), i18n.lang());
  const items = COMPANY_STATS.map((s) => {
    const el = root.querySelector(`[data-stat="${s.key}"]`);
    return { ...s, el, count: el.querySelector('[data-count]'), done: false };
  });

  function renderText() {
    root.setAttribute('aria-label', i18n.t('numbers.list'));
    for (const it of items) {
      const label = i18n.t(`numbers.${it.key}`);
      it.el.querySelector('[data-label]').textContent = label;
      it.el.querySelector('[data-sr]').textContent = `${fmt(it.value)} ${label}`;
      // Число в процессе отсчёта перерисовываем в новом языке без сброса анимации.
      const cur = Number(it.count.dataset.value);
      it.count.textContent = fmt(Number.isFinite(cur) && it.count.dataset.value !== undefined ? cur : 0);
    }
  }

  const setFinal = (it) => {
    it.done = true;
    animateNumber(it.count, it.value, { duration: 0, format: fmt });
  };

  const offLang = i18n.onChange(renderText);
  renderText();

  const instant = prefersReducedMotion() || typeof IntersectionObserver === 'undefined';
  if (instant) {
    items.forEach(setFinal);
    return offLang;
  }

  // Сначала нули, затем отсчёт при первом пересечении (один раз на число).
  for (const it of items) animateNumber(it.count, 0, { duration: 0, format: fmt });
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const it = items.find((x) => x.el === e.target);
        io.unobserve(e.target);
        if (!it || it.done) continue;
        it.done = true;
        animateNumber(it.count, it.value, { duration: COUNT_DURATION, format: fmt });
      }
    },
    { threshold: 0.4 },
  );
  items.forEach((it) => io.observe(it.el));

  return () => {
    io.disconnect();
    offLang();
  };
}
