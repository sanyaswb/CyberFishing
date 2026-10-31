"use strict";

// Builds an immutable GitHub Pages release from a commit (owner decision 1, spec 038):
//   <site>/releases/<version>-<commit>/  the release folder of utils/build-release.js (spec 157 R13): the committed game
//     and DEV pages, stylesheets, source modules, tracked assets and vendor licences, plus build/ (bundles, boot modules)
//   <site>/index.html, dev.html, ui-catalog.html  the release pages with <base href="releases/<version>-<commit>/">, a
//     <link rel="preload" as="style"> per stylesheet and a <link rel="modulepreload"> for the boot module, the bundle and
//     every chunk it reaches (spec 157 B, R13)
// Files are the committed bytes, except build/ and the pages' module script, which points at the boot module. A
// published release directory is never overwritten. Retention (owner decision 2026-10-15, spec 085): the site keeps the
// new release and, with keep 2 (default), the release that was live before it, so open tabs of the previous version and
// a rollback still work; older releases are removed. Other root files are left alone. Publishing (commit and push of
// the site checkout) is a separate, manual step.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const acorn = require("acorn");
const { ReleaseBundleBuilder } = require("./build-release.js");

const PAGE = "index.html";
const DEV_PAGE = "dev.html";
const CATALOG_PAGE = "ui-catalog.html";
const VERSION_FILE = "src/game/presentation/version/project_version.js";
const ASSETS_PREFIX = "assets/";
const DEV_METADATA_PREFIX = "src/dev/metadata/";
const VENDOR_MANIFEST = "vendor/manifest.json";

class GitCommitTree {
  #rootDir;
  #ref;
  #blobs = null;

  constructor({ rootDir, ref = "HEAD" }) {
    this.#rootDir = rootDir;
    this.#ref = ref;
  }

  shortCommit() {
    return this.#git(["rev-parse", "--short=7", `${this.#ref}^{commit}`]).toString("utf8").trim();
  }

  paths() {
    return [...this.#blobIds().keys()];
  }

  has(file) {
    return this.#blobIds().has(file);
  }

  // Raw committed bytes (no checkout filters), read in one batch.
  readAll(files) {
    const ids = files.map((file) => {
      const id = this.#blobIds().get(file);
      if (!id) throw new Error(`${file} is not committed in ${this.#ref}`);
      return id;
    });
    const output = this.#git(["cat-file", "--batch"], ids.join("\n") + "\n");
    const contents = new Map();
    let offset = 0;
    for (const file of files) {
      const headerEnd = output.indexOf(0x0a, offset);
      const [, type, size] = output.subarray(offset, headerEnd).toString("utf8").split(" ");
      if (type !== "blob") throw new Error(`${file} is not a blob`);
      const start = headerEnd + 1;
      contents.set(file, output.subarray(start, start + Number(size)));
      offset = start + Number(size) + 1;
    }
    return contents;
  }

  read(file) {
    return this.readAll([file]).get(file);
  }

  #blobIds() {
    if (this.#blobs) return this.#blobs;
    this.#blobs = new Map();
    const listing = this.#git(["ls-tree", "-r", "-z", "--full-tree", this.#ref]).toString("utf8");
    for (const entry of listing.split("\0")) {
      if (!entry) continue;
      const [meta, file] = entry.split("\t");
      const [, type, id] = meta.split(" ");
      if (type === "blob") this.#blobs.set(file, id);
    }
    return this.#blobs;
  }

  #git(args, input = undefined) {
    const result = spawnSync("git", args, {
      cwd: this.#rootDir,
      input,
      maxBuffer: 1024 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString("utf8").trim()}`);
    }
    return result.stdout;
  }
}

// What the published pages need: their stylesheets, module graphs and the assets that gameplay addresses by path.
class ReleaseFileSet {
  static collect(tree, { pages = [PAGE, ...[DEV_PAGE, CATALOG_PAGE].filter(page => tree.has(page))] } = {}) {
    const files = new Set(pages);
    for (const pageName of pages) {
      const page = tree.read(pageName).toString("utf8");
      for (const href of ReleaseFileSet.#attributeValues(page, "link", "href", /\brel="stylesheet"/u)) {
        files.add(ReleaseFileSet.#projectPath(tree, href));
      }
      const entries = ReleaseFileSet.#attributeValues(page, "script", "src", /\btype="module"/u);
      if (entries.length > 1 || (entries.length === 0 && pageName !== CATALOG_PAGE)) {
        throw new Error(`${pageName} must load exactly one module entry`);
      }
      if (entries.length === 1) {
        for (const file of ReleaseFileSet.#moduleGraph(tree, ReleaseFileSet.#projectPath(tree, entries[0]))) {
          files.add(file);
        }
      }
    }
    for (const file of tree.paths()) {
      if (file.startsWith(ASSETS_PREFIX) || (pages.includes(DEV_PAGE) &&
        file.startsWith(DEV_METADATA_PREFIX) && file.endsWith(".json"))) files.add(file);
    }
    for (const license of ReleaseFileSet.#vendorLicenses(tree, files)) files.add(license);
    return [...files].sort();
  }

  // Spec 157 R1/R2: what a page's root copy announces up front: its stylesheets in page order, and every module of its
  // graph (static and dynamic imports alike: every dynamic import but the DEV House screen is on the startup path),
  // the entry as the page writes it, then breadth-first from it, nearest the entry first.
  static pagePreloads(tree, pageName) {
    const page = tree.read(pageName).toString("utf8");
    const styles = ReleaseFileSet.#attributeValues(page, "link", "href", /\brel="stylesheet"/u);
    const [entry] = ReleaseFileSet.#attributeValues(page, "script", "src", /\btype="module"/u);
    if (!entry) return Object.freeze({ styles, modules: [] });
    const entryFile = ReleaseFileSet.#projectPath(tree, entry);
    const graph = [...ReleaseFileSet.#moduleGraph(tree, entryFile)].filter((file) => file !== entryFile);
    return Object.freeze({ styles, modules: [entry, ...graph] });
  }

  // A released vendor module ships with its licence from the manifest: the Spine Runtimes License and the MIT notices
  // require it with every copy (specs 099, 103).
  static #vendorLicenses(tree, files) {
    if (!tree.has(VENDOR_MANIFEST)) return [];
    const licenses = [];
    for (const entry of JSON.parse(tree.read(VENDOR_MANIFEST).toString("utf8")).packages ?? []) {
      if (!files.has(entry.file)) continue;
      if (!tree.has(entry.license)) throw new Error(`${entry.file} is released without its committed licence ${entry.license}`);
      licenses.push(entry.license);
    }
    return licenses;
  }

  static #attributeValues(html, tag, attribute, filter) {
    const values = [];
    for (const match of html.replace(/<!--[^]*?-->/gu, "").matchAll(new RegExp(`<${tag}\\b[^>]*>`, "giu"))) {
      if (!filter.test(match[0])) continue;
      const value = match[0].match(new RegExp(`\\b${attribute}="([^"]+)"`, "u"));
      if (value) values.push(value[1]);
    }
    return values;
  }

  static #projectPath(tree, url) {
    const file = path.posix.normalize(decodeURIComponent(url.split(/[?#]/u, 1)[0]));
    if (/^(?:[a-z]+:|\/|\.\.)/iu.test(file)) throw new Error(`${PAGE} must use project-relative paths: ${url}`);
    if (!tree.has(file)) throw new Error(`${PAGE} references ${file}, which is not committed`);
    return file;
  }

  // Breadth-first, one batched blob read per import level.
  static #moduleGraph(tree, entry) {
    const modules = new Set([entry]);
    let level = [entry];
    while (level.length > 0) {
      const sources = tree.readAll(level);
      const next = [];
      for (const file of level) {
        const ast = acorn.parse(sources.get(file).toString("utf8"), { ecmaVersion: "latest", sourceType: "module" });
        for (const specifier of ReleaseFileSet.#specifiers(ast)) {
          if (typeof specifier !== "string" || !/^\.\.?\//u.test(specifier)) {
            throw new Error(`${file} has an import the release cannot follow: ${specifier}`);
          }
          const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
          if (!tree.has(target)) throw new Error(`${file} imports ${target}, which is not committed`);
          if (!modules.has(target)) {
            modules.add(target);
            next.push(target);
          }
        }
      }
      level = next;
    }
    return modules;
  }

  static #specifiers(ast) {
    const specifiers = [];
    const visit = (node) => {
      if (!node || typeof node.type !== "string") return;
      if (["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(node.type) && node.source) {
        specifiers.push(node.source.value);
      }
      if (node.type === "ImportExpression") {
        specifiers.push(node.source.type === "Literal" ? node.source.value : null);
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value.type === "string") visit(value);
      }
    };
    visit(ast);
    return specifiers;
  }
}

class PagesReleaseBuilder {
  #tree;

  constructor({ tree }) {
    this.#tree = tree;
  }

  releaseId() {
    const source = this.#tree.read(VERSION_FILE).toString("utf8");
    const version = source.match(/const\s+CURRENT_PROJECT_VERSION\s*=\s*"([^"]+)";/u)?.[1];
    if (!version) throw new Error(`Cannot read CURRENT_PROJECT_VERSION from ${VERSION_FILE}`);
    return `${version}-${this.#tree.shortCommit()}`;
  }

  build(siteDir, { keep = 2 } = {}) {
    if (keep !== 1 && keep !== 2) throw new Error("keep must be 1 (new release only) or 2 (new and previous live)");
    const id = this.releaseId();
    const previous = PagesReleaseBuilder.liveRelease(siteDir);
    const releaseDir = path.join(siteDir, "releases", id);
    if (fs.existsSync(releaseDir)) {
      throw new Error(`Release ${id} is already published in ${siteDir}; published releases are never overwritten`);
    }
    // Write into a temporary sibling first so an interrupted build never leaves a partial release under its id.
    const stagingDir = `${releaseDir}.partial-${process.pid}`;
    fs.rmSync(stagingDir, { recursive: true, force: true });
    let release;
    try {
      release = this.buildRelease(stagingDir);
    } catch (error) {
      fs.rmSync(stagingDir, { recursive: true, force: true });
      throw error;
    }
    fs.renameSync(stagingDir, releaseDir);
    for (const page of [PAGE, DEV_PAGE, CATALOG_PAGE].filter((name) => release.files.includes(name))) {
      fs.writeFileSync(path.join(siteDir, page), PagesReleaseBuilder.rootPage(
        fs.readFileSync(path.join(releaseDir, page), "utf8"), id));
    }
    const removed = PagesReleaseBuilder.#prune(siteDir, new Set(keep === 2 && previous ? [id, previous] : [id]));
    return Object.freeze({ id, releaseDir, files: release.files, bytes: release.bytes, bundle: release.bundle, previous,
      removed: Object.freeze(removed) });
  }

  // Spec 157 R13: the self-contained release folder (any static host or the game server serves it as it is): the
  // committed release files, then build/ with the bundles and the boot modules, each game page pointing at its boot
  // module and announcing, right after <head>, a style preload per stylesheet and a modulepreload for the boot module,
  // the bundle and every chunk it reaches (preloads[page]), so a server gets the same parallel start as Pages.
  buildRelease(releaseDir) {
    const files = ReleaseFileSet.collect(this.#tree);
    const hidden = files.find((file) => file.split("/").some((segment) => /^[_.]/u.test(segment)));
    if (hidden) throw new Error(`GitHub Pages would hide ${hidden}`);
    const contents = this.#tree.readAll(files);
    let bytes = 0;
    for (const file of files) {
      const target = path.join(releaseDir, ...file.split("/"));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, contents.get(file));
      bytes += contents.get(file).length;
    }
    const bundle = ReleaseBundleBuilder.build({ releaseDir,
      pagePreloads: (page) => ReleaseFileSet.pagePreloads(this.#tree, page) });
    const preloads = {};
    for (const page of [PAGE, DEV_PAGE, CATALOG_PAGE].filter((name) => files.includes(name))) {
      const built = bundle.pages[page];
      const { styles } = ReleaseFileSet.pagePreloads(this.#tree, page);
      preloads[page] = Object.freeze({ styles, modules: built ? [built.boot, built.bundle, ...built.chunks] : [] });
      if (!built) continue;
      const target = path.join(releaseDir, page);
      fs.writeFileSync(target, PagesReleaseBuilder.withPreloads(fs.readFileSync(target, "utf8"), preloads[page]));
    }
    for (const file of bundle.files) bytes += fs.statSync(path.join(releaseDir, ...file.split("/"))).size;
    return Object.freeze({ id: this.releaseId(), files: Object.freeze([...files, ...bundle.files].sort()), bytes, bundle,
      preloads: Object.freeze(preloads) });
  }

  // The release the root page loads now (its <base href="releases/<id>/">), or null.
  static liveRelease(siteDir) {
    const page = path.join(siteDir, PAGE);
    if (!fs.existsSync(page)) return null;
    return fs.readFileSync(page, "utf8").match(/<base href="releases\/([^/"]+)\/"/u)?.[1] ?? null;
  }

  static #prune(siteDir, retained) {
    const releasesDir = path.join(siteDir, "releases");
    const removed = [];
    for (const entry of fs.readdirSync(releasesDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || retained.has(entry.name) || entry.name.includes(".partial-")) continue;
      fs.rmSync(path.join(releasesDir, entry.name), { recursive: true, force: true });
      removed.push(entry.name);
    }
    return removed.sort();
  }

  // The release page with every relative URL (stylesheets, entry, runtime assets) resolved inside the release: <base>
  // as the first line of <head>, before the page's preloads, so they too resolve inside the release.
  static rootPage(html, id) {
    if (/<base\b/iu.test(html)) throw new Error(`${PAGE} must not declare <base>`);
    const index = PagesReleaseBuilder.#headEnd(html);
    return `${html.slice(0, index)}    <base href="releases/${id}/" />\n${html.slice(index)}`;
  }

  // The page with its preloads right after <head>: the stylesheets first (small, needed for the first styled frame),
  // then the modules.
  static withPreloads(html, { styles = [], modules = [] }) {
    const index = PagesReleaseBuilder.#headEnd(html);
    const href = (url) => {
      if (!/^[\w./?=@-]+$/u.test(url)) throw new Error(`Preload URL needs escaping: ${url}`);
      return url;
    };
    const preloads = [...styles.map((url) => `    <link rel="preload" as="style" href="${href(url)}" />\n`),
      ...modules.map((url) => `    <link rel="modulepreload" href="${href(url)}" />\n`)].join("");
    return `${html.slice(0, index)}${preloads}${html.slice(index)}`;
  }

  static #headEnd(html) {
    const heads = [...html.matchAll(/<head>\n/gu)];
    if (heads.length !== 1) throw new Error(`${PAGE} must contain one <head> line`);
    return heads[0].index + heads[0][0].length;
  }
}

function readSiteArgument(argv) {
  const index = argv.indexOf("--site");
  const site = index === -1 ? "" : argv[index + 1] || "";
  if (!site) throw new Error("Usage: npm run release:pages -- --site <gh-pages checkout> [--ref <commit>] [--keep 1|2]");
  const refIndex = argv.indexOf("--ref");
  const keepIndex = argv.indexOf("--keep");
  return { site: path.resolve(site), ref: refIndex === -1 ? "HEAD" : argv[refIndex + 1],
    keep: keepIndex === -1 ? 2 : Number(argv[keepIndex + 1]) };
}

if (require.main === module) {
  try {
    const { site, ref, keep } = readSiteArgument(process.argv.slice(2));
    if (!fs.existsSync(site)) throw new Error(`Site directory does not exist: ${site}`);
    const tree = new GitCommitTree({ rootDir: path.resolve(__dirname, ".."), ref });
    const release = new PagesReleaseBuilder({ tree }).build(site, { keep });
    console.log(`Release ${release.id}: ${release.files.length} files, ${release.bytes} bytes in ${release.releaseDir}.`);
    console.log(`Kept ${release.previous && keep === 2 ? `the previous live release ${release.previous}` : "no older release"}; ` +
      `removed ${release.removed.length ? release.removed.join(", ") : "nothing"}.`);
    console.log("Root index.html and dev.html now load it. Review, then commit and push the site checkout to publish.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { GitCommitTree, ReleaseFileSet, PagesReleaseBuilder };
