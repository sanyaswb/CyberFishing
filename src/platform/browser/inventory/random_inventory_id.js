// Browser UUID capability; the legacy manager retains its timestamp/counter fallback.
export function createRandomInventoryId(prefix) {
  const cryptoObj = globalThis.crypto;
  return cryptoObj?.randomUUID ? `${prefix}_${cryptoObj.randomUUID()}` : null;
}
