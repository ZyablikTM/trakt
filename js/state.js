// Общее состояние приложения: параметры расчёта, i18n-синглтон и расчёт цены.
import { createStorage } from './lib/storage.js';
import { createI18n } from './lib/i18n.js';
import { createStore } from './lib/store.js';
import { parseDecimal } from './lib/format.js';
import { quote } from './logic/quote.js';
import ru from '../i18n/ru.js';
import en from '../i18n/en.js';

export const i18n = createI18n({ dicts: { ru, en }, storage: createStorage() });

// Поля ввода хранятся строками, как их набрал пользователь («1,5», « 240 »).
export const appStore = createStore({
  from: 'msk',
  to: 'kzn',
  weight: '240',
  volume: '1.2',
  tariff: 'standard',
  options: { insurance: false, declaredValue: '', packing: false, pickup: false, delivery: false },
});

/** Строки → числа через parseDecimal, затем чистый quote(). Возвращает QuoteOk | QuoteErr. */
export function getQuote(state = appStore.get()) {
  const o = state.options ?? {};
  return quote({
    from: state.from,
    to: state.to,
    weight: parseDecimal(state.weight),
    volume: parseDecimal(state.volume),
    tariff: state.tariff,
    options: {
      insurance: Boolean(o.insurance),
      declaredValue: parseDecimal(o.declaredValue),
      packing: Boolean(o.packing),
      pickup: Boolean(o.pickup),
      delivery: Boolean(o.delivery),
    },
  });
}
