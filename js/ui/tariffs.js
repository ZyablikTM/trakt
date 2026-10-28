// Сравнение тарифов: три колонки (в одну на мобильном). Цифры берутся из конфига TARIFFS,
// тексты «что входит» — из словарей. Кнопка выбирает тариф в сторе, а якорь #calc прокручивает к калькулятору.
import { TARIFFS } from '../data/tariffs.js';
import { formatPrice } from '../lib/format.js';

const KEYS = ['economy', 'standard', 'express'];
const POPULAR = 'standard';
const BULLETS = ['a', 'b', 'c'];

function column(key) {
  return `
    <article class="tf-col${key === POPULAR ? ' tf-col--pop' : ''}" data-tariff="${key}" aria-labelledby="tf-${key}-name">
      <p class="tf-flag" data-flag>${key === POPULAR ? '<span data-t="tariffs.popular"></span>' : ''}</p>
      <h3 class="tf-name" id="tf-${key}-name" data-name></h3>
      <p class="tf-speed">
        <span class="sr-only" data-t="tariffs.speedLabel"></span>
        <span class="tf-speed-num" data-speed></span>
      </p>
      <dl class="tf-facts">
        <div class="tf-fact"><dt data-t="tariffs.minLabel"></dt><dd data-min></dd></div>
        <div class="tf-fact"><dt data-t="tariffs.rateLabel"></dt><dd data-rate></dd></div>
      </dl>
      <p class="tf-incl-title" data-t="tariffs.includes"></p>
      <ul class="tf-list">
        ${BULLETS.map((b) => `<li data-bullet="${b}"></li>`).join('')}
      </ul>
      <a class="tf-cta" href="#calc" data-pick="${key}" data-cta>
        <span data-t="tariffs.choose"></span><span class="tf-cta-arrow" aria-hidden="true">→</span>
      </a>
    </article>`;
}

/**
 * @param {HTMLElement} root контейнер #tariffs-grid
 * @param {{ store: any, i18n: any }} deps
 * @returns {() => void} снятие подписок
 */
export function initTariffs(root, { store, i18n }) {
  if (!root) return () => {};

  root.innerHTML = `<div class="tf-grid">${KEYS.map(column).join('')}</div><p class="tf-note" data-t="tariffs.note"></p>`;
  const t = (k, p) => i18n.t(k, p);

  function render() {
    const l = i18n.lang();
    const locale = l === 'en' ? 'en-US' : 'ru-RU';
    const rateFmt = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
    const numFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

    root.querySelectorAll('[data-t]').forEach((n) => { n.textContent = t(n.dataset.t); });
    for (const key of KEYS) {
      const cfg = TARIFFS[key];
      const col = root.querySelector(`[data-tariff="${key}"]`);
      const name = t(`calc.tariffs.${key}`);
      col.querySelector('[data-name]').textContent = name;
      col.querySelector('[data-speed]').textContent = t('tariffs.speed', { n: numFmt.format(cfg.kmPerDay) });
      col.querySelector('[data-min]').textContent = formatPrice(cfg.min, l);
      col.querySelector('[data-rate]').textContent = t('tariffs.rate', { rate: rateFmt.format(cfg.ratePerKgKm) });
      for (const b of BULLETS) col.querySelector(`[data-bullet="${b}"]`).textContent = t(`tariffs.items.${key}.${b}`);
      col.querySelector('[data-cta]').setAttribute('aria-label', t('tariffs.chooseAria', { name }));
    }
  }

  // Тариф ставим до прокрутки: общий обработчик якорей (header.js) отрабатывает следом и уводит к #calc.
  const onClick = (e) => {
    const link = e.target.closest?.('[data-pick]');
    if (!link || !root.contains(link)) return;
    store.set({ tariff: link.dataset.pick });
  };
  root.addEventListener('click', onClick);
  const offLang = i18n.onChange(render);
  render();

  return () => {
    root.removeEventListener('click', onClick);
    offLang();
  };
}
