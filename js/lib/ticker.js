import { prefersReducedMotion } from './motion.js';

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const frames = new WeakMap();

// Tween the element's displayed number from its current value to `to`.
export function animateNumber(el, to, { duration = 400, format = (v) => String(Math.round(v)) } = {}) {
  const running = frames.get(el);
  if (running) cancelAnimationFrame(running);

  const cur = Number(el.dataset.value);
  const from = el.dataset.value !== undefined && el.dataset.value !== '' && Number.isFinite(cur) ? cur : 0;
  const finish = () => { el.dataset.value = String(to); el.textContent = format(to); };

  if (prefersReducedMotion() || duration <= 0 || from === to) { frames.delete(el); finish(); return; }

  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / duration);
    if (p >= 1) { frames.delete(el); finish(); return; }
    const v = from + (to - from) * easeOutCubic(p);
    el.dataset.value = String(v);
    el.textContent = format(v);
    frames.set(el, requestAnimationFrame(step));
  };
  frames.set(el, requestAnimationFrame(step));
}
