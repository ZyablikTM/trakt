// Тарифы и цены (условные). Правьте значения здесь — пересчёт подхватится автоматически.
export const TARIFFS = {
  economy: { base: 800, ratePerKgKm: 0.045, min: 2500, kmPerDay: 400 },
  standard: { base: 1000, ratePerKgKm: 0.06, min: 3500, kmPerDay: 600 },
  express: { base: 1500, ratePerKgKm: 0.095, min: 5000, kmPerDay: 900 },
};

export const OPTIONS = {
  insurance: { percent: 0.5, min: 300 }, // % от объявленной стоимости
  packing: { perM3: 900, min: 500 }, // ₽ за м³
  pickup: { fixed: 1500 },
  delivery: { fixed: 1500 },
};

export const LIMITS = {
  maxWeight: 20000, // кг
  maxVolume: 82, // м³
  volumetricFactor: 250, // кг на м³
  roadFactor: 1.25, // поправка на дороги
};
