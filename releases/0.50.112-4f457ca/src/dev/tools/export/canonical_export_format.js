// Shared canonical JSON, hashing, filename, template validation and leaf-diff helpers for DevTools exports (spec 176).
const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const finite = (value) => typeof value === "number" && Number.isFinite(value);

// Binary-fraction noise (TK-077: 11.700000000000001) collapses onto its short decimal (within 1e-12), while genuinely
// long coordinates and exact fractions keep their value.
export function cleanNumber(value) {
  if (!finite(value) || Number.isInteger(value)) return value;
  const short = Number(value.toPrecision(12));
  return Math.abs(short - value) <= Math.abs(value) * 1e-12 ? short : value;
}

export function cleanCanonical(value, { sortKeys = true } = {}) {
  if (typeof value === "number") return cleanNumber(value);
  if (Array.isArray(value)) return value.map((item) => cleanCanonical(item, { sortKeys }));
  if (value && typeof value === "object") {
    const keys = sortKeys ? Object.keys(value).sort() : Object.keys(value);
    return Object.fromEntries(keys.map((key) => [key, cleanCanonical(value[key], { sortKeys })]));
  }
  return value;
}

export async function canonicalHash(canonicalValue, hashText) {
  return await hashText(JSON.stringify(canonicalValue));
}

export function formatExportFileName(prefix, version, date) {
  const pad = (value) => String(value).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `${prefix}-v${version}-${stamp}.json`;
}

// Validates candidate against reference object keys and value types (numbers, booleans, strings, typed arrays).
export function collectTemplateIssues(template, candidate, path, errors) {
  if (!isRecord(template)) {
    if (Array.isArray(template)) {
      if (!Array.isArray(candidate)) { errors.push(`${path}: expected array`); return; }
      const itemType = typeof template[0];
      if (itemType === "number" && candidate.length !== template.length) {
        errors.push(`${path}: expected ${template.length} items`);
      }
      for (let i = 0; i < candidate.length; i++) {
        if (itemType === "number" && !finite(candidate[i])) errors.push(`${path}[${i}]: expected finite number`);
        else if (itemType !== "number" && typeof candidate[i] !== itemType) errors.push(`${path}[${i}]: expected ${itemType}`);
      }
      return;
    }
    if (typeof template === "number") {
      if (!finite(candidate)) errors.push(`${path}: expected finite number`);
      return;
    }
    if (typeof candidate !== typeof template) errors.push(`${path}: expected ${typeof template}`);
    return;
  }
  if (!isRecord(candidate)) { errors.push(`${path}: expected object`); return; }
  for (const key of Object.keys(candidate)) {
    if (!Object.hasOwn(template, key)) errors.push(`${path}.${key}: unknown setting`);
  }
  for (const key of Object.keys(template)) {
    if (!Object.hasOwn(candidate, key)) errors.push(`${path}.${key}: missing setting`);
    else collectTemplateIssues(template[key], candidate[key], `${path}.${key}`, errors);
  }
}

// Flat [{ path, from, to }] leaf differences between two canonical records.
export function diffCanonicalObjects(before, after, prefix = "") {
  if (isRecord(before) && isRecord(after)) {
    const changes = [];
    for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
      changes.push(...diffCanonicalObjects(before[key], after[key], prefix ? `${prefix}.${key}` : key));
    }
    return changes;
  }
  if (JSON.stringify(before) !== JSON.stringify(after)) return [{ path: prefix, from: before, to: after }];
  return [];
}
