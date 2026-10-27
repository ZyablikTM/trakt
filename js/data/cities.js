// Узлы транспортной схемы. x/y — координаты в SVG viewBox="0 0 1000 420":
// запад слева, восток справа. Положение схематичное, не картографическое
// (южные города сдвинуты правее Москвы, чтобы подписи и линии не наползали на край).
// lat/lon — реальные координаты (используются для расчёта расстояния).
export const CITIES = [
  { id: 'spb', name: { ru: 'Санкт-Петербург', en: 'Saint Petersburg' }, lat: 59.9386, lon: 30.3141, x: 70, y: 70 },
  { id: 'msk', name: { ru: 'Москва', en: 'Moscow' }, lat: 55.7558, lon: 37.6173, x: 200, y: 150 },
  { id: 'nnv', name: { ru: 'Нижний Новгород', en: 'Nizhny Novgorod' }, lat: 56.2965, lon: 43.9361, x: 300, y: 105 },
  { id: 'vrn', name: { ru: 'Воронеж', en: 'Voronezh' }, lat: 51.672, lon: 39.1843, x: 225, y: 235 },
  { id: 'rnd', name: { ru: 'Ростов-на-Дону', en: 'Rostov-on-Don' }, lat: 47.2357, lon: 39.7015, x: 262, y: 305 },
  { id: 'krd', name: { ru: 'Краснодар', en: 'Krasnodar' }, lat: 45.0355, lon: 38.9753, x: 225, y: 370 },
  { id: 'kzn', name: { ru: 'Казань', en: 'Kazan' }, lat: 55.7963, lon: 49.1088, x: 390, y: 150 },
  { id: 'sam', name: { ru: 'Самара', en: 'Samara' }, lat: 53.1959, lon: 50.1002, x: 400, y: 245 },
  { id: 'prm', name: { ru: 'Пермь', en: 'Perm' }, lat: 58.0105, lon: 56.2502, x: 510, y: 80 },
  { id: 'ufa', name: { ru: 'Уфа', en: 'Ufa' }, lat: 54.7388, lon: 55.9721, x: 510, y: 190 },
  { id: 'ekb', name: { ru: 'Екатеринбург', en: 'Yekaterinburg' }, lat: 56.8389, lon: 60.6057, x: 610, y: 125 },
  { id: 'chl', name: { ru: 'Челябинск', en: 'Chelyabinsk' }, lat: 55.1644, lon: 61.4368, x: 620, y: 225 },
  { id: 'nsk', name: { ru: 'Новосибирск', en: 'Novosibirsk' }, lat: 55.0084, lon: 82.9357, x: 770, y: 180 },
  { id: 'krs', name: { ru: 'Красноярск', en: 'Krasnoyarsk' }, lat: 56.0153, lon: 92.8932, x: 850, y: 105 },
  { id: 'vvo', name: { ru: 'Владивосток', en: 'Vladivostok' }, lat: 43.1155, lon: 131.8855, x: 935, y: 350 },
];

// Серые магистрали между соседними узлами. Граф связный.
export const LINKS = [
  ['spb', 'msk'],
  ['msk', 'nnv'],
  ['msk', 'vrn'],
  ['vrn', 'rnd'],
  ['rnd', 'krd'],
  ['nnv', 'kzn'],
  ['vrn', 'sam'],
  ['kzn', 'sam'],
  ['kzn', 'prm'],
  ['kzn', 'ufa'],
  ['sam', 'ufa'],
  ['prm', 'ekb'],
  ['ufa', 'chl'],
  ['ekb', 'chl'],
  ['ekb', 'nsk'],
  ['chl', 'nsk'],
  ['nsk', 'krs'],
  ['krs', 'vvo'],
];
