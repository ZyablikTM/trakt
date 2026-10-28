// Заявка: форма (имя, телефон/Telegram, комментарий), блок «Ваш расчёт» из калькулятора и состояние «принято».
// Отправка имитируется (createSubmitter); с author.submitEndpoint уходит POST-запросом.
import author from '../data/author.js';
import { CITIES } from '../data/cities.js';
import { formatPrice, parseDecimal } from '../lib/format.js';
import { createSubmitter } from '../lib/submit.js';
import { animateNumber } from '../lib/ticker.js';
import { normalizePhone, validateContact, validateName } from '../lib/validate.js';
import { getQuote } from '../state.js';

const OPTION_KEYS = ['insurance', 'packing', 'pickup', 'delivery'];

const TEMPLATE = `
  <div class="of-form-col">
    <form class="of-form" novalidate>
      <p class="of-lead" data-t="order.lead"></p>

      <div class="of-field">
        <label class="of-label" for="of-name" data-t="order.name"></label>
        <input id="of-name" class="of-input" name="name" type="text" autocomplete="name" maxlength="200" aria-invalid="false" data-ph="order.namePlaceholder">
        <p class="of-err" id="of-name-err" hidden></p>
      </div>

      <div class="of-field">
        <label class="of-label" for="of-contact" data-t="order.contact"></label>
        <input id="of-contact" class="of-input" name="contact" type="text" autocomplete="tel" inputmode="text" maxlength="64" aria-invalid="false" data-ph="order.contactPlaceholder">
        <p class="of-err" id="of-contact-err" hidden></p>
      </div>

      <div class="of-field">
        <label class="of-label" for="of-comment"><span data-t="order.comment"></span> <span class="of-opt" data-t="order.optional"></span></label>
        <textarea id="of-comment" class="of-input of-textarea" name="comment" rows="4" maxlength="1000" data-ph="order.commentPlaceholder"></textarea>
      </div>

      <div class="of-hp" aria-hidden="true">
        <label for="of-hp"><span data-t="order.honeypot"></span></label>
        <input id="of-hp" name="_hp" type="text" tabindex="-1" autocomplete="off">
      </div>

      <p class="of-err of-err--net" id="of-net-err" role="alert" hidden></p>

      <button type="submit" class="of-submit">
        <span class="of-submit-text" data-submit-text></span>
        <span class="of-spin" aria-hidden="true" hidden></span>
        <span class="of-submit-arrow" aria-hidden="true">→</span>
      </button>
    </form>

    <div class="of-done" tabindex="-1" hidden>
      <p class="of-done-mark" aria-hidden="true"></p>
      <h3 class="of-done-title" data-done-title></h3>
      <p class="of-done-text" data-done-text></p>
      <p class="of-done-contact" data-done-contact></p>
      <button type="button" class="of-again" data-again><span data-t="order.again"></span></button>
    </div>
  </div>

  <aside class="of-sum on-dark" aria-labelledby="of-sum-title">
    <h3 class="of-sum-title" id="of-sum-title" data-t="order.sumTitle"></h3>
    <div data-sum-ok>
      <dl class="of-sum-list">
        <div class="of-sum-row"><dt data-t="order.sumRoute"></dt><dd data-sum="route"></dd></div>
        <div class="of-sum-row"><dt data-t="order.sumLoad"></dt><dd data-sum="load"></dd></div>
        <div class="of-sum-row"><dt data-t="order.sumTariff"></dt><dd data-sum="tariff"></dd></div>
        <div class="of-sum-row"><dt data-t="order.sumOptions"></dt><dd data-sum="options"></dd></div>
      </dl>
      <p class="of-sum-total"><span class="of-sum-total-label" data-t="order.sumTotal"></span><span class="of-sum-total-num" data-sum="total"></span></p>
      <p class="of-sum-note" data-t="order.sumNote"></p>
    </div>
    <div class="of-sum-bad" data-sum-bad hidden>
      <p class="of-sum-bad-text" data-t="order.sumInvalid"></p>
      <a class="of-sum-link" href="#calc"><span data-t="order.sumInvalidLink"></span><span aria-hidden="true"> →</span></a>
    </div>
  </aside>
`;

/**
 * @param {HTMLElement} root контейнер #order-ui
 * @param {{ store: any, i18n: any, submitter?: Function }} deps
 * @returns {() => void} снятие подписок
 */
export function initOrderForm(root, { store, i18n, submitter } = {}) {
  if (!root) return () => {};

  root.innerHTML = TEMPLATE;
  const t = (k, p) => i18n.t(k, p);
  const q = (sel) => root.querySelector(sel);
  const submit = submitter ?? createSubmitter({ prefix: 'TR', endpoint: author.submitEndpoint ?? null });

  const form = q('.of-form');
  const nameEl = q('#of-name');
  const contactEl = q('#of-contact');
  const commentEl = q('#of-comment');
  const hpEl = q('#of-hp');
  const btn = q('.of-submit');
  const spin = q('.of-spin');
  const netErr = q('#of-net-err');
  const done = q('.of-done');
  const sumOk = q('[data-sum-ok]');
  const sumBad = q('[data-sum-bad]');
  const totalEl = q('[data-sum="total"]');

  const fields = {
    name: { input: nameEl, err: q('#of-name-err'), code: null },
    contact: { input: contactEl, err: q('#of-contact-err'), code: null },
  };

  let busy = false;
  let netFailed = false;
  let doneInfo = null; // { id, contact }, пока показано «принято»

  /* ── тексты ───────────────────────────── */
  function renderDone() {
    // Номер в одном неразрывном фрагменте: «TR-2774» не должен переноситься по дефису.
    const [pre, post = ''] = t('order.doneTitle', { id: '' }).split('');
    const title = q('[data-done-title]');
    const idEl = document.createElement('span');
    idEl.className = 'of-done-id';
    idEl.textContent = doneInfo.id;
    title.replaceChildren(pre, idEl, post);
    q('[data-done-text]').textContent = t('order.doneText');
    q('[data-done-contact]').textContent = t('order.doneContact', { contact: doneInfo.contact });
  }

  function renderStatic() {
    root.querySelectorAll('[data-t]').forEach((n) => { n.textContent = t(n.dataset.t); });
    root.querySelectorAll('[data-ph]').forEach((n) => { n.placeholder = t(n.dataset.ph); });
    q('[data-submit-text]').textContent = t(busy ? 'order.sending' : 'order.submit');
    for (const f of Object.values(fields)) if (f.code) f.err.textContent = t(`errors.${f.code}`);
    if (netFailed) netErr.textContent = t('order.errNetwork');
    if (doneInfo) renderDone();
  }

  /* ── ошибки полей ─────────────────────── */
  function setFieldError(name, code) {
    const f = fields[name];
    f.code = code;
    f.err.hidden = !code;
    f.err.textContent = code ? t(`errors.${code}`) : '';
    f.input.setAttribute('aria-invalid', code ? 'true' : 'false');
    if (code) f.input.setAttribute('aria-describedby', f.err.id);
    else f.input.removeAttribute('aria-describedby');
  }

  function setNetError(on) {
    netFailed = on;
    netErr.hidden = !on;
    netErr.textContent = on ? t('order.errNetwork') : '';
  }

  /* ── блок «Ваш расчёт» ────────────────── */
  const num = (v, l) => new Intl.NumberFormat(l === 'en' ? 'en-US' : 'ru-RU', { maximumFractionDigits: 2 }).format(v);
  const cityName = (id, l) => {
    const c = CITIES.find((x) => x.id === id);
    return c ? c.name[l] ?? c.name.ru : id;
  };
  const optionKeys = (qt) => qt.lines.filter((ln) => OPTION_KEYS.includes(ln.key)).map((ln) => ln.key);

  function renderSummary(animate) {
    const s = store.get();
    const qt = getQuote(s);
    const l = i18n.lang();
    sumOk.hidden = !qt.ok;
    sumBad.hidden = qt.ok;
    if (!qt.ok) return; // при ошибках в калькуляторе цифр нет: ни NaN, ни устаревших значений

    const set = (k, v) => { q(`[data-sum="${k}"]`).textContent = v; };
    set('route', `${cityName(s.from, l)} → ${cityName(s.to, l)}`);
    set('load', `${num(parseDecimal(s.weight), l)} ${t('order.sumKg')} · ${num(parseDecimal(s.volume), l)} ${t('order.sumM3')}`);
    set('tariff', t(`calc.tariffs.${s.tariff}`));
    const opts = optionKeys(qt).map((k) => t(`breakdown.${k}`));
    set('options', opts.length ? opts.join(', ') : t('order.sumNoOptions'));
    animateNumber(totalEl, qt.total, { duration: animate ? 400 : 0, format: (v) => formatPrice(Math.round(v), i18n.lang()) });
  }

  /* ── отправка ─────────────────────────── */
  function buildPayload(name, contact, comment) {
    const s = store.get();
    const qt = getQuote(s);
    return {
      name: name.trim(),
      contact: normalizePhone(contact) ?? contact.trim(),
      comment: comment.trim(),
      quote: qt.ok
        ? {
            from: cityName(s.from, 'ru'),
            to: cityName(s.to, 'ru'),
            weight: parseDecimal(s.weight),
            volume: parseDecimal(s.volume),
            tariff: s.tariff,
            options: optionKeys(qt),
            total: qt.total,
          }
        : null,
      lang: i18n.lang(),
      _hp: hpEl.value,
    };
  }

  function setBusy(on) {
    busy = on;
    btn.disabled = on;
    spin.hidden = !on;
    form.setAttribute('aria-busy', on ? 'true' : 'false');
    q('[data-submit-text]').textContent = t(on ? 'order.sending' : 'order.submit');
  }

  function finish(res, payload) {
    setBusy(false);
    if (!res || !res.ok) {
      setNetError(true);
      btn.focus();
      return;
    }
    doneInfo = { id: res.id, contact: payload.contact };
    renderDone();
    form.hidden = true;
    done.hidden = false;
    done.focus();
  }

  function onSubmit(e) {
    e.preventDefault();
    if (busy) return; // второй клик/Enter во время отправки игнорируется (и submitter отдаёт тот же promise)

    const nameCode = validateName(nameEl.value);
    const contactCode = validateContact(contactEl.value);
    setFieldError('name', nameCode);
    setFieldError('contact', contactCode);
    setNetError(false);
    if (nameCode) { nameEl.focus(); return; }
    if (contactCode) { contactEl.focus(); return; }

    setBusy(true);
    const payload = buildPayload(nameEl.value, contactEl.value, commentEl.value);
    submit(payload).then(
      (res) => finish(res, payload),
      () => finish({ ok: false, error: 'network' }, payload),
    );
  }

  function onAgain() {
    doneInfo = null;
    form.reset();
    setFieldError('name', null);
    setFieldError('contact', null);
    setNetError(false);
    done.hidden = true;
    form.hidden = false;
    nameEl.focus();
  }

  const onInput = (e) => {
    const name = e.target === nameEl ? 'name' : e.target === contactEl ? 'contact' : null;
    if (name && fields[name].code) setFieldError(name, null);
  };

  form.addEventListener('submit', onSubmit);
  form.addEventListener('input', onInput);
  q('[data-again]').addEventListener('click', onAgain);

  const offStore = store.subscribe(() => renderSummary(true));
  const offLang = i18n.onChange(() => { renderStatic(); renderSummary(false); });

  setBusy(false);
  renderStatic();
  renderSummary(false);

  return () => {
    form.removeEventListener('submit', onSubmit);
    form.removeEventListener('input', onInput);
    offStore();
    offLang();
  };
}
