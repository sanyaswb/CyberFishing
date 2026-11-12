// Decimal stepping for DEV number fields (spec 174 A2): 0.1 + 0.1 is 0.2 and 0.1 + 0.2 is 0.3, never a binary tail.
// Pure: no DOM, no config.
const MAX_DECIMALS = 12;

// Decimal places of a number's shortest text: 40 -> 0, 0.25 -> 2, 1e-7 -> 7.
export function decimalsOf(value) {
  if (!Number.isFinite(value)) return 0;
  const [mantissa, exponent = "0"] = String(Math.abs(value)).split("e");
  const fraction = mantissa.includes(".") ? mantissa.split(".")[1].length : 0;
  return Math.min(MAX_DECIMALS, Math.max(0, fraction - Number(exponent)));
}

// One step of a value shown with `decimals` places: 0 -> 1, 1 -> 0.1, 2 -> 0.01.
export function stepOfDecimals(decimals) {
  return Number(`1e-${Math.min(MAX_DECIMALS, Math.max(0, decimals))}`);
}

// value + count steps, rounded to the finer of the value's and the step's decimals.
export function addSteps(value, step, count) {
  const decimals = Math.max(decimalsOf(value), decimalsOf(step));
  return Number((value + step * count).toFixed(decimals));
}

// The number a person typed ("0,25", " -3 ", ".5") or null when the text is not one number.
export function parseDecimal(text) {
  const normalized = String(text ?? "").trim().replace(",", ".");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
