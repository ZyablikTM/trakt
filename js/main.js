// Точка входа ТРАКТ. Модули секций подключаются по мере появления (калькулятор, тарифы, трекинг, заявка).
import { applyI18n } from './lib/i18n.js';
import { initReveal } from './lib/reveal.js';
import { i18n } from './state.js';
import { initHeader } from './ui/header.js';

function boot() {
  applyI18n(document, i18n);
  initHeader(document);

  // Последние шаги: класс .js включает скрытое состояние [data-reveal].
  // Если код выше упадёт, класс не появится и контент останется видимым.
  document.documentElement.classList.add('js');
  initReveal(document);
}

boot();
