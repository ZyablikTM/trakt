// Шапка: плавная прокрутка по якорям, мобильный бургер, переключатель языка.
import { applyI18n } from '../lib/i18n.js';
import { prefersReducedMotion } from '../lib/motion.js';
import { i18n } from '../state.js';

const MOBILE_MQ = '(max-width: 767.98px)';

export function initHeader(root = document) {
  const burger = root.querySelector('#burger');
  const nav = root.querySelector('#site-nav');
  const langToggle = root.querySelector('#lang-toggle');

  /* ── бургер ── */
  const setOpen = (open) => {
    if (!burger || !nav) return;
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
  };
  const isOpen = () => burger?.getAttribute('aria-expanded') === 'true';

  burger?.addEventListener('click', () => setOpen(!isOpen()));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) {
      setOpen(false);
      burger.focus();
    }
  });

  document.addEventListener('click', (e) => {
    if (isOpen() && !nav.contains(e.target) && !burger.contains(e.target)) setOpen(false);
  });

  // при выходе из мобильного режима меню сбрасывается
  if (typeof matchMedia === 'function') {
    const mq = matchMedia(MOBILE_MQ);
    const onChange = () => { if (!mq.matches) setOpen(false); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  /* ── плавная прокрутка по якорям ── */
  root.addEventListener('click', (e) => {
    const link = e.target.closest?.('a[href^="#"]');
    if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const hash = link.getAttribute('href');
    if (hash.length < 2) return;
    let target = null;
    try { target = root.querySelector(hash); } catch { /* некорректный селектор */ }
    if (!target) return;
    e.preventDefault();
    setOpen(false);
    target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    try { history.pushState(null, '', hash); } catch { /* file:// и т. п. */ }
  });

  /* ── язык ── */
  langToggle?.addEventListener('click', () => {
    i18n.setLang(i18n.lang() === 'ru' ? 'en' : 'ru');
    applyI18n(document, i18n);
  });
}
