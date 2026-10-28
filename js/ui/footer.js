// Подвал: автор, Telegram и ссылка берутся из js/data/author.js (textContent и href выставляются здесь).
import author from '../data/author.js';

const HTTP_URL = /^https?:\/\//i;
const TG_HANDLE = /^@?[A-Za-z0-9_]{5,32}$/;
const TG_PLACEHOLDER = '@username';

function setLink(a, text, href) {
  a.textContent = text;
  if (href) {
    a.setAttribute('href', href);
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  } else {
    // Заглушка: ссылка без href никуда не ведёт и не перехватывается обработчиком якорей.
    a.removeAttribute('href');
    a.removeAttribute('target');
    a.removeAttribute('rel');
  }
}

export function initFooter(root = document) {
  const link = root.querySelector('#author-link');
  const tg = root.querySelector('#author-telegram');
  const url = String(author.url ?? '').trim();
  if (link) setLink(link, author.name ?? '', HTTP_URL.test(url) ? url : null);
  if (tg) {
    const handle = String(author.telegram ?? '').trim();
    const real = TG_HANDLE.test(handle) && handle !== TG_PLACEHOLDER;
    setLink(tg, handle, real ? `https://t.me/${handle.replace(/^@/, '')}` : null);
  }
}
