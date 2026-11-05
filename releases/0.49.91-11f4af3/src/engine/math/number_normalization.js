// Shared numeric normalization for config values, physics frames and render models.
// Each function keeps the exact semantics of the private helpers it replaced.

// A finite non-negative number, else a finite non-negative fallback, else 0.
export function nonNegativeOr(value, fallback = 0) {
  const number = Number(value);
  if (Number.isFinite(number) && number >= 0) return number;
  const safeFallback = Number(fallback);
  return Number.isFinite(safeFallback) && safeFallback >= 0
    ? safeFallback
    : 0;
}

// A finite number clamped to 0..1, else 0 (Infinity counts as invalid).
export function clampUnitFinite(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

// A number clamped to 0..1; NaN and falsy values become 0, Infinity becomes 1.
export function clampUnit(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

// A number clamped to min..max; NaN and falsy values count as 0.
export function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

// A number clamped to min..max; a non-finite value is replaced by the fallback (min by default) before clamping.
export function clampFinite(value, min, max, fallback = min) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
}

// A finite number clamped to min..max; a non-finite value returns min as given (not clamped).
export function clampFiniteOrMin(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

// The point itself when falsy, else whether both coordinates are finite numbers.
export function hasFinitePoint(point) {
  return (
    point &&
    Number.isFinite(Number(point.x)) &&
    Number.isFinite(Number(point.y))
  );
}

// A finite number, else the fallback as given.
export function finiteOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// The first finite number among the values, else 0.
export function firstFinite(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

// A finite number raised to at least 0, else the fallback raised to at least 0 (NaN fallback counts as 0).
export function nonNegativeFiniteOr(value, fallback = 0) {
  const number = Number(value);
  if (Number.isFinite(number)) return Math.max(0, number);
  return Math.max(0, Number(fallback) || 0);
}

// A finite number raised to at least 0, else 0.
export function nonNegativeFinite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

// A number raised to at least 0; NaN and falsy values become 0, Infinity stays Infinity.
export function nonNegative(value) {
  return Math.max(0, Number(value) || 0);
}

// A finite number greater than 0, else 0.
export function positiveFinite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
