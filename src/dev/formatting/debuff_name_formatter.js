// Only the diagnostic display assigns labels to Domain-owned debuff facts.
export function formatDebuffName(state, legacyName = null) {
  if (!state) return legacyName || "Немає";
  return state.active ? state.type || "Невідомий" : "Немає";
}
