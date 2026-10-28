// Точка входа ТРАКТ. Модули секций подключаются по мере появления (калькулятор, тарифы, трекинг, заявка).
import { applyI18n } from './lib/i18n.js';
import { initReveal } from './lib/reveal.js';
import { i18n, appStore } from './state.js';
import { initHeader } from './ui/header.js';
import { initNetworkMap } from './ui/network-map.js';
import { initCalcPanel } from './ui/calc-panel.js';
import { initBreakdown } from './ui/breakdown.js';
import { initTariffs } from './ui/tariffs.js';
import { initTracking } from './ui/tracking-ui.js';

function boot() {
  applyI18n(document, i18n);
  initHeader(document);
  initNetworkMap(document.getElementById('network'), { store: appStore, i18n });
  initCalcPanel(document.getElementById('calc-panel'), { store: appStore, i18n });
  initBreakdown(document.getElementById('breakdown-table'), { store: appStore, i18n });
  initTariffs(document.getElementById('tariffs-grid'), { store: appStore, i18n });
  initTracking(document.getElementById('track-ui'), { i18n });

  // Последние шаги: класс .js включает скрытое состояние [data-reveal].
  // Если код выше упадёт, класс не появится и контент останется видимым.
  document.documentElement.classList.add('js');
  initReveal(document);
}

boot();
