// Таблица «Из чего цена»: строки расчёта, опции-галочки и объявленная стоимость.
// Опции и строка стоимости пишут/читают общий стор, поэтому цена в hero меняется вместе с таблицей.
import { OPTIONS, LIMITS } from '../data/tariffs.js';
import { formatNumber, formatPrice } from '../lib/format.js';
import { prefersReducedMotion } from '../lib/motion.js';
import { getQuote } from '../state.js';

const DASH = '—';
const OPTION_KEYS = ['insurance', 'packing', 'pickup', 'delivery'];


function optionRow(key) {
  const extra = key === 'insurance'
    ? `
      <div class="bd-declared" data-declared hidden>
        <label class="bd-declared-label" for="bd-declared" data-t="breakdown.declared"></label>
        <input id="bd-declared" class="bd-declared-input" name="declaredValue" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" maxlength="14" data-declared-input>
        <p class="bd-err" id="bd-declared-err" data-declared-err hidden></p>
      </div>`
    : '';
  return `
    <tr class="bd-row" data-row="${key}">
      <th scope="row" class="bd-th">
        <label class="bd-check">
          <input type="checkbox" class="bd-check-input" data-opt="${key}" aria-labelledby="bd-${key}-name" aria-describedby="bd-${key}-hint">
          <span class="bd-check-text">
            <span class="bd-name" id="bd-${key}-name" data-t="breakdown.${key}"></span>
            <span class="bd-sub" id="bd-${key}-hint" data-hint="${key}"></span>
          </span>
        </label>${extra}
      </th>
      <td class="bd-amount" data-amount></td>
    </tr>`;
}

const TEMPLATE = `
  <table class="bd-table">
    <caption class="sr-only" data-t="breakdown.caption"></caption>
    <thead class="sr-only">
      <tr><th scope="col" data-t="breakdown.colItem"></th><th scope="col" data-t="breakdown.colAmount"></th></tr>
    </thead>
    <tbody>
      <tr class="bd-row" data-row="transport">
        <th scope="row" class="bd-th">
          <span class="bd-name" data-t="breakdown.transport"></span>
          <span class="bd-sub" data-t="breakdown.transportFormula"></span>
        </th>
        <td class="bd-amount" data-amount></td>
      </tr>
      <tr class="bd-row" data-row="weight">
        <th scope="row" class="bd-th">
          <span class="bd-name" data-t="breakdown.weight"></span>
          <span class="bd-sub" data-weight-formula></span>
        </th>
        <td class="bd-amount" data-amount></td>
      </tr>
      ${OPTION_KEYS.map(optionRow).join('')}
      <tr class="bd-row bd-row--total" data-row="total">
        <th scope="row" class="bd-th"><span class="bd-name" data-t="breakdown.total"></span></th>
        <td class="bd-amount" data-amount></td>
      </tr>
    </tbody>
  </table>
  <div class="bd-actions">
    <a class="bd-cta" href="#order"><span data-t="breakdown.order"></span><span class="bd-cta-arrow" aria-hidden="true">→</span></a>
  </div>
`;

/**
 * @param {HTMLElement} root контейнер #breakdown-table
 * @param {{ store: any, i18n: any }} deps
 * @returns {() => void} снятие подписок
 */
export function initBreakdown(root, { store, i18n }) {
  if (!root) return () => {};

  root.innerHTML = TEMPLATE;
  const q = (sel) => root.querySelector(sel);
  const t = (k, p) => i18n.t(k, p);
  const lang = () => i18n.lang();

  const rows = Object.fromEntries(
    [...root.querySelectorAll('[data-row]')].map((tr) => [tr.dataset.row, { tr, amount: tr.querySelector('[data-amount]') }]),
  );
  const checks = Object.fromEntries(OPTION_KEYS.map((k) => [k, q(`[data-opt="${k}"]`)]));
  const declaredBox = q('[data-declared]');
  const declaredInput = q('[data-declared-input]');
  const declaredErr = q('[data-declared-err]');
  const weightFormula = q('[data-weight-formula]');

  // ── тексты, зависящие от языка (цены в подсказках берутся из конфига) ──
  const percentText = (p) => String(p).replace('.', lang() === 'ru' ? ',' : '.');

  function renderTexts() {
    root.querySelectorAll('[data-t]').forEach((n) => { n.textContent = t(n.dataset.t); });
    const l = lang();
    weightFormula.textContent = t('breakdown.weightFormula', { factor: formatNumber(LIMITS.volumetricFactor, l) });
    q('[data-hint="insurance"]').textContent = t('breakdown.insuranceHint', {
      percent: percentText(OPTIONS.insurance.percent),
      min: formatNumber(OPTIONS.insurance.min, l),
    });
    q('[data-hint="packing"]').textContent = t('breakdown.packingHint', {
      perM3: formatNumber(OPTIONS.packing.perM3, l),
      min: formatNumber(OPTIONS.packing.min, l),
    });
    q('[data-hint="pickup"]').textContent = t('breakdown.pickupHint');
    q('[data-hint="delivery"]').textContent = t('breakdown.deliveryHint');
    declaredInput.placeholder = t('breakdown.declaredPlaceholder');
  }

  // ── значения строк и подсветка изменившихся ──
  const prev = {}; // ключ строки → прошлое число (или null), для подсветки только изменившихся
  const weightFmt = (v) => new Intl.NumberFormat(lang() === 'en' ? 'en-US' : 'ru-RU', { maximumFractionDigits: 2 }).format(v);

  function flash(tr) {
    if (prefersReducedMotion()) return;
    tr.classList.remove('is-flash');
    void tr.offsetWidth; // перезапуск анимации, если строка менялась снова
    tr.classList.add('is-flash');
  }
  root.addEventListener('animationend', (e) => {
    const tr = e.target.closest?.('.bd-row');
    if (tr && e.animationName === 'bd-flash') tr.classList.remove('is-flash');
  });

  // Невалидный расчёт прошлое значение не затирает: после исправления подсвечиваются
  // только строки, чья сумма реально отличается от последней показанной.
  function setRow(key, value, text, valid) {
    const row = rows[key];
    row.amount.textContent = text;
    row.amount.classList.toggle('is-empty', value === null);
    if (!valid) return;
    if (prev[key] !== undefined && prev[key] !== value && value !== null) flash(row.tr);
    prev[key] = value;
  }

  function render() {
    const s = store.get();
    const o = s.options ?? {};
    const quote = getQuote(s);
    const l = lang();
    const lines = quote.ok ? Object.fromEntries(quote.lines.map((ln) => [ln.key, ln.amount])) : {};

    setRow('transport', quote.ok ? lines.transport : null, quote.ok ? formatPrice(lines.transport, l) : DASH, quote.ok);
    setRow(
      'weight',
      quote.ok ? quote.chargeableWeight : null,
      quote.ok ? `${weightFmt(quote.chargeableWeight)} ${t('breakdown.kg')}` : DASH,
      quote.ok,
    );
    for (const k of OPTION_KEYS) {
      const amount = quote.ok && lines[k] !== undefined ? lines[k] : null;
      setRow(k, amount, amount === null ? DASH : formatPrice(amount, l), quote.ok);
      if (checks[k].checked !== Boolean(o[k])) checks[k].checked = Boolean(o[k]);
    }
    setRow('total', quote.ok ? quote.total : null, quote.ok ? formatPrice(quote.total, l) : DASH, quote.ok);

    // объявленная стоимость: поле видно только при включённой страховке
    declaredBox.hidden = !o.insurance;
    if (declaredInput.value !== (o.declaredValue ?? '')) declaredInput.value = o.declaredValue ?? '';
    const code = !quote.ok && o.insurance ? quote.errors.declaredValue : null;
    if (code) {
      declaredErr.textContent = t(`errors.${code}`);
      declaredErr.hidden = false;
      declaredInput.setAttribute('aria-describedby', declaredErr.id);
    } else {
      declaredErr.textContent = '';
      declaredErr.hidden = true;
      declaredInput.removeAttribute('aria-describedby');
    }
    declaredInput.setAttribute('aria-invalid', code ? 'true' : 'false');
  }

  // ── события ──
  const checkHandlers = OPTION_KEYS.map((k) => {
    const h = () => {
      store.set({ options: { ...store.get().options, [k]: checks[k].checked } });
      // включили страховку — сразу в поле суммы, без лишнего клика
      if (k === 'insurance' && checks[k].checked && !declaredBox.hidden) declaredInput.focus();
    };
    checks[k].addEventListener('change', h);
    return [checks[k], h];
  });
  const onDeclared = () => store.set({ options: { ...store.get().options, declaredValue: declaredInput.value } });
  declaredInput.addEventListener('input', onDeclared);

  const offStore = store.subscribe(render);
  const offLang = i18n.onChange(() => { renderTexts(); render(); });

  renderTexts();
  render();

  return () => {
    checkHandlers.forEach(([el, h]) => el.removeEventListener('change', h));
    declaredInput.removeEventListener('input', onDeclared);
    offStore();
    offLang();
  };
}
