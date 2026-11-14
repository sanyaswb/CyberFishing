// TK-321.2: the seed of a game session. A configured seed (a DEV test, a repeated session) is kept as it is; without one
// the seed is a fresh random 32-bit number from fillRandom (crypto.getRandomValues-like: fills a Uint32Array), falling
// back to Math.random, so no two sessions share the same random sequence.
export function resolveSessionSeed(configured, fillRandom = null) {
  if (configured !== null && configured !== undefined && configured !== "") return configured;
  const value = new Uint32Array(1);
  if (typeof fillRandom === "function") fillRandom(value);
  return value[0] || Math.floor(Math.random() * 4294967295) + 1;
}
