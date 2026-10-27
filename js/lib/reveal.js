import { prefersReducedMotion } from './motion.js';

export function initReveal(root = document) {
  const items = root.querySelectorAll('[data-reveal]:not(.is-visible)');
  if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  items.forEach((el) => io.observe(el));
}
