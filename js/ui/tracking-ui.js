// Отслеживание груза (демо): форма с номером, маршрут «Город → Город» и вертикальная шкала из 5 этапов.
// Статус считает чистая функция trackStatus (js/logic/tracking.js), здесь только разметка и тексты.
import { CITIES } from '../data/cities.js';
import { isValidTrack, normalizeTrack, trackStatus } from '../logic/tracking.js';

const DEMO_CODE = 'TR-2026-0001';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const TEMPLATE = `
  <div class="tr-form-col">
    <p class="tr-lead" data-t="tracking.lead"></p>
    <form class="tr-form" novalidate>
      <label class="tr-label" for="track-input" data-t="tracking.label"></label>
      <div class="tr-row">
        <input id="track-input" class="tr-input" name="track" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="24" aria-invalid="false" aria-describedby="track-format">
        <button type="submit" class="tr-submit"><span data-t="tracking.submit"></span><span class="tr-submit-arrow" aria-hidden="true">→</span></button>
      </div>
      <p class="tr-format" id="track-format" data-t="tracking.format"></p>
      <p class="tr-err" id="track-err" role="alert" hidden></p>
    </form>
    <button type="button" class="tr-hint" data-hint></button>
  </div>
  <div class="tr-result-col">
    <div id="track-result" class="tr-result" aria-live="polite"></div>
  </div>
`;

/**
 * @param {HTMLElement} root контейнер #track-ui
 * @param {{ i18n: any }} deps
 * @returns {() => void} снятие подписок
 */
export function initTracking(root, { i18n }) {
  if (!root) return () => {};

  root.innerHTML = TEMPLATE;
  const t = (k, p) => i18n.t(k, p);
  const form = root.querySelector('.tr-form');
  const input = root.querySelector('#track-input');
  const err = root.querySelector('#track-err');
  const hint = root.querySelector('[data-hint]');
  const result = root.querySelector('#track-result');

  /** Показанный результат (объект trackStatus) или null; нужен для перерисовки при смене языка. */
  let shown = null;
  let errorShown = false;

  const cityName = (id) => {
    const c = CITIES.find((x) => x.id === id);
    return c ? c.name[i18n.lang()] ?? c.name.ru : id;
  };

  function formatDate(ymd) {
    // 'YYYY-MM-DD' — календарная дата без времени: форматируем в UTC, чтобы пояс не сдвигал день
    const d = new Date(`${ymd}T00:00:00Z`);
    return new Intl.DateTimeFormat(i18n.lang() === 'en' ? 'en-US' : 'ru-RU', {
      day: 'numeric', month: 'long', weekday: 'short', timeZone: 'UTC',
    }).format(d);
  }

  function renderStatic() {
    root.querySelectorAll('[data-t]').forEach((n) => { n.textContent = t(n.dataset.t); });
    input.placeholder = t('tracking.placeholder');
    hint.textContent = t('tracking.hint', { code: DEMO_CODE });
    if (errorShown) err.textContent = t('errors.track_invalid');
  }

  function renderResult(animate) {
    if (!shown) {
      result.innerHTML = `<p class="tr-empty">${esc(t('tracking.empty'))}</p>`;
      return;
    }
    const s = shown;
    const current = s.stages[s.stageIndex];
    const items = s.stages.map((st, i) => {
      const isCurrent = i === s.stageIndex;
      const cls = ['tr-step', st.done ? 'is-done' : 'is-future', isCurrent ? 'is-current' : '', s.stages[i + 1]?.done ? 'is-link-done' : '']
        .filter(Boolean).join(' ');
      const date = formatDate(st.date);
      return `
        <li class="${cls}" style="--i:${i}"${isCurrent ? ' aria-current="step"' : ''}>
          <span class="tr-dot" aria-hidden="true"></span>
          <span class="tr-step-body">
            <span class="tr-stage">${esc(t(`stages.${st.key}`))}${isCurrent ? `<span class="tr-now">${esc(t('tracking.now'))}</span>` : ''}</span>
            <time class="tr-date" datetime="${esc(st.date)}">${esc(st.done ? date : t('tracking.expected', { date }))}</time>
          </span>
        </li>`;
    }).join('');

    result.innerHTML = `
      <div class="tr-card${animate ? ' is-anim' : ''}">
        <p class="tr-code">${esc(s.code)}</p>
        <h3 class="tr-route"><span class="sr-only">${esc(t('tracking.route'))}: </span>${esc(cityName(s.from))}<span class="tr-route-arrow" aria-hidden="true"> → </span><span class="sr-only"> — </span>${esc(cityName(s.to))}</h3>
        <p class="tr-status">${esc(t('tracking.statusNow', { stage: t(`stages.${current.key}`) }))}</p>
        <ol class="tr-steps" aria-label="${esc(t('tracking.timeline'))}">${items}</ol>
      </div>`;
  }

  function setError(on) {
    errorShown = on;
    err.hidden = !on;
    err.textContent = on ? t('errors.track_invalid') : '';
    input.setAttribute('aria-invalid', on ? 'true' : 'false');
    input.setAttribute('aria-describedby', on ? `${err.id} track-format` : 'track-format');
  }

  function submit() {
    const value = normalizeTrack(input.value);
    if (!isValidTrack(value)) {
      shown = null;
      setError(true);
      renderResult(false);
      return;
    }
    setError(false);
    input.value = value;
    shown = trackStatus(value);
    renderResult(true);
  }

  const onSubmit = (e) => { e.preventDefault(); submit(); };
  const onInput = () => { if (errorShown) setError(false); };
  const onHint = () => { input.value = DEMO_CODE; submit(); input.focus(); };
  form.addEventListener('submit', onSubmit);
  input.addEventListener('input', onInput);
  hint.addEventListener('click', onHint);

  const offLang = i18n.onChange(() => { renderStatic(); renderResult(false); });

  renderStatic();
  renderResult(false);

  return () => {
    form.removeEventListener('submit', onSubmit);
    input.removeEventListener('input', onInput);
    hint.removeEventListener('click', onHint);
    offLang();
  };
}
