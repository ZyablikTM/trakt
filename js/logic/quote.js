import { CITIES } from '../data/cities.js';
import { TARIFFS, OPTIONS, LIMITS } from '../data/tariffs.js';
import { roadDistanceKm } from './distance.js';

const round10 = (n) => Math.round(n / 10) * 10;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Расчёт стоимости и срока.
 * Числовые поля ожидаются как number (строки из форм сначала через parseDecimal);
 * любая нечисловая/нефинитная величина даёт ошибку поля, а не NaN в цене.
 * Все ошибки полей собираются разом.
 */
export function quote(input, cfg = {}) {
  const cities = cfg.cities ?? CITIES;
  const tariffs = cfg.tariffs ?? TARIFFS;
  const optionPrices = cfg.options ?? OPTIONS;
  const limits = cfg.limits ?? LIMITS;

  const inp = input && typeof input === 'object' ? input : {};
  const opts = inp.options && typeof inp.options === 'object' ? inp.options : {};
  const errors = {};

  const from = cities.find((c) => c.id === inp.from);
  const to = cities.find((c) => c.id === inp.to);
  if (!from) errors.from = 'unknown_city';
  if (!to) errors.to = 'unknown_city';
  if (from && to && from.id === to.id) errors.to = 'same_city';

  const { weight, volume } = inp;
  if (!isNum(weight) || weight <= 0) errors.weight = 'weight_invalid';
  else if (weight > limits.maxWeight) errors.weight = 'weight_too_big';
  if (!isNum(volume) || volume <= 0) errors.volume = 'volume_invalid';
  else if (volume > limits.maxVolume) errors.volume = 'volume_too_big';

  const tariff = Object.hasOwn(tariffs, inp.tariff) ? tariffs[inp.tariff] : null;
  if (!tariff) errors.tariff = 'unknown_tariff';

  const insuranceOn = Boolean(opts.insurance);
  if (insuranceOn && (!isNum(opts.declaredValue) || opts.declaredValue <= 0)) {
    errors.declaredValue = 'declared_value_invalid';
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  const distanceKm = roadDistanceKm(from, to, limits.roadFactor);
  const chargeableWeight = Math.round(Math.max(weight, volume * limits.volumetricFactor) * 100) / 100;

  const lines = [
    {
      key: 'transport',
      amount: round10(Math.max(tariff.min, tariff.base + tariff.ratePerKgKm * chargeableWeight * distanceKm)),
    },
  ];
  if (insuranceOn) {
    const o = optionPrices.insurance;
    lines.push({ key: 'insurance', amount: round10(Math.max(o.min, (opts.declaredValue * o.percent) / 100)) });
  }
  if (opts.packing) {
    const o = optionPrices.packing;
    lines.push({ key: 'packing', amount: round10(Math.max(o.min, volume * o.perM3)) });
  }
  if (opts.pickup) lines.push({ key: 'pickup', amount: round10(optionPrices.pickup.fixed) });
  if (opts.delivery) lines.push({ key: 'delivery', amount: round10(optionPrices.delivery.fixed) });

  const total = lines.reduce((s, l) => s + l.amount, 0);
  const daysMin = Math.ceil(distanceKm / tariff.kmPerDay) + 1;

  return { ok: true, distanceKm, chargeableWeight, lines, total, daysMin, daysMax: daysMin + 1 };
}
