function normalizeDistance(raw, fallback = Infinity) {
  if (raw === "max") return Infinity;
  if (raw == null) return fallback;

  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(1, value) : fallback;
}

export { normalizeDistance };
