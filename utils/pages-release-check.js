"use strict";

// Immutable Pages release (spec 038): builds the committed HEAD into a temporary site and checks the release.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { GitCommitTree, ReleaseFileSet, PagesReleaseBuilder } = require("./build-pages-release.js");

const tree = new GitCommitTree({ rootDir: path.resolve(__dirname, "..") });
const site = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-fishing-pages-"));
try {
  // An earlier release and the old root files must survive.
  const olderRelease = path.join(site, "releases", "0.0.1-0000000", "index.html");
  const oldRootFile = path.join(site, "src", "old.js");
  fs.mkdirSync(path.dirname(olderRelease), { recursive: true });
  fs.mkdirSync(path.dirname(oldRootFile), { recursive: true });
  fs.writeFileSync(olderRelease, "older release");
  fs.writeFileSync(oldRootFile, "// old root file");

  const builder = new PagesReleaseBuilder({ tree });
  const release = builder.build(site);
  assert.equal(release.id, `${tree.read("src/game/presentation/version/project_version.js").toString("utf8")
    .match(/CURRENT_PROJECT_VERSION = "([^"]+)"/u)[1]}-${tree.shortCommit()}`, "release id is <version>-<commit>");
  assert.match(release.id, /^\d+\.\d+\.\d+-[0-9a-f]{7}$/u);

  const files = new Set(release.files);
  const page = tree.read("index.html").toString("utf8");
  for (const [, href] of page.matchAll(/href="([^"?]+\.css)[^"]*"/gu)) assert(files.has(href), `stylesheet ${href} is released`);
  assert(files.has("src/entrypoints/game.entry.js"));
  for (const file of tree.paths().filter((file) => file.startsWith("assets/"))) assert(files.has(file), `asset ${file} is released`);
  assert.equal([...files].some((file) => file.startsWith("src/dev/") || file === "dev.html"), false, "DEV code stays out");

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
  assert.equal(root, page.replace("<head>\n", `<head>\n    <base href="releases/${release.id}/" />\n`),
    "the root page is the release page resolved inside the release");
  assert.equal(fs.readFileSync(olderRelease, "utf8"), "older release", "earlier releases are retained");
  assert.equal(fs.readFileSync(oldRootFile, "utf8"), "// old root file", "old root files are retained");
  assert.deepEqual(fs.readdirSync(path.join(site, "releases")).sort(), ["0.0.1-0000000", release.id].sort(), "no staging left");

  const before = fs.readFileSync(path.join(site, "index.html"));
  assert.throws(() => builder.build(site), /already published.*never overwritten/u, "a published release is never overwritten");
  assert(fs.readFileSync(path.join(site, "index.html")).equals(before), "a refused build leaves the root page alone");

  assert.throws(() => PagesReleaseBuilder.rootPage("<head>\n<base href=\"x/\">", "1.0.0-abcdef0"), /must not declare <base>/u);
  const fakeTree = { read: (file) => Buffer.from(file === "index.html"
    ? '<link rel="stylesheet" href="https://cdn.example/x.css"><script type="module" src="src/e.js"></script>' : ""),
  has: () => true, paths: () => [] };
  assert.throws(() => ReleaseFileSet.collect(fakeTree), /project-relative paths/u, "external stylesheets are rejected");

  console.log(`Pages release passed: ${release.id} with ${release.files.length} committed files (page, stylesheets, ` +
    `${modules.length} modules, assets), closed module graph, base-resolved root page, earlier releases and root files ` +
    "retained, overwrite refused.");
} finally {
  fs.rmSync(site, { recursive: true, force: true });
}
