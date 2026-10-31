// The game's assets by stable id (spec 157 R16, TK-178). Pure: built from the generated registry data, no browser.
// Code and configuration name an asset by its id; the place that loads it (an image element, an image or audio loader,
// the Spine loader) asks the registry for the file. An unknown id is an error, never a guessed path.
export class AssetRegistry {
  #entries;
  #idsByTag = null;

  // entries: { id: { kind, path | json + atlas + textures, bytes, sha256, tags, label } } (ASSET_REGISTRY).
  constructor(entries) {
    if (!entries || typeof entries !== "object") throw new TypeError("AssetRegistry requires the registry entries");
    this.#entries = new Map(Object.entries(entries));
  }

  has(id) {
    return this.#entries.has(id);
  }

  entryOf(id) {
    const entry = this.#entries.get(id);
    if (!entry) throw new RangeError(`Unknown asset id "${id}"`);
    return entry;
  }

  // The file of an image, audio or data asset, relative to the site root.
  pathOf(id) {
    const entry = this.entryOf(id);
    if (entry.kind === "spine") throw new TypeError(`Asset "${id}" is a Spine package; read it with spineOf`);
    return entry.path;
  }

  // The files of a Spine export: { skeleton, atlas, textures }.
  spineOf(id) {
    const entry = this.entryOf(id);
    if (entry.kind !== "spine") throw new TypeError(`Asset "${id}" is not a Spine package`);
    return { skeleton: entry.json, atlas: entry.atlas, textures: entry.textures };
  }

  idsByTag(tag) {
    if (!this.#idsByTag) {
      this.#idsByTag = new Map();
      for (const [id, entry] of this.#entries) {
        for (const entryTag of entry.tags ?? []) {
          if (!this.#idsByTag.has(entryTag)) this.#idsByTag.set(entryTag, []);
          this.#idsByTag.get(entryTag).push(id);
        }
      }
      for (const [entryTag, ids] of this.#idsByTag) this.#idsByTag.set(entryTag, Object.freeze(ids));
    }
    return this.#idsByTag.get(tag) ?? Object.freeze([]);
  }
}
