// Схематичная карта сети: узлы, магистрали и анимированный маршрут.
// Координаты городов — в viewBox 0 0 1000 420 (см. data/cities.js). Контур страны не рисуется.
// Размеры линий, узлов и шрифта считаются в экранных пикселях: на узком экране карта
// сжимается, но узлы остаются нажимаемыми, а подписи читаемыми.
import { CITIES, LINKS } from '../data/cities.js';
import { prefersReducedMotion } from '../lib/motion.js';

const NS = 'http://www.w3.org/2000/svg';
const VB_W = 1000;
const VB_H = 420;
const DRAW_MS = 700;
const COMPACT_W = 560; // уже этого карта растягивается по вертикали, чтобы подписи не слипались
const COMPACT_STRETCH = 1.6;
const LABEL_GAP = 10; // отступ подписи от центра узла, экранные px
const LIFT = 0.25; // подъём контрольной точки дуги, доля длины маршрута

// Порядок показа подписей при нехватке места: выбранные города всегда первыми, затем крупные узлы.
const LABEL_PRIORITY = ['msk', 'spb', 'nsk', 'ekb', 'vvo', 'krd', 'kzn', 'nnv', 'rnd', 'sam', 'ufa', 'chl', 'krs', 'prm', 'vrn'];

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (parent) parent.append(node);
  return node;
}

function rectsOverlap(a, b) {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

/**
 * @param {SVGSVGElement} svg
 * @param {{ store: {get(): any, set(p: any): void, subscribe(fn: Function): Function},
 *           i18n: {lang(): string, t(k: string): string, onChange(fn: Function): Function} }} deps
 * @returns {() => void} функция снятия подписок
 */
export function initNetworkMap(svg, { store, i18n }) {
  if (!svg) return () => {};

  const cityById = new Map(CITIES.map((c) => [c.id, c]));
  const nodes = new Map(); // id → { g, dot, ring, focus, hit, label }
  const linkEls = [];

  // ── разметка (один раз) ──
  const gLinks = el('g', { class: 'map-links', 'aria-hidden': 'true' }, svg);
  for (const [a, b] of LINKS) {
    linkEls.push({ a, b, line: el('line', { class: 'map-link' }, gLinks) });
  }
  const route = el('path', { class: 'route', fill: 'none', 'aria-hidden': 'true' }, svg);
  const gNodes = el('g', { class: 'map-nodes' }, svg);
  for (const c of CITIES) {
    const g = el('g', { class: 'node', role: 'button', tabindex: '0', 'data-city': c.id }, gNodes);
    const hit = el('circle', { class: 'hit', fill: 'transparent' }, g);
    const focus = el('circle', { class: 'focus-ring', fill: 'none' }, g);
    const ring = el('circle', { class: 'ring', fill: 'none' }, g);
    const dot = el('circle', { class: 'dot' }, g);
    const label = el('text', { class: 'map-label' }, g);
    nodes.set(c.id, { g, hit, focus, ring, dot, label, city: c });
  }

  svg.setAttribute('role', 'group');
  svg.removeAttribute('focusable');

  // ── состояние отрисовки ──
  let k = 1; // user-единиц на экранный пиксель
  let stretch = 1;
  let lastW = 0;
  let drawAnim = null;
  let routeKey = ''; // "from>to" уже нарисованного маршрута
  let pickStep = 'from'; // что установит следующий клик

  const px = (n) => n * k;
  const pos = (c) => ({ x: c.x, y: c.y * stretch });

  function curveFor(a, b) {
    const p = pos(a);
    const q = pos(b);
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    const cx = (p.x + q.x) / 2;
    const cy = (p.y + q.y) / 2 - len * LIFT;
    return `M${p.x} ${p.y} Q${cx} ${cy} ${q.x} ${q.y}`;
  }

  // ── подписи и состояние узлов ──
  function updateTexts() {
    const lang = i18n.lang();
    svg.setAttribute('aria-label', i18n.t('map.label'));
    for (const { g, label, city } of nodes.values()) {
      const name = city.name[lang] ?? city.name.ru;
      label.textContent = name;
      g.setAttribute('aria-label', name);
    }
  }

  function selection() {
    const { from, to } = store.get();
    return { from, to };
  }

  function markNodes() {
    const { from, to } = selection();
    for (const [id, n] of nodes) {
      n.g.classList.toggle('is-from', id === from);
      n.g.classList.toggle('is-to', id === to);
      n.g.setAttribute('aria-pressed', String(id === from || id === to));
    }
  }

  // Жадный подбор подписей: выбранные города и крупные узлы первыми. Для каждой подписи пробуем
  // стороны по очереди (справа, слева, сверху, снизу) и берём первую, где она не налезает на уже
  // занятое и не выходит за карту. Подписи без места скрываются (возвращаются при наведении/фокусе).
  function placeLabels() {
    const { from, to } = selection();
    const fsPx = Number(svg.dataset.fs) || 13;
    const fs = px(fsPx);
    const pad = px(2);
    const gap = px(LABEL_GAP);
    const maxY = VB_H * stretch;
    const order = [from, to, ...LABEL_PRIORITY].filter((id, i, arr) => nodes.has(id) && arr.indexOf(id) === i);
    // узлы занимают место сами: подпись не должна лечь поверх чужого кружка
    const taken = [...nodes.values()].map((n) => {
      const p = pos(n.city);
      const r = px(n.city.id === from || n.city.id === to ? 11 : 7); // у выбранных есть кольцо
      return { x1: p.x - r, y1: p.y - r, x2: p.x + r, y2: p.y + r, id: n.city.id };
    });
    for (const id of order) {
      const n = nodes.get(id);
      const p = pos(n.city);
      const forced = id === from || id === to;
      const w = n.label.textContent.length * fs * (forced ? 0.68 : 0.62);
      const h = fs * 1.1;
      const sides = {
        right: { anchor: 'start', x: p.x + gap, box: [p.x + gap, p.y - h / 2, p.x + gap + w, p.y + h / 2] },
        left: { anchor: 'end', x: p.x - gap, box: [p.x - gap - w, p.y - h / 2, p.x - gap, p.y + h / 2] },
        above: { anchor: 'middle', x: p.x, dy: -gap - h * 0.25, box: [p.x - w / 2, p.y - gap - h, p.x + w / 2, p.y - gap] },
        below: { anchor: 'middle', x: p.x, dy: gap + h * 0.75, box: [p.x - w / 2, p.y + gap, p.x + w / 2, p.y + gap + h] },
      };
      const prefer = n.city.x >= 770 ? ['left', 'right', 'above', 'below'] : ['right', 'left', 'above', 'below'];
      let chosen = null;
      for (const key of prefer) {
        const s = sides[key];
        const [x1, y1, x2, y2] = s.box;
        const box = { x1: x1 - pad, y1: y1 - pad, x2: x2 + pad, y2: y2 + pad };
        if (box.x1 < 0 || box.x2 > VB_W || box.y1 < 0 || box.y2 > maxY) continue;
        if (taken.some((t) => t.id !== id && rectsOverlap(box, t))) continue;
        chosen = { s, box };
        break;
      }
      const fallback = sides[prefer[0]];
      const s = chosen ? chosen.s : fallback;
      n.label.setAttribute('text-anchor', s.anchor);
      n.label.setAttribute('x', s.x);
      n.label.setAttribute('y', p.y + (s.dy ?? fs * 0.35));
      const show = Boolean(chosen) || forced;
      n.label.classList.toggle('is-off', !show);
      if (chosen) taken.push({ ...chosen.box, id });
      else if (forced) {
        const [x1, y1, x2, y2] = fallback.box;
        taken.push({ x1, y1, x2, y2, id });
      }
    }
  }

  function layout() {
    const w = svg.getBoundingClientRect().width;
    if (!w) return;
    lastW = Math.round(w);
    const compact = w < COMPACT_W;
    stretch = compact ? COMPACT_STRETCH : 1;
    svg.setAttribute('viewBox', `0 0 ${VB_W} ${VB_H * stretch}`);
    k = VB_W / w;
    svg.dataset.fs = w < 480 ? '11' : '13';
    const fs = px(Number(svg.dataset.fs));
    svg.style.setProperty('--k', String(k));

    for (const { a, b, line } of linkEls) {
      const p = pos(cityById.get(a));
      const q = pos(cityById.get(b));
      line.setAttribute('x1', p.x);
      line.setAttribute('y1', p.y);
      line.setAttribute('x2', q.x);
      line.setAttribute('y2', q.y);
      line.setAttribute('stroke-width', px(2));
    }
    for (const n of nodes.values()) {
      const p = pos(n.city);
      n.hit.setAttribute('cx', p.x); n.hit.setAttribute('cy', p.y); n.hit.setAttribute('r', px(22));
      n.focus.setAttribute('cx', p.x); n.focus.setAttribute('cy', p.y); n.focus.setAttribute('r', px(15));
      n.focus.setAttribute('stroke-width', px(3));
      n.ring.setAttribute('cx', p.x); n.ring.setAttribute('cy', p.y); n.ring.setAttribute('r', px(10));
      n.ring.setAttribute('stroke-width', px(2));
      n.dot.setAttribute('cx', p.x); n.dot.setAttribute('cy', p.y); n.dot.setAttribute('r', px(5));
      n.label.setAttribute('font-size', fs);
      n.label.setAttribute('stroke-width', px(4));
    }
    route.setAttribute('stroke-width', px(3));
    route.style.setProperty('--dash', String(px(6)));
    placeLabels();
    if (routeKey) drawRoute({ animate: false });
  }

  // ── маршрут ──
  function stopDraw() {
    if (drawAnim) { drawAnim.onfinish = null; drawAnim.cancel(); drawAnim = null; }
    route.classList.remove('is-flowing');
    route.style.strokeDasharray = '';
  }

  function drawRoute({ animate }) {
    stopDraw();
    const { from, to } = selection();
    const a = cityById.get(from);
    const b = cityById.get(to);
    if (!a || !b || a === b) {
      routeKey = '';
      route.removeAttribute('d');
      route.classList.add('is-empty');
      return;
    }
    routeKey = `${from}>${to}`;
    route.classList.remove('is-empty');
    route.setAttribute('d', curveFor(a, b));
    if (!animate || prefersReducedMotion()) {
      if (!prefersReducedMotion()) route.classList.add('is-flowing');
      return; // с reduced-motion: сразу пунктир 6/6 без движения
    }
    const len = route.getTotalLength();
    route.style.strokeDasharray = String(len);
    if (typeof route.animate !== 'function') {
      route.style.strokeDasharray = '';
      route.classList.add('is-flowing');
      return;
    }
    drawAnim = route.animate(
      [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
      { duration: DRAW_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    );
    const done = () => {
      drawAnim = null;
      route.style.strokeDasharray = '';
      route.classList.add('is-flowing');
    };
    drawAnim.onfinish = done;
  }

  // ── выбор города ──
  function pick(id) {
    const { from } = selection();
    if (pickStep === 'from') {
      store.set({ from: id });
      pickStep = 'to';
    } else {
      if (id === from) return; // тот же город дважды игнорируем
      store.set({ to: id });
      pickStep = 'from';
    }
  }

  function onClick(e) {
    const g = e.target instanceof Element ? e.target.closest('[data-city]') : null;
    if (g && svg.contains(g)) pick(g.dataset.city);
  }
  function onKey(e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    const g = e.target instanceof Element ? e.target.closest('[data-city]') : null;
    if (!g) return;
    e.preventDefault();
    pick(g.dataset.city);
  }
  svg.addEventListener('click', onClick);
  svg.addEventListener('keydown', onKey);

  // ── подписки ──
  const offStore = store.subscribe((s, prev) => {
    if (s.from === prev.from && s.to === prev.to) return;
    markNodes();
    placeLabels();
    drawRoute({ animate: true });
  });
  const offLang = i18n.onChange(() => {
    updateTexts();
    placeLabels();
  });

  let ro = null;
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => {
      const w = Math.round(svg.getBoundingClientRect().width);
      if (w && w !== lastW) layout();
    });
    ro.observe(svg);
  } else {
    addEventListener('resize', layout);
  }

  // ── первый показ ──
  updateTexts();
  markNodes();
  layout();
  drawRoute({ animate: true });

  return () => {
    svg.removeEventListener('click', onClick);
    svg.removeEventListener('keydown', onKey);
    offStore();
    offLang();
    ro?.disconnect();
    removeEventListener('resize', layout);
    stopDraw();
  };
}
