// Builds the control sections of a fight balance window from a parameter object (spec 168 D5/D6): numbers become
// sliders, booleans switches, a pair of numbers two sliders, nested objects sub-sections; text is skipped.
export class BalanceFormRows {
  #schema;

  constructor({ schema }) {
    this.#schema = schema;
  }

  // value: the object; path: its edit path; base: the same object's base values (for ↺), or null; idPrefix: section ids.
  section({ id, title, value, path, base = null, skip = () => false }) {
    const rows = [];
    const sections = [];
    for (const [key, child] of Object.entries(value ?? {})) {
      const childPath = [...path, key];
      if (skip(childPath, child)) continue;
      const childBase = base?.[key];
      if (typeof child === "number") rows.push(this.number(childPath, key, child, childBase));
      else if (typeof child === "boolean") rows.push({ path: childPath, label: key, kind: "boolean", value: child, base: childBase });
      else if (Array.isArray(child)) {
        child.forEach((item, index) => {
          if (typeof item === "number") rows.push(this.number([...childPath, index], `${key}[${index}]`, item, childBase?.[index], key));
        });
      } else if (child && typeof child === "object") {
        const nested = this.section({ id: `${id}.${key}`, title: key, value: child, path: childPath, base: childBase, skip });
        if (nested.rows.length > 0 || nested.sections.length > 0) sections.push(nested);
      }
    }
    return { id, title, rows, sections };
  }

  // limitsKey: the key whose limits apply (an array element uses its array's key).
  number(path, label, value, base, limitsKey = label) {
    return { path, label, kind: "number", value, base: Number.isFinite(Number(base)) ? Number(base) : undefined,
      limits: this.#schema.limitsFor(limitsKey, value) };
  }

  // The form key: what the window shows and which fields it has; a change rebuilds the controls.
  static shapeKey(prefix, sections) {
    const paths = [];
    const collect = (section) => {
      for (const row of section.rows) paths.push(row.path.join("."));
      for (const child of section.sections) collect(child);
    };
    sections.forEach(collect);
    return `${prefix}|${paths.join(",")}`;
  }
}
