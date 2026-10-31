// Asset registry synchronisation (spec 157 R16, TK-178): pure functions, no file system, no hashing (the tool hands in
// the tracked files with their sizes and content hashes). Every asset keeps the id it got when its file first appeared;
// a later move or rename of the file changes only its path. Matching a file that is no longer at its registered path:
//   1. an explicit hint (moved: [[oldPath, newPath]]);
//   2. the same content hash as exactly one vanished asset (two candidates: an error, never a guess);
//   3. a rename that git reports (renames: [[oldPath, newPath]]);
//   otherwise it is a new asset with a new id, and the vanished one is an error (referenced) or needs prune.
// A Spine export (name.json + name.atlas, its textures named in the atlas) is one asset of kind "spine".

const MEDIA_KINDS = Object.freeze({
  webp: "image", png: "image", jpg: "image", jpeg: "image", svg: "image", avif: "image", gif: "image",
  mp3: "audio", m4a: "audio", ogg: "audio", wav: "audio",
  json: "data", atlas: "data",
});
const ASSETS_PREFIX = "assets/";

function extensionOf(path) {
  return path.match(/\.([^./]+)$/u)?.[1]?.toLowerCase() ?? "";
}

function stem(path) {
  return path.slice(ASSETS_PREFIX.length).replace(/\.[^./]+$/u, "");
}

// The readable id a new file gets: its path under assets/ without the extension, "/" -> "."; the extension is added
// only when another asset would share that id (taken: ids already in use).
export function assetIdForPath(path, taken = new Set()) {
  const base = stem(path).split("/").join(".");
  return taken.has(base) ? `${base}.${extensionOf(path)}` : base;
}

// Files of the working tree (tracked, under assets/) -> assets keyed by their path (a Spine package by its .json).
// files: [{ path, bytes, sha256 }]; atlasTextures: { atlasPath: ["texture.webp", ...] } (names relative to the atlas).
export function collectAssets(files, atlasTextures = {}) {
  const byPath = new Map(files.filter((file) => file.path.startsWith(ASSETS_PREFIX) && MEDIA_KINDS[extensionOf(file.path)])
    .map((file) => [file.path, file]));
  const assets = new Map();
  const packaged = new Set();
  for (const file of byPath.values()) {
    if (extensionOf(file.path) !== "json") continue;
    const atlasPath = file.path.replace(/\.json$/u, ".atlas");
    if (!byPath.has(atlasPath)) continue;
    const directory = file.path.slice(0, file.path.lastIndexOf("/") + 1);
    const textures = (atlasTextures[atlasPath] ?? []).map((name) => `${directory}${name}`);
    const missing = textures.find((texture) => !byPath.has(texture));
    if (missing) throw new Error(`${atlasPath} names ${missing}, which is not a tracked asset`);
    const parts = [file, byPath.get(atlasPath), ...textures.map((texture) => byPath.get(texture))];
    for (const part of parts) packaged.add(part.path);
    assets.set(file.path, { kind: "spine", json: file.path, atlas: atlasPath, textures,
      bytes: parts.reduce((sum, part) => sum + part.bytes, 0), sha256: parts.map((part) => part.sha256).join("+") });
  }
  for (const file of byPath.values()) {
    if (packaged.has(file.path)) continue;
    assets.set(file.path, { kind: MEDIA_KINDS[extensionOf(file.path)], path: file.path, bytes: file.bytes, sha256: file.sha256 });
  }
  return assets;
}

function keyOf(entry) {
  return entry.kind === "spine" ? entry.json : entry.path;
}

function tagsOf(key) {
  return stem(key).split("/").slice(0, -1);
}

// previous: { id: entry } (the registry as committed); referencedIds: ids used by code, configuration or the load plan.
// Returns the new registry (ids sorted), what changed, duplicate contents and the errors that stop the sync.
export function syncAssetRegistry({ previous = {}, assets, moved = [], renames = [], referencedIds = new Set(), prune = false }) {
  const registry = {};
  const report = { added: [], moved: [], updated: [], removed: [], duplicates: [] };
  const errors = [];
  const previousByKey = new Map(Object.entries(previous).map(([id, entry]) => [keyOf(entry), id]));
  const keep = (id, key, entry, from) => {
    const old = previous[id];
    registry[id] = { ...entry, tags: old?.tags ?? tagsOf(key), label: old?.label ?? "" };
    if (from) report.moved.push({ id, from, to: key });
    else if (old && (old.sha256 !== entry.sha256 || old.bytes !== entry.bytes)) report.updated.push(id);
  };
  const fresh = [];
  for (const [key, entry] of assets) {
    if (previousByKey.has(key)) keep(previousByKey.get(key), key, entry, null);
    else fresh.push([key, entry]);
  }
  const vanished = new Map([...previousByKey].filter(([key]) => !assets.has(key)).map(([key, id]) => [id, key]));
  const claim = (id, key, entry) => {
    keep(id, key, entry, vanished.get(id));
    vanished.delete(id);
  };
  const findVanished = (pairs, key) => {
    const pair = pairs.find(([, to]) => to === key);
    return pair ? [...vanished].find(([, from]) => from === pair[0])?.[0] ?? null : null;
  };
  const added = [];
  for (const [key, entry] of fresh) {
    const hinted = findVanished(moved, key);
    if (hinted) { claim(hinted, key, entry); continue; }
    const sameContent = [...vanished.keys()].filter((id) => previous[id].sha256 === entry.sha256);
    if (sameContent.length > 1) {
      errors.push(`${key} has the content of ${sameContent.join(", ")}; name the move with --moved <old> ${key}`);
      continue;
    }
    if (sameContent.length === 1) { claim(sameContent[0], key, entry); continue; }
    const renamed = findVanished(renames, key);
    if (renamed) { claim(renamed, key, entry); continue; }
    added.push([key, entry]);
  }
  const stems = new Map();
  for (const key of assets.keys()) stems.set(stem(key), (stems.get(stem(key)) ?? 0) + 1);
  for (const [key, entry] of added) {
    const shared = stems.get(stem(key)) > 1 ? new Set([stem(key).split("/").join(".")]) : new Set();
    const id = assetIdForPath(key, shared);
    if (registry[id] || vanished.has(id)) {
      errors.push(`${key} would take the id ${id} of another asset; name the move with --moved, or --prune the old one`);
      continue;
    }
    registry[id] = { ...entry, tags: tagsOf(key), label: "" };
    report.added.push(id);
  }
  for (const [id, key] of vanished) {
    if (referencedIds.has(id)) errors.push(`${key} (${id}) is gone but still referenced; restore it or name its move with --moved`);
    else if (prune) report.removed.push(id);
    else errors.push(`${key} (${id}) is gone; name its move with --moved <old> <new>, or remove it with --prune`);
  }
  const sorted = Object.fromEntries(Object.keys(registry).sort().map((id) => [id, registry[id]]));
  const byContent = new Map();
  for (const [id, entry] of Object.entries(sorted)) {
    if (byContent.has(entry.sha256)) report.duplicates.push([byContent.get(entry.sha256), id]);
    else byContent.set(entry.sha256, id);
  }
  return { registry: sorted, report, errors };
}

// The texture file names an atlas declares (the first line of each page: a name with an image extension).
export function atlasTextureNames(atlasText) {
  return String(atlasText).split(/\r?\n/u).map((line) => line.trim())
    .filter((line) => /^[^:\s][^:]*\.(?:webp|png|jpg|jpeg)$/iu.test(line));
}
