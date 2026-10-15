const KINDS = new Set(["visual-image", "data-image", "binary", "json", "text", "bundle"]);
const TIERS = new Set(["l", "m", "h", "legacy"]);
const SCHEMA_VERSION = 1;

// Immutable asset catalog (spec 083, contract in spec 047): stable resource IDs, their tiered variants, coherent
// groups and exact legacy aliases. Validated once; lookups never touch the network, a file system or the DOM.
export class AssetCatalog {
  #revision;
  #assets = new Map();
  #groups = new Map();
  #aliases = new Map();

  constructor(snapshot) {
    if (snapshot?.schemaVersion !== SCHEMA_VERSION) throw new Error("AssetCatalog: unsupported schemaVersion");
    this.#revision = String(snapshot.revision || "");
    if (!this.#revision) throw new Error("AssetCatalog: revision is required");
    for (const record of snapshot.assets || []) {
      const asset = this.#asset(record);
      if (this.#assets.has(asset.id)) throw new Error(`AssetCatalog: duplicate asset "${asset.id}"`);
      this.#assets.set(asset.id, asset);
    }
    for (const record of snapshot.groups || []) {
      const group = this.#group(record);
      if (this.#groups.has(group.id) || this.#assets.has(group.id)) throw new Error(`AssetCatalog: duplicate id "${group.id}"`);
      this.#groups.set(group.id, group);
    }
    for (const [alias, id] of Object.entries(snapshot.aliases || {})) {
      if (!this.#assets.has(id)) throw new Error(`AssetCatalog: alias "${alias}" names unknown asset "${id}"`);
      if (this.#assets.has(alias)) throw new Error(`AssetCatalog: alias "${alias}" shadows an asset`);
      this.#aliases.set(alias, id);
    }
    for (const asset of this.#assets.values()) this.#checkFallback(asset);
  }

  get revision() { return this.#revision; }

  has(id) { return this.#assets.has(this.resolveAlias(id)); }

  // An exact legacy ID resolves to its stable ID; aliases never chain.
  resolveAlias(id) { return this.#aliases.get(id) ?? id; }

  getAsset(id) { return this.#assets.get(this.resolveAlias(id)) ?? null; }

  getGroup(id) { return this.#groups.get(id) ?? null; }

  #asset(record) {
    const id = this.#id(record?.id, "asset");
    if (!KINDS.has(record.kind)) throw new Error(`AssetCatalog: "${id}" has unknown kind "${record.kind}"`);
    const variants = (record.variants || []).map((variant) => this.#variant(id, record.kind, variant));
    if (variants.length === 0) throw new Error(`AssetCatalog: "${id}" has no variants`);
    const tiers = new Set();
    for (const variant of variants) {
      const key = `${variant.tier}:${variant.format}`;
      if (tiers.has(key)) throw new Error(`AssetCatalog: "${id}" repeats tier ${key}`);
      tiers.add(key);
    }
    // Gameplay data images (depth maps) keep their exact pixels: one legacy variant, never resampled tiers.
    if (record.kind === "data-image" && variants.some((variant) => variant.tier !== "legacy"))
      throw new Error(`AssetCatalog: data image "${id}" accepts only its exact legacy variant`);
    const logicalSize = record.logicalSize ? Object.freeze({ width: this.#positive(record.logicalSize.width, id),
      height: this.#positive(record.logicalSize.height, id) }) : null;
    return Object.freeze({ id, kind: record.kind, logicalSize, variants: Object.freeze(variants),
      fallbackId: record.fallbackId ? String(record.fallbackId) : null,
      dependencies: Object.freeze([...(record.dependencies || [])].map(String)) });
  }

  #variant(id, kind, variant) {
    if (!TIERS.has(variant?.tier)) throw new Error(`AssetCatalog: "${id}" has unknown tier "${variant?.tier}"`);
    const url = String(variant.url || "");
    if (!url || url.startsWith("/") || url.split("/").includes("..") || /^[a-z][a-z0-9+.-]*:/iu.test(url))
      throw new Error(`AssetCatalog: "${id}" needs a project-relative url, got "${url}"`);
    const format = String(variant.format || url.slice(url.lastIndexOf(".") + 1)).toLowerCase();
    const image = kind === "visual-image" || kind === "data-image";
    const byteLength = variant.byteLength === undefined ? null : Number(variant.byteLength);
    if (byteLength !== null && !(Number.isFinite(byteLength) && byteLength >= 0))
      throw new Error(`AssetCatalog: "${id}" has an invalid byteLength`);
    return Object.freeze({ tier: variant.tier, format, url,
      width: image && variant.width !== undefined ? this.#positive(variant.width, id) : null,
      height: image && variant.height !== undefined ? this.#positive(variant.height, id) : null,
      byteLength });
  }

  #group(record) {
    const id = this.#id(record?.id, "group");
    const members = [...(record.members || [])].map(String);
    if (members.length === 0) throw new Error(`AssetCatalog: group "${id}" is empty`);
    for (const member of members)
      if (!this.#assets.has(member)) throw new Error(`AssetCatalog: group "${id}" names unknown asset "${member}"`);
    return Object.freeze({ id, members: Object.freeze(members), atomic: record.atomic !== false });
  }

  #checkFallback(asset) {
    const seen = new Set([asset.id]);
    for (let next = asset.fallbackId; next; next = this.#assets.get(next).fallbackId) {
      if (!this.#assets.has(next)) throw new Error(`AssetCatalog: "${asset.id}" falls back to unknown "${next}"`);
      if (seen.has(next)) throw new Error(`AssetCatalog: fallback cycle at "${asset.id}"`);
      seen.add(next);
    }
    for (const dependency of asset.dependencies)
      if (!this.#assets.has(dependency)) throw new Error(`AssetCatalog: "${asset.id}" depends on unknown "${dependency}"`);
  }

  #id(value, label) {
    const id = String(value || "").trim();
    if (!id) throw new Error(`AssetCatalog: ${label} id is required`);
    return id;
  }

  #positive(value, id) {
    const number = Number(value);
    if (!(Number.isFinite(number) && number > 0)) throw new Error(`AssetCatalog: "${id}" has an invalid dimension`);
    return number;
  }
}
