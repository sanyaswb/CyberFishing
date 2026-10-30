"use strict";

// Immutable Pages release (spec 038): builds the committed HEAD into a temporary site and checks the release.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { GitCommitTree, ReleaseFileSet, PagesReleaseBuilder } = require("../../build-pages-release.js");

const tree = new GitCommitTree({ rootDir: path.resolve(__dirname, "../../..") });
// The root page's preloads (spec 157 stage B), as the release writes them after <base>.
const preloadLines = (page) => {
  const { styles, modules } = ReleaseFileSet.pagePreloads(tree, page);
  return [...styles.map((url) => `    <link rel="preload" as="style" href="${url}" />\n`),
    ...modules.map((url) => `    <link rel="modulepreload" href="${url}" />\n`)].join("");
};
const site = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-fishing-pages-"));
try {
  // An earlier release and the old root files must survive.
  // The live release (named by the root page) and an older one; retention keeps only the live one (spec 085).
  const olderRelease = path.join(site, "releases", "0.0.1-0000000", "index.html");
  const staleRelease = path.join(site, "releases", "0.0.0-ffffff0", "index.html");
  const oldRootFile = path.join(site, "src", "old.js");
  for (const file of [olderRelease, staleRelease, oldRootFile]) fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(olderRelease, "older release");
  fs.writeFileSync(staleRelease, "stale release");
  fs.writeFileSync(oldRootFile, "// old root file");
  fs.writeFileSync(path.join(site, "index.html"), '<head>\n    <base href="releases/0.0.1-0000000/" />\n</head>');

  const builder = new PagesReleaseBuilder({ tree });
  const release = builder.build(site);
  assert.equal(release.id, `${tree.read("src/game/presentation/version/project_version.js").toString("utf8")
    .match(/CURRENT_PROJECT_VERSION = "([^"]+)"/u)[1]}-${tree.shortCommit()}`, "release id is <version>-<commit>");
  assert.match(release.id, /^\d+\.\d+\.\d+-[0-9a-f]{7}$/u);

  const files = new Set(release.files);
  const page = tree.read("index.html").toString("utf8");
  for (const [, href] of page.matchAll(/href="([^"?]+\.css)[^"]*"/gu)) assert(files.has(href), `stylesheet ${href} is released`);
  assert(files.has("src/entrypoints/game.entry.js"));
  if (tree.has("dev.html")) {
    const devPage = tree.read("dev.html").toString("utf8");
    assert(files.has("dev.html"));
    assert(files.has("src/entrypoints/dev.entry.js"));
    assert(files.has("src/dev/styles/dev-tools.css"));
    for (const metadata of tree.paths().filter((file) => file.startsWith("src/dev/metadata/") && file.endsWith(".json"))) {
      assert(files.has(metadata), `DEV metadata ${metadata} is released`);
    }
    for (const [, href] of devPage.matchAll(/href="([^"?]+\.css)[^"]*"/gu)) {
      assert(files.has(href), `DEV stylesheet ${href} is released`);
    }
    assert.equal(fs.readFileSync(path.join(site, "dev.html"), "utf8"),
      devPage.replace("<head>\n", `<head>\n    <base href="releases/${release.id}/" />\n${preloadLines("dev.html")}`),
      "the root DEV page resolves its files inside the release and announces its stylesheets and modules");
  }
  // Spec 082: published raster art is WebP; masters stay in asset-sources/ and are never released.
  assert(![...files].some((file) => file.startsWith("assets/") && /\.(png|jpe?g)$/iu.test(file)),
    "released raster assets are WebP");
  assert(![...files].some((file) => file.startsWith("asset-sources/")), "image masters are not released");
  // Spec 157 R6: one file per item art; two files with the same bytes are two downloads of one picture (the bamboo
  // rod's with-line and no-line arts were one picture in two files until v0.49.28).
  // The tracked item art as it is now (the index and the working files), so a duplicate fails before its commit.
  const rootDir = path.resolve(__dirname, "../../..");
  const itemArt = require("node:child_process").spawnSync("git", ["ls-files", "-z", "assets/items"], { cwd: rootDir })
    .stdout.toString("utf8").split("\0").filter((file) => file && fs.existsSync(path.join(rootDir, file)));
  const byDigest = new Map();
  for (const file of itemArt) {
    const digest = require("node:crypto").createHash("sha256").update(fs.readFileSync(path.join(rootDir, file))).digest("hex");
    assert(!byDigest.has(digest), `${file} repeats the bytes of ${byDigest.get(digest)}; point both fields at one file`);
    byDigest.set(digest, file);
  }
  // Spec 084: the House is a screen of the DEV page (the lobby will compose it in production), not a page.
  assert(!tree.has("fisherman-house.html") && !files.has("fisherman-house.html"), "no separate House page");
  if (tree.has("dev.html") && tree.has("src/bootstrap/production/house_screen_composition.js")) {
    for (const file of ["src/game/presentation/styles/house.css", "src/bootstrap/production/house_screen_composition.js",
      "src/game/presentation/house/house_screen_markup.js"]) assert(files.has(file), `the lazy House screen releases ${file}`);
    assert(files.has("assets/house/room-1/room--1_aqua.webp"));
    assert(files.has("assets/house/room-1/under-renovation.webp"));
    for (let level = 1; level <= 5; level++) {
      const prefix = `assets/house/room-1/lvl-${level}/room--1-`;
      assert([...files].filter((file) => file.startsWith(prefix)).length === 3,
        `room level ${level} has day, evening and night backgrounds`);
    }
  }
  if (tree.has("ui-catalog.html")) {
    const catalogPage = tree.read("ui-catalog.html").toString("utf8");
    assert(files.has("ui-catalog.html"));
    for (const [, href] of catalogPage.matchAll(/href="([^"?]+\.css)[^"]*"/gu)) assert(files.has(href));
    assert.equal(fs.readFileSync(path.join(site, "ui-catalog.html"), "utf8"),
      catalogPage.replace("<head>\n", `<head>\n    <base href="releases/${release.id}/" />\n`));
  }
  for (const file of tree.paths().filter((file) => file.startsWith("assets/"))) assert(files.has(file), `asset ${file} is released`);
  // Specs 099, 103: every released vendor module ships with its manifest licence.
  if (tree.has("vendor/manifest.json")) {
    for (const entry of JSON.parse(tree.read("vendor/manifest.json").toString("utf8")).packages) {
      if (!files.has(entry.file)) continue;
      assert(files.has(entry.license), `${entry.license} is released with ${entry.file}`);
      assert(fs.readFileSync(path.join(release.releaseDir, entry.license)).equals(tree.read(entry.license)));
    }
  }
  // The release is closed: every module it contains imports only released modules (dynamic imports included).
  const modules = [...files].filter((file) => file.endsWith(".js"));
  const resolvedTargets = new Set();
  for (const file of modules) {
    const source = fs.readFileSync(path.join(release.releaseDir, file), "utf8");
    for (const [, specifier] of source.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)"(\.{1,2}\/[^"]+\.js)"/gu)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
      assert(files.has(target), `${file} imports ${target}, which the release lacks`);
      resolvedTargets.add(target);
    }
  }
  assert(resolvedTargets.size > 400, "the production graph was followed");

  const contents = tree.readAll(release.files);
  for (const file of release.files) {
    assert(fs.readFileSync(path.join(release.releaseDir, ...file.split("/"))).equals(contents.get(file)), `${file} has the committed bytes`);
  }
  const root = fs.readFileSync(path.join(site, "index.html"), "utf8");
  assert.equal(root, page.replace("<head>\n", `<head>\n    <base href="releases/${release.id}/" />\n${preloadLines("index.html")}`),
    "the root page is the release page resolved inside the release, with its preloads");
  // Spec 157 stage B: one modulepreload per module of the page's graph (the entry first, as the page writes it, then
  // nothing missing and nothing extra) and one style preload per stylesheet in page order.
  for (const name of ["index.html", "dev.html"].filter((file) => tree.has(file))) {
    const published = fs.readFileSync(path.join(site, name), "utf8");
    const source = tree.read(name).toString("utf8");
    const preloaded = [...published.matchAll(/<link rel="modulepreload" href="([^"]+)" \/>/gu)].map((match) => match[1]);
    const entry = source.match(/<script type="module" src="([^"]+)"/u)[1];
    assert.equal(preloaded[0], entry, `${name}: the entry is preloaded first, with its query`);
    assert.equal(new Set(preloaded).size, preloaded.length, `${name}: no module is preloaded twice`);
    const released = new Set(release.files);
    for (const module of preloaded.slice(1)) assert(released.has(module), `${name}: preloaded ${module} is released`);
    assert(preloaded.includes("src/bootstrap/production/game_composition_root.js"), `${name}: the composition is preloaded`);
    assert(preloaded.includes("vendor/pixi/8.22.0/pixi-scene.js"), `${name}: the dynamically imported scene bundle is preloaded`);
    const styles = [...source.matchAll(/<link rel="stylesheet" href="([^"]+)"/gu)].map((match) => match[1]);
    assert.deepEqual([...published.matchAll(/<link rel="preload" as="style" href="([^"]+)" \/>/gu)].map((match) => match[1]),
      styles, `${name}: every stylesheet is preloaded in page order`);
    assert(published.indexOf("<base ") < published.indexOf("<link rel="), `${name}: preloads resolve inside the release`);
  }
  assert.equal(fs.readFileSync(olderRelease, "utf8"), "older release", "the previously live release is retained");
  assert(!fs.existsSync(path.dirname(staleRelease)), "older releases are removed");
  assert.equal(release.previous, "0.0.1-0000000"); assert.deepEqual([...release.removed], ["0.0.0-ffffff0"]);
  assert.equal(PagesReleaseBuilder.liveRelease(site), release.id, "the root page loads the new release");
  assert.throws(() => builder.build(site, { keep: 3 }), /keep must be 1/u);
  assert.equal(fs.readFileSync(oldRootFile, "utf8"), "// old root file", "old root files are retained");
  assert.deepEqual(fs.readdirSync(path.join(site, "releases")).sort(), ["0.0.1-0000000", release.id].sort(), "no staging left");

  const before = fs.readFileSync(path.join(site, "index.html"));
  assert.throws(() => builder.build(site), /already published.*never overwritten/u, "a published release is never overwritten");
  assert(fs.readFileSync(path.join(site, "index.html")).equals(before), "a refused build leaves the root page alone");

  assert.throws(() => PagesReleaseBuilder.rootPage("<head>\n<base href=\"x/\">", "1.0.0-abcdef0"), /must not declare <base>/u);
  const fakeTree = { read: (file) => Buffer.from(file === "index.html"
    ? '<link rel="stylesheet" href="https://cdn.example/x.css"><script type="module" src="src/e.js"></script>' : ""),
  has: (file) => !["dev.html", "ui-catalog.html"].includes(file), paths: () => [] };
  assert.throws(() => ReleaseFileSet.collect(fakeTree), /project-relative paths/u, "external stylesheets are rejected");

  // New uncommitted catalog code is checked too; the immutable release above still uses HEAD bytes.
  const workspace = path.resolve(__dirname, "../../..");
  const { productionFiles, trackedFiles } = require("../../project-structure.js");
  const authoredTree = {
    has: (file) => fs.existsSync(path.join(workspace, file)),
    read: (file) => fs.readFileSync(path.join(workspace, file)),
    readAll: (requested) => new Map(requested.map((file) => [file, fs.readFileSync(path.join(workspace, file))])),
    paths: () => trackedFiles(workspace),
  };
  const authoredFiles = new Set(ReleaseFileSet.collect(authoredTree));
  // The structure command reads tracked working files, including staged additions (UTILS_RULES.md).
  // HEAD remains the immutable release input above; using its path list here rejects every new imported module.
  const production = productionFiles({ rootDir: workspace });
  assert(production.includes("index.html") && production.some(file => file.startsWith("assets/")),
    "production structure includes the game page and shipped assets");
  assert(production.every(file => authoredFiles.has(file)), "production structure uses the release file selection");
  assert(!production.some(file => /^(?:dev\.html$|ui-catalog\.html$|src\/(?:dev|bootstrap\/development|entrypoints\/dev)\/|utils\/|docs\/|specs\/|\.)/u.test(file)),
    "production structure excludes DEV, tools, tests, docs and repository metadata");
  for (const file of ["ui-catalog.html", "src/game/presentation/house/house_screen_markup.js",
    "src/game/presentation/styles/auto-switch.css", "src/game/presentation/styles/ui-surface.css",
    "src/game/presentation/ui/ui_close_button_renderer.js", "src/game/presentation/ui/ui_auto_switch_renderer.js"]) {
    assert(authoredFiles.has(file), `authored catalog release closure includes ${file}`);
  }

  console.log(`Pages release passed: ${release.id} with ${release.files.length} committed files (page, stylesheets, ` +
    `${modules.length} modules, assets), closed module graph, base-resolved root page, previous live release kept, older ones removed, root files ` +
    "retained, overwrite refused.");
} finally {
  fs.rmSync(site, { recursive: true, force: true });
}
