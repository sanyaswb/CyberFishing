import { deepFreezeConfig } from "./immutable_config.js";

export class ResolvedConfigProvider {
  #catalogs;
  #catalogReferences;
  #resolved;
  #revision = -1;
  constructor(baseConfig, overrideStore, catalogs = {}) {
    this.baseConfig = baseConfig || {};
    this.overrideStore = overrideStore;
    this.#catalogs = catalogs;
    this.#catalogReferences = new Set(Object.values(catalogs));
  }
  get(path, fallbackValue = undefined) {
    this.readLive([]);
    const result = this.#readPath(this.#resolved,this.#parts(path));
    return result.found ? (result.value === undefined ? undefined : this.overrideStore.clone(result.value)) : fallbackValue;
  }
  getBase(path, fallbackValue = undefined) {
    const result = this.#readPath(this.baseConfig,this.#parts(path));
    return result.found ? result.value : fallbackValue;
  }
  getOverride(path) { return this.overrideStore.get(path); }
  hasOverride(path) { return this.overrideStore.has(path); }
  setOverride(path,value) { this.overrideStore.set(path,value); }
  resetOverride(path) { this.overrideStore.restore(path,this.getBase(path)); }
  resetAllOverrides() { for (const [path] of this.overrideStore.entries()) this.resetOverride(path); }
  exportOverrides() { return this.overrideStore.toJSON(); }
  importOverrides(data) { this.overrideStore.loadFromJSON(data,{preserveLiveValues:true}); }

  // Stable config accessors pass precomputed paths. Rebuild only on a write, never per frame.
  readLive(parts) {
    if (this.#revision !== this.overrideStore.revision) {
      let resolved = this.baseConfig;
      for (const [path,value] of Object.entries(this.#catalogs)) resolved = this.#withPath(resolved,this.#parts(path),value);
      for (const [path,value] of this.overrideStore.effectiveEntries()) resolved = this.#withPath(resolved,this.#parts(path),deepFreezeConfig(value));
      this.#resolved = resolved;
      this.#revision = this.overrideStore.revision;
    }
    let current = this.#resolved;
    for (const part of parts) { if (current == null) return undefined; current = current[part]; }
    return current;
  }
  isCatalogReference(value) { return this.#catalogReferences.has(value); }
  #withPath(root,parts,value,index=0) {
    if (index === parts.length) return value;
    const result = Array.isArray(root) ? root.slice() : {...(root && typeof root === "object" ? root : {})};
    const key = parts[index];
    Object.defineProperty(result,key,{value:this.#withPath(root?.[key],parts,value,index+1),writable:true,enumerable:true,configurable:true});
    return result;
  }
  #readPath(root,parts) {
    let current = root;
    for (const part of parts) {
      if (current == null || !Object.prototype.hasOwnProperty.call(current,part)) return {found:false,value:undefined};
      current = current[part];
    }
    return {found:true,value:current};
  }
  #parts(path) { return Array.isArray(path) ? path : String(path || "").trim().split(".").filter(Boolean); }
}
