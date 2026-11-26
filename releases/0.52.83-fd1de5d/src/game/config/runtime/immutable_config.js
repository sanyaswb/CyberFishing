export function deepFreezeConfig(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreezeConfig(child, seen);
  return Object.freeze(value);
}

export function setRuntimeConfigPath(root, path, value) {
  const parts = Array.isArray(path) ? path.slice() : String(path).split(".").filter(Boolean);
  if (!parts.length) return;
  let target = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!target[key] || typeof target[key] !== "object") target[key] = {};
    target = target[key];
  }
  target[parts[parts.length - 1]] = value;
}

export function getRuntimeConfigPath(root, path) {
  const parts = Array.isArray(path) ? path : String(path).split(".").filter(Boolean);
  let target = root;
  for (const key of parts) {
    if (target == null || !Object.prototype.hasOwnProperty.call(target, key)) {
      return undefined;
    }
    target = target[key];
  }
  return target;
}
