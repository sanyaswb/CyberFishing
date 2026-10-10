// Browser UUID capability; InventoryInstanceIdFactory falls back to a timestamp/counter id without it.
export function createRandomInventoryId(prefix) {
  const cryptoObj = globalThis.crypto;
  return cryptoObj?.randomUUID ? `${prefix}_${cryptoObj.randomUUID()}` : null;
}
