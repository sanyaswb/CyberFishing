// Only the diagnostic display assigns labels to Domain-owned debuff facts.
export function formatDebuffName(state) {
  return state?.active ? state.type || "Невідомий" : "Немає";
}
