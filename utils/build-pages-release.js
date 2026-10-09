"use strict";

// Builds an immutable GitHub Pages release from a commit (owner decision 1, spec 038):
//   <site>/releases/<version>-<commit>/  index.html, its stylesheets, the production module graph, tracked assets
//   <site>/index.html                    the release page with <base href="releases/<version>-<commit>/">
// Files are the committed bytes. A published release directory is never overwritten, and nothing else in the site
// is removed, so older tabs and cached pages keep a consistent set of files. Publishing (commit and push of the
// site checkout) is a separate, manual step.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const acorn = require("acorn");

const PAGE = "index.html";
const VERSION_FILE = "src/game/presentation/version/project_version.js";
const ASSETS_PREFIX = "assets/";

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

// What the production page needs: the page, its stylesheets, the module graph of its entry and the assets that
// gameplay addresses by path at runtime.
class ReleaseFileSet {
  static collect(tree) {
    const page = tree.read(PAGE).toString("utf8");
    const files = new Set([PAGE]);
    for (const href of ReleaseFileSet.#attributeValues(page, "link", "href", /\brel="stylesheet"/u)) {
      files.add(ReleaseFileSet.#projectPath(tree, href));
    }
    const entries = ReleaseFileSet.#attributeValues(page, "script", "src", /\btype="module"/u);
    if (entries.length !== 1) throw new Error(`${PAGE} must load exactly one module entry`);
    for (const file of ReleaseFileSet.#moduleGraph(tree, ReleaseFileSet.#projectPath(tree, entries[0]))) {
      files.add(file);
    }
    for (const file of tree.paths()) if (file.startsWith(ASSETS_PREFIX)) files.add(file);
    return [...files].sort();
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

  build(siteDir) {
    const id = this.releaseId();
    const releaseDir = path.join(siteDir, "releases", id);
    if (fs.existsSync(releaseDir)) {
      throw new Error(`Release ${id} is already published in ${siteDir}; published releases are never overwritten`);
    }
    const files = ReleaseFileSet.collect(this.#tree);
    const hidden = files.find((file) => file.split("/").some((segment) => /^[_.]/u.test(segment)));
    if (hidden) throw new Error(`GitHub Pages would hide ${hidden}`);
    const contents = this.#tree.readAll(files);
    // Write into a temporary sibling first so an interrupted build never leaves a partial release under its id.
    const stagingDir = `${releaseDir}.partial-${process.pid}`;
    fs.rmSync(stagingDir, { recursive: true, force: true });
    let bytes = 0;
    for (const file of files) {
      const target = path.join(stagingDir, ...file.split("/"));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, contents.get(file));
      bytes += contents.get(file).length;
    }
    fs.renameSync(stagingDir, releaseDir);
    fs.writeFileSync(path.join(siteDir, PAGE), PagesReleaseBuilder.rootPage(contents.get(PAGE).toString("utf8"), id));
    return Object.freeze({ id, releaseDir, files: Object.freeze(files), bytes });
  }

  // The release page with every relative URL (stylesheets, entry, runtime assets) resolved inside the release.
  static rootPage(html, id) {
    if (/<base\b/iu.test(html)) throw new Error(`${PAGE} must not declare <base>`);
    const heads = [...html.matchAll(/<head>\n/gu)];
    if (heads.length !== 1) throw new Error(`${PAGE} must contain one <head> line`);
    const index = heads[0].index + heads[0][0].length;
    return `${html.slice(0, index)}    <base href="releases/${id}/" />\n${html.slice(index)}`;
  }
}

function readSiteArgument(argv) {
  const index = argv.indexOf("--site");
  const site = index === -1 ? "" : argv[index + 1] || "";
  if (!site) throw new Error("Usage: npm run release:pages -- --site <gh-pages checkout> [--ref <commit>]");
  const refIndex = argv.indexOf("--ref");
  return { site: path.resolve(site), ref: refIndex === -1 ? "HEAD" : argv[refIndex + 1] };
}

if (require.main === module) {
  try {
    const { site, ref } = readSiteArgument(process.argv.slice(2));
    if (!fs.existsSync(site)) throw new Error(`Site directory does not exist: ${site}`);
    const tree = new GitCommitTree({ rootDir: path.resolve(__dirname, ".."), ref });
    const release = new PagesReleaseBuilder({ tree }).build(site);
    console.log(`Release ${release.id}: ${release.files.length} files, ${release.bytes} bytes in ${release.releaseDir}.`);
    console.log("Root index.html now loads it. Review, then commit and push the site checkout to publish.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { GitCommitTree, ReleaseFileSet, PagesReleaseBuilder };
