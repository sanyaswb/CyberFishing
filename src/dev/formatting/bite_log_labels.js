// DEV labels for the bite diagnostics' result codes; unknown codes (e.g. "COOLDOWN") print as they are.
const RESULT_LABELS = Object.freeze({
  bite: "КЛЮНУЛО",
  "no-bite": "НЕ КЛЮНУЛО",
  success: "успішно",
});

export function formatBiteResult(code) {
  return RESULT_LABELS[code] || code;
}
