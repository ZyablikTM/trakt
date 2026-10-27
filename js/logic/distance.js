import { LIMITS } from '../data/tariffs.js';

const R = 6371; // км
const rad = (d) => (d * Math.PI) / 180;

/** Расстояние по прямой между двумя точками {lat, lon}, км (не округлено). */
export function haversineKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Дорожное расстояние: по прямой × поправка, округление до 10 км. */
export function roadDistanceKm(a, b, factor = LIMITS.roadFactor) {
  return Math.round((haversineKm(a, b) * factor) / 10) * 10;
}
