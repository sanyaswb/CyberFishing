export class ConfigOverrideStore {
  #overrides = new Map();
  #cloneValue;
  #revision = 0;

  constructor(cloneValue) { this.#cloneValue = cloneValue; }
  get revision() { return this.#revision; }

  set(path, value) {
    const key = this.#normalizePath(path);
    if (!key) return;
    const copy = this.#clone(value);
    this.#suppressChildren(key);
    if (!this.#overrides.get(key)?.exported) this.#overrides.delete(key);
    this.#overrides.set(key, {value: copy, exported: true, applied: true, order:this.#revision + 1});
    this.#revision++;
  }

  get(path, fallbackValue = undefined) {
    const entry = this.#overrides.get(this.#normalizePath(path));
    return entry?.exported ? this.#clone(entry.value) : fallbackValue;
  }
  has(path) { return this.#overrides.get(this.#normalizePath(path))?.exported === true; }
  remove(path) { this.#overrides.delete(this.#normalizePath(path)); this.#revision++; }
  clear() { this.#overrides.clear(); this.#revision++; }
  entries() { return [...this.#overrides].filter(([,entry]) => entry.exported).map(([key,entry]) => [key,this.#clone(entry.value)]); }
  toJSON() { return Object.fromEntries(this.entries()); }

  // These retained values reproduce live CONFIG semantics without a second mutable owner:
  // imports omit previous exported paths; reset of a base-missing path leaves its live value.
  restore(path, baseValue) {
    const key = this.#normalizePath(path), entry = this.#overrides.get(key);
    if (baseValue === undefined) {
      if (entry) entry.exported = false;
    } else {
      this.#suppressChildren(key);
      this.#overrides.delete(key);
      this.#overrides.set(key, {value:this.#clone(baseValue),exported:false,applied:true,order:this.#revision + 1});
    }
    this.#revision++;
  }

  loadFromJSON(data = {}, {preserveLiveValues = false} = {}) {
    
    if (preserveLiveValues) { for (const entry of this.#overrides.values()) entry.exported = false; this.#revision++; }
    else this.clear();
    const source = typeof data === "string" ? JSON.parse(data) : data;
    for (const [key,value] of Object.entries(source || {})) this.set(key,value);
  }

  effectiveEntries() { return [...this.#overrides].filter(([,entry]) => entry.applied).sort((a,b) => a[1].order-b[1].order).map(([key,entry]) => [key,this.#clone(entry.value)]); }
  clone(value) { return this.#clone(value); }
  #suppressChildren(key) { for (const [path,entry] of this.#overrides) if (path.startsWith(key + ".")) entry.applied = false; }
  #normalizePath(path) { return Array.isArray(path) ? path.map(String).join(".") : String(path || "").trim(); }
  #clone(value) { return this.#cloneValue(value); }
}
