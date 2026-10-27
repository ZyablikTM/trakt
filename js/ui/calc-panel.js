// Панель калькулятора: поля, живой расчёт, табло цены и нижняя плашка цены на мобильном.
// Поля пишут сырые строки в стор; расчёт — getQuote(); карта сама следит за from/to через стор.
import { CITIES } from '../data/cities.js';
import { LIMITS, TARIFFS } from '../data/tariffs.js';
import { formatNumber, formatPrice } from '../lib/format.js';
import { animateNumber } from '../lib/ticker.js';
import { getQuote } from '../state.js';

const DASH = '—';
const ANNOUNCE_DELAY = 450; // мс тишины после последнего изменения, затем озвучиваем итог
const FIELD_ORDER = ['from', 'to', 'weight', 'volume', 'tariff'];

/** Склонение для русского: pluralRu(2, ['день','дня','дней']) → 'дня'. */
export function pluralRu(n, forms) {
  const a = Math.abs(Math.trunc(n));
  const m10 = a % 10;
  const m100 = a % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}

const TEMPLATE = `
  <div class="calc-cell">
    <label class="calc-label" for="calc-from" data-t="calc.from"></label>
    <select id="calc-from" class="calc-control calc-select" name="from"></select>
    <p class="calc-err" id="calc-from-err" hidden></p>
  </div>
  <div class="calc-cell">
    <label class="calc-label" for="calc-to" data-t="calc.to"></label>
    <select id="calc-to" class="calc-control calc-select" name="to"></select>
    <p class="calc-err" id="calc-to-err" hidden></p>
  </div>
  <div class="calc-cell calc-cell--half">
    <label class="calc-label" for="calc-weight" data-t="calc.weight"></label>
    <input id="calc-weight" class="calc-control calc-input" name="weight" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" maxlength="12">
    <p class="calc-err" id="calc-weight-err" hidden></p>
  </div>
  <div class="calc-cell calc-cell--half">
    <label class="calc-label" for="calc-volume" data-t="calc.volume"></label>
    <input id="calc-volume" class="calc-control calc-input" name="volume" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" maxlength="12">
    <p class="calc-err" id="calc-volume-err" hidden></p>
  </div>
  <div class="calc-cell calc-cell--tariff">
    <fieldset class="calc-fieldset">
      <legend class="calc-label" data-t="calc.tariff"></legend>
      <div class="calc-seg" role="presentation"></div>
    </fieldset>
    <p class="calc-err" id="calc-tariff-err" hidden></p>
  </div>
  <div class="calc-cell calc-cell--price">
    <p class="calc-price-tag" data-t="calc.price"></p>
    <p class="calc-price" data-price>${DASH}</p>
    <p class="calc-price-meta" data-meta></p>
  </div>
  <p class="sr-only" role="status" aria-live="polite" aria-atomic="true" data-announce></p>
  <div class="calc-bar" data-bar>
    <span class="calc-bar-price" data-bar-price aria-hidden="true">${DASH}</span>
    <a class="calc-bar-cta" href="#order" data-t="calc.order"></a>
  </div>
`;

/**
 * @param {HTMLElement} root контейнер #calc-panel
 * @param {{ store: any, i18n: any }} deps
 * @returns {() => void} снятие подписок
 */
export function initCalcPanel(root, { store, i18n }) {
  if (!root) return () => {};

  root.innerHTML = TEMPLATE;
  root.setAttribute('role', 'group');
  root.classList.add('on-dark');

  const q = (sel) => root.querySelector(sel);
  const fromSel = q('#calc-from');
  const toSel = q('#calc-to');
  const inputs = { weight: q('#calc-weight'), volume: q('#calc-volume') };
  const controls = { from: fromSel, to: toSel, ...inputs };
  const errEls = Object.fromEntries(FIELD_ORDER.map((f) => [f, q(`#calc-${f}-err`)]));
  const seg = q('.calc-seg');
  const priceEl = q('[data-price]');
  const metaEl = q('[data-meta]');
  const priceCell = q('.calc-cell--price');
  const announceEl = q('[data-announce]');
  const bar = q('[data-bar]');
  const barPrice = q('[data-bar-price]');

  const t = (k, p) => i18n.t(k, p);
  const lang = () => i18n.lang();

  // Радиогруппа тарифов: ключи берутся из конфига, подписи — из словаря.
  const radios = Object.keys(TARIFFS).map((key) => {
    const label = document.createElement('label');
    label.className = 'calc-seg-item';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'tariff';
    input.value = key;
    input.className = 'calc-seg-input';
    const text = document.createElement('span');
    text.className = 'calc-seg-text';
    label.append(input, text);
    seg.append(label);
    return { key, input, text };
  });

  // ── тексты, зависящие от языка ──
  function cityName(c) {
    return c.name[lang()] ?? c.name.ru;
  }

  function fillSelect(sel, value) {
    const l = lang();
    const sorted = [...CITIES].sort((a, b) => cityName(a).localeCompare(cityName(b), l));
    sel.textContent = '';
    for (const c of sorted) {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = cityName(c);
      sel.append(o);
    }
    sel.value = value;
  }

  function renderStaticTexts() {
    root.setAttribute('aria-label', t('calc.panelLabel'));
    root.querySelectorAll('[data-t]').forEach((n) => { n.textContent = t(n.dataset.t); });
    for (const r of radios) r.text.textContent = t(`calc.tariffs.${r.key}`);
    const s = store.get();
    fillSelect(fromSel, s.from);
    fillSelect(toSel, s.to);
  }

  // ── форматирование результата ──
  function daysText(min, max) {
    const forms = [t('calc.day.one'), t('calc.day.few'), t('calc.day.many')];
    const unit = lang() === 'ru' ? pluralRu(max, forms) : (max === 1 ? forms[0] : forms[2]);
    return `${min}–${max} ${unit}`;
  }

  function kmText(km) {
    return `${formatNumber(km, lang())} ${t('calc.km')}`;
  }

  function errorText(code) {
    return t(`errors.${code}`, {
      maxWeight: formatNumber(LIMITS.maxWeight, lang()),
      maxVolume: formatNumber(LIMITS.maxVolume, lang()),
    });
  }

  // ── объявление итога для скринридеров (после паузы, без промежуточных значений табло) ──
  let announceTimer = 0;
  function announce(text, { immediate = false } = {}) {
    clearTimeout(announceTimer);
    if (immediate) { announceEl.textContent = text; return; }
    announceTimer = setTimeout(() => { announceEl.textContent = text; }, ANNOUNCE_DELAY);
  }

  // ── вывод результата ──
  let lastTotal = null; // последняя валидная цена: от неё табло тикает после «—»
  let lastQuote = null;

  // Подгон размера цены под ширину красной ячейки: меряем итоговый текст невидимой копией
  // (в самом табло текст во время твина меняется) и ужимаем шрифт, если не помещается.
  const meter = priceEl.cloneNode(false);
  meter.removeAttribute('data-price');
  meter.setAttribute('aria-hidden', 'true');
  meter.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;--price-scale:1';
  priceCell.append(meter);
  let fitText = DASH;

  function fitPrice(text = fitText) {
    fitText = text;
    const cs = getComputedStyle(priceCell);
    const avail = priceCell.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    meter.textContent = text;
    const need = meter.scrollWidth;
    const scale = need > 0 && avail > 0 ? Math.max(0.4, Math.min(1, avail / need)) : 1;
    priceCell.style.setProperty('--price-scale', scale.toFixed(3));
  }

  function renderResult({ immediate = false } = {}) {
    const quote = getQuote(store.get());
    lastQuote = quote;
    const l = lang();
    const fmt = (v) => formatPrice(v, l);
    const wasError = priceCell.classList.contains('is-error');

    // подсветка полей с ошибками
    const errors = quote.ok ? {} : quote.errors;
    for (const f of FIELD_ORDER) {
      const code = errors[f];
      const err = errEls[f];
      const ctl = controls[f];
      if (code) {
        err.textContent = errorText(code);
        err.hidden = false;
      } else {
        err.textContent = '';
        err.hidden = true;
      }
      if (ctl) {
        ctl.setAttribute('aria-invalid', code ? 'true' : 'false');
        if (code) ctl.setAttribute('aria-describedby', err.id);
        else ctl.removeAttribute('aria-describedby');
        ctl.closest('.calc-cell').classList.toggle('has-error', Boolean(code));
      }
    }
    q('.calc-cell--tariff').classList.toggle('has-error', Boolean(errors.tariff));

    if (quote.ok) {
      if (wasError && lastTotal !== null) {
        // выходим из «—»: до первого кадра твина показываем последнюю валидную цену
        priceEl.textContent = fmt(lastTotal);
        barPrice.textContent = fmt(lastTotal);
      }
      priceCell.classList.remove('is-error');
      fitPrice(fmt(quote.total));
      animateNumber(priceEl, quote.total, { format: fmt });
      animateNumber(barPrice, quote.total, { format: fmt });
      lastTotal = quote.total;
      metaEl.textContent = `${daysText(quote.daysMin, quote.daysMax)} · ${kmText(quote.distanceKm)}`;
      announce(t('calc.announce', {
        price: fmt(quote.total),
        days: daysText(quote.daysMin, quote.daysMax),
        km: kmText(quote.distanceKm),
      }), { immediate });
    } else {
      // оборвать идущий твин (animateNumber при duration 0 отменяет кадр), затем показать «—»
      if (lastTotal !== null) {
        animateNumber(priceEl, lastTotal, { duration: 0, format: fmt });
        animateNumber(barPrice, lastTotal, { duration: 0, format: fmt });
      }
      priceCell.classList.add('is-error');
      fitPrice(DASH);
      priceEl.textContent = DASH;
      barPrice.textContent = DASH;
      metaEl.textContent = t('calc.fix');
      const list = FIELD_ORDER.filter((f) => errors[f]).map((f) => errorText(errors[f]));
      // поля вне панели (объявленная стоимость) тоже попадают в сообщение
      for (const [f, code] of Object.entries(errors)) if (!FIELD_ORDER.includes(f)) list.push(errorText(code));
      announce(`${t('calc.announceErr')} ${list.join('. ')}`, { immediate: immediate || !wasError });
    }
  }

  // ── синхронизация полей со стором ──
  function syncControls() {
    const s = store.get();
    if (fromSel.value !== s.from) fromSel.value = s.from;
    if (toSel.value !== s.to) toSel.value = s.to;
    for (const [name, el] of Object.entries(inputs)) {
      if (el.value !== s[name]) el.value = s[name];
    }
    for (const r of radios) r.input.checked = r.key === s.tariff;
    // длинное название обрезается многоточием: полное — во всплывающей подсказке
    fromSel.title = fromSel.selectedOptions[0]?.textContent ?? '';
    toSel.title = toSel.selectedOptions[0]?.textContent ?? '';
  }

  // ── события ──
  const onFrom = () => store.set({ from: fromSel.value });
  const onTo = () => store.set({ to: toSel.value });
  fromSel.addEventListener('change', onFrom);
  toSel.addEventListener('change', onTo);
  const inputHandlers = Object.entries(inputs).map(([name, el]) => {
    const h = () => store.set({ [name]: el.value });
    el.addEventListener('input', h);
    return [el, h];
  });
  const radioHandlers = radios.map((r) => {
    const h = () => { if (r.input.checked) store.set({ tariff: r.key }); };
    r.input.addEventListener('change', h);
    return [r.input, h];
  });

  const offStore = store.subscribe(() => {
    syncControls();
    renderResult();
  });
  const offLang = i18n.onChange(() => {
    renderStaticTexts();
    syncControls();
    renderResult({ immediate: true });
  });

  // ── нижняя плашка цены на мобильном ──
  // Видна, пока на экране #calc или #breakdown, но только если красная ячейка цены в панели
  // не на виду (иначе цена дублировалась бы). Страница получает нижний отступ на время показа.
  const watched = ['calc', 'breakdown'].map((id) => document.getElementById(id)).filter(Boolean);
  const seen = new Map(); // элемент → видим ли
  let io = null;

  function setBar(on) {
    bar.classList.toggle('is-on', on);
    document.body.classList.toggle('has-calc-bar', on);
  }

  function updateBar() {
    const inSection = watched.some((el) => seen.get(el));
    setBar(inSection && !seen.get(priceCell));
  }

  if (typeof IntersectionObserver === 'function' && watched.length) {
    io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        seen.set(e.target, e.target === priceCell ? e.intersectionRatio >= 0.5 : e.isIntersecting);
      }
      updateBar();
    }, { threshold: [0, 0.5, 1] });
    watched.forEach((el) => io.observe(el));
    io.observe(priceCell);
  } else {
    setBar(true); // без IntersectionObserver плашка просто остаётся на экране
  }

  let ro = null;
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => fitPrice());
    ro.observe(priceCell);
  }

  // ── первый показ ──
  renderStaticTexts();
  syncControls();
  renderResult({ immediate: true });

  return () => {
    fromSel.removeEventListener('change', onFrom);
    toSel.removeEventListener('change', onTo);
    inputHandlers.forEach(([el, h]) => el.removeEventListener('input', h));
    radioHandlers.forEach(([el, h]) => el.removeEventListener('change', h));
    offStore();
    offLang();
    io?.disconnect();
    ro?.disconnect();
    meter.remove();
    clearTimeout(announceTimer);
    setBar(false);
  };
}
