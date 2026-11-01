"use strict";

// Release bundle (spec 157 R13, owner 2026-10-31): the one release form for GitHub Pages and the game server.
//   npm run build:release -- --out <dir> [--ref <commit>]
// writes a self-contained release folder from a commit: the committed release files (pages, stylesheets, source modules,
// assets, vendor files and licences: the ?esm=1 fallback still runs from them) and build/ with
//   - one esbuild bundle per page entry, split into shared and lazy chunks (minified, with source maps), names hashed;
//   - a small boot module per page (build/<page>.boot-<hash>.js): the startup screen's meter first (spec 157 D5, its own
//     tiny bundle), then the bundle by default, or the source modules when the page address has ?esm=1 (it then fetches
//     build/<page>.esm-<hash>.json, the page's source graph, and adds a modulepreload for each module first);
//   - a startup manifest per page (build/<page>.startup-<hash>.json, spec 157 D5): the files the start transfers (the
//     page, its stylesheets and preloaded modules, the asset load plan's first layer at its largest time-of-day set)
//     with their compressed sizes; the page's startup screen carries the total (data-startup-bytes) for its bar.
// Each page's module script points at its boot module; every URL stays relative, so the folder works under any path
// prefix (Pages: /CyberFishing/releases/<id>/; the server: / or another prefix). The repository and local work stay
// without a build: only a release is built. Server requirements: docs/deployment.md.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const BUILD_DIR = "build";
const PAGES = Object.freeze(["index.html", "dev.html"]);
const METER_ENTRY = "src/entrypoints/game_startup_meter.entry.js";
// Text files the server compresses (docs/deployment.md); media go as they are.
const COMPRESSED = /\.(?:js|mjs|css|json|svg|atlas|html|map)$/iu;

class ReleaseBundleBuilder {
  // releaseDir holds the committed release files already; pagePreloads(page) -> { styles, modules } (ReleaseFileSet).
  static build({ releaseDir, pages = PAGES, pagePreloads }) {
    const esbuild = require("esbuild");
    const present = pages.filter((page) => fs.existsSync(path.join(releaseDir, page)));
    const entries = new Map(present.map((page) => [page, ReleaseBundleBuilder.#entryOf(fs.readFileSync(
      path.join(releaseDir, page), "utf8"), page)]));
    const meter = fs.existsSync(path.join(releaseDir, METER_ENTRY)) ? METER_ENTRY : null;
    const result = esbuild.buildSync({
      absWorkingDir: releaseDir,
      entryPoints: [...new Set([...entries.values()].map((entry) => entry.file)), ...(meter ? [meter] : [])],
      outdir: BUILD_DIR,
      bundle: true,
      splitting: true,
      format: "esm",
      target: "es2022",
      minify: true,
      sourcemap: "linked",
      entryNames: "[name]-[hash]",
      chunkNames: "chunks/[name]-[hash]",
      metafile: true,
      logLevel: "error",
      write: true,
    });
    const outputs = result.metafile.outputs;
    const meterOutput = meter ? Object.keys(outputs).find((file) => outputs[file].entryPoint === meter) : null;
    const meterFile = meterOutput ? ReleaseBundleBuilder.#relative(releaseDir, meterOutput) : null;
    const layerOne = ReleaseBundleBuilder.#layerOneAssets(releaseDir);
    const pagesBuilt = {};
    for (const [page, entry] of entries) {
      const output = Object.keys(outputs).find((file) => outputs[file].entryPoint === entry.file);
      if (!output) throw new Error(`esbuild wrote no bundle for ${entry.file}`);
      const bundle = ReleaseBundleBuilder.#relative(releaseDir, output);
      const chunks = ReleaseBundleBuilder.#closure(outputs, output).map((file) => ReleaseBundleBuilder.#relative(releaseDir, file));
      const { styles, modules } = pagePreloads(page);
      const esmGraph = ReleaseBundleBuilder.#writeHashed(releaseDir, `${page.replace(/\.html$/u, "")}.esm`, "json",
        JSON.stringify(modules));
      const boot = ReleaseBundleBuilder.#writeBoot(releaseDir, page, bundle, entry, esmGraph, meterFile);
      const startModules = [boot, ...(meterFile ? [meterFile] : []), bundle, ...chunks];
      const html = fs.readFileSync(path.join(releaseDir, page), "utf8").replace(entry.tag, entry.tag.replace(entry.src, boot));
      const manifest = ReleaseBundleBuilder.#startupManifest(releaseDir, page, html, [...styles, ...startModules, ...layerOne]);
      const startup = ReleaseBundleBuilder.#writeHashed(releaseDir, `${page.replace(/\.html$/u, "")}.startup`, "json",
        `${JSON.stringify(manifest, null, 2)}\n`);
      fs.writeFileSync(path.join(releaseDir, page), ReleaseBundleBuilder.#withStartupBytes(html, manifest.totalBytes, page));
      pagesBuilt[page] = Object.freeze({ boot, meter: meterFile, bundle, chunks: Object.freeze(chunks), esmGraph, startup,
        startupBytes: manifest.totalBytes });
    }
    const files = ReleaseBundleBuilder.#listFiles(path.join(releaseDir, BUILD_DIR)).map((file) =>
      `${BUILD_DIR}/${file}`);
    return Object.freeze({ pages: Object.freeze(pagesBuilt), files: Object.freeze(files.sort()) });
  }

  // The page's one module script: its tag, its src as written (with any query) and the file it names.
  static #entryOf(html, page) {
    const tags = html.replace(/<!--[^]*?-->/gu, "").match(/<script\b[^>]*\btype="module"[^>]*>/gu) ?? [];
    if (tags.length !== 1) throw new Error(`${page} must load exactly one module entry`);
    const src = tags[0].match(/\bsrc="([^"]+)"/u)?.[1];
    if (!src) throw new Error(`${page} module entry has no src`);
    return { tag: tags[0], src, file: src.split(/[?#]/u)[0] };
  }

  // Every chunk the bundle reaches: the static imports first (they load with it), then the dynamic ones, nearest first.
  // The game requests the dynamic ones during startup too (the scene's Pixi chunk, the composition's loaders), so a
  // root page preloads them all instead of waiting for each import() in turn.
  static #closure(outputs, start) {
    const reach = (kinds) => {
      const seen = new Set([start]);
      const queue = [start];
      while (queue.length > 0) {
        for (const record of outputs[queue.shift()].imports ?? []) {
          if (!kinds.includes(record.kind) || record.external || seen.has(record.path)) continue;
          seen.add(record.path);
          queue.push(record.path);
        }
      }
      seen.delete(start);
      return [...seen];
    };
    const statics = reach(["import-statement"]);
    return [...statics, ...reach(["import-statement", "dynamic-import"]).filter((file) => !statics.includes(file))];
  }

  // build/<page>.boot-<hash>.js: the startup meter, then the page's bundle, or with ?esm=1 its source modules after a
  // modulepreload for each (their list is fetched only then, so a normal start does not carry it).
  static #writeBoot(releaseDir, page, bundle, entry, esmGraph, meterFile) {
    const name = page.replace(/\.html$/u, "");
    const local = (file) => `./${path.posix.relative(BUILD_DIR, file)}`;
    const source = `// Release boot (spec 157 R13, D5), generated by utils/build-release.js: the startup meter, then the bundle;
// ?esm=1 runs the source modules.
${meterFile ? `import ${JSON.stringify(local(meterFile))};\n` : ""}const esm = new URLSearchParams(location.search).has("esm");
if (esm) {
  const graph = await fetch(new URL(${JSON.stringify(local(esmGraph))}, import.meta.url)).then((response) => response.json());
  for (const href of graph) {
    const link = document.createElement("link");
    link.rel = "modulepreload";
    link.href = href;
    document.head.append(link);
  }
}
await import(esm ? ${JSON.stringify(`../${entry.src}`)} : ${JSON.stringify(local(bundle))});
`;
    return ReleaseBundleBuilder.#writeHashed(releaseDir, `${name}.boot`, "js", source);
  }

  // build/<name>-<hash>.<extension> with content-hashed name (immutable caching, docs/deployment.md).
  static #writeHashed(releaseDir, name, extension, source) {
    const hash = crypto.createHash("sha256").update(source).digest("hex").slice(0, 8).toUpperCase();
    const file = `${BUILD_DIR}/${name}-${hash}.${extension}`;
    fs.writeFileSync(path.join(releaseDir, file), source);
    return file;
  }

  // The asset load plan's first layer as files, at its largest time-of-day set (the start's phases depend on the
  // player's game time); a readyOn "low" group counts its low copies. Read from the release's own source modules.
  static #layerOneAssets(releaseDir) {
    const plan = path.join(releaseDir, "src/game/config/raw/assets/asset_load_plan.js");
    if (!fs.existsSync(plan)) return [];
    const script = `
import { statSync } from "node:fs";
const root = process.argv[1];
const load = (file) => import(new URL(file, root).href);
const { AssetRegistry } = await load("src/engine/assets/asset_registry.js");
const { AssetLoadPlan } = await load("src/engine/assets/asset_load_plan.js");
const { ASSET_REGISTRY } = await load("src/game/config/generated/asset_registry.js");
const { ASSET_LOAD_PLAN } = await load("src/game/config/raw/assets/asset_load_plan.js");
const { createAssetLoadSources } = await load("src/bootstrap/production/asset_load_sources.js");
const { CONFIG } = await load("src/game/config/runtime/game_config.js");
const { ITEM_DB } = await load("src/game/config/databases/item_catalog.js");
const assets = new AssetRegistry(ASSET_REGISTRY);
const plan = new AssetLoadPlan({ plan: ASSET_LOAD_PLAN, registry: assets,
  sources: createAssetLoadSources({ locations: CONFIG.locations, itemDb: ITEM_DB }) });
const layer = plan.layers[0];
let best = [];
let bestBytes = -1;
for (const phases of [["day"], ["evening"], ["night"], ["day", "evening"], ["evening", "night"], ["night", "day"]]) {
  const state = { locationId: CONFIG.player?.locationId ?? Object.keys(CONFIG.locations.map)[0], phases };
  const files = layer.groups.filter((group) => group.load).flatMap((group) => plan.resolveGroup(group, state)
    .filter((id) => assets.entryOf(id).kind === "image")
    .map((id) => (group.readyOn === "low" && assets.lowPathOf(id)) || assets.pathOf(id)));
  const bytes = files.reduce((sum, file) => sum + statSync(new URL(file, root)).size, 0);
  if (bytes > bestBytes) { best = files; bestBytes = bytes; }
}
process.stdout.write(JSON.stringify([...new Set(best)]));
`;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script, `${pathToFileURL(releaseDir).href}/`],
      { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`The startup manifest could not read the asset load plan: ${result.stderr.trim()}`);
    return JSON.parse(result.stdout);
  }

  // The files a page's start transfers with their compressed sizes (text gzipped as a server would, media as they are).
  static #startupManifest(releaseDir, page, html, files) {
    const size = (file, buffer) => (COMPRESSED.test(file) ? zlib.gzipSync(buffer).length : buffer.length);
    const entries = [{ path: page, bytes: size(page, Buffer.from(html)) },
      ...[...new Set(files)].map((file) => {
        const target = path.join(releaseDir, ...file.split(/[?#]/u)[0].split("/"));
        if (!fs.existsSync(target)) throw new Error(`The startup manifest names ${file}, which the release lacks`);
        return { path: file, bytes: size(file, fs.readFileSync(target)) };
      })];
    return { page, totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0), files: entries };
  }

  // The page's startup screen with the start's compressed size.
  static #withStartupBytes(html, bytes, page) {
    const tags = html.match(/<div class="startup-loader"/gu) ?? [];
    if (tags.length !== 1) throw new Error(`${page} must have one startup screen`);
    return html.replace('<div class="startup-loader"', `<div class="startup-loader" data-startup-bytes="${bytes}"`);
  }

  static #relative(releaseDir, file) {
    return path.relative(releaseDir, path.resolve(releaseDir, file)).split(path.sep).join("/");
  }

  static #listFiles(dir, prefix = "") {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) out.push(...ReleaseBundleBuilder.#listFiles(path.join(dir, entry.name), relative));
      else out.push(relative);
    }
    return out;
  }
}

function readOptions(argv) {
  const value = (name, fallback) => {
    const index = argv.indexOf(name);
    return index === -1 ? fallback : argv[index + 1];
  };
  const out = value("--out", "");
  if (!out) throw new Error("Usage: npm run build:release -- --out <dir> [--ref <commit>]");
  return { out: path.resolve(out), ref: value("--ref", "HEAD") };
}

// Exported before the command runs: build-pages-release.js requires this module back (a cycle).
module.exports = { ReleaseBundleBuilder, BUILD_DIR };

if (require.main === module) {
  try {
    const { out, ref } = readOptions(process.argv.slice(2));
    const { GitCommitTree, PagesReleaseBuilder } = require("./build-pages-release.js");
    if (fs.existsSync(out) && fs.readdirSync(out).length > 0) throw new Error(`${out} is not empty`);
    const release = new PagesReleaseBuilder({ tree: new GitCommitTree({ rootDir: path.resolve(__dirname, ".."), ref }) })
      .buildRelease(out);
    console.log(`Release ${release.id}: ${release.files.length} files in ${out} (bundles: ${release.bundle.files.length}).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

