"use strict";

// Release bundle (spec 157 R13, owner 2026-10-31): the one release form for GitHub Pages and the game server.
//   npm run build:release -- --out <dir> [--ref <commit>]
// writes a self-contained release folder from a commit: the committed release files (pages, stylesheets, source modules,
// assets, vendor files and licences: the ?esm=1 fallback still runs from them) and build/ with
//   - one esbuild bundle per page entry, split into its own shared and lazy chunks (minified, with source maps), names
//     hashed; each page is built on its own, so dev.html's graph does not cut index.html's start into more chunks;
//   - one minified stylesheet per page (build/<page>.styles-<hash>.css, spec 160) in place of the page's stylesheet links,
//     in their order; ?esm=1 uses it too (the same rules, with a source map);
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
// The dynamic imports the start itself makes (spec 157 R12, TK-176 item 2): their chunks are preloaded with the bundle.
// Every other import() — a feature loaded after ready or on first use, spine-webgl of the 2D "canvas" scene mode — stays out
// of the page's preloads. The production start makes none (spec 160).
const START_IMPORTS = Object.freeze([
  "src/bootstrap/development/development_game_startup.js", // dev.html's entry: the timing buffer grows before this graph
]);
// Text files the server compresses (docs/deployment.md); media go as they are.
const COMPRESSED = /\.(?:js|mjs|css|json|svg|atlas|html|map)$/iu;

class ReleaseBundleBuilder {
  // releaseDir holds the committed release files already; pagePreloads(page) -> { styles, modules } (ReleaseFileSet).
  static build({ releaseDir, pages = PAGES, pagePreloads }) {
    const present = pages.filter((page) => fs.existsSync(path.join(releaseDir, page)));
    const entries = new Map(present.map((page) => [page, ReleaseBundleBuilder.#entryOf(fs.readFileSync(
      path.join(releaseDir, page), "utf8"), page)]));
    const meter = fs.existsSync(path.join(releaseDir, METER_ENTRY)) ? METER_ENTRY : null;
    // The meter is its own bundle: shared modules with a page's bundle would be one more chunk of that page's start.
    const meterFile = meter ? ReleaseBundleBuilder.#relative(releaseDir,
      ReleaseBundleBuilder.#outputOf(ReleaseBundleBuilder.#bundle(releaseDir, meter), meter)) : null;
    const layerOne = ReleaseBundleBuilder.#layerOneAssets(releaseDir);
    const pagesBuilt = {};
    for (const [page, entry] of entries) {
      const name = page.replace(/\.html$/u, "");
      const outputs = ReleaseBundleBuilder.#bundle(releaseDir, entry.file);
      const output = ReleaseBundleBuilder.#outputOf(outputs, entry.file);
      const bundle = ReleaseBundleBuilder.#relative(releaseDir, output);
      const chunks = ReleaseBundleBuilder.#startChunks(outputs, output).map((file) => ReleaseBundleBuilder.#relative(releaseDir, file));
      const { styles, modules } = pagePreloads(page);
      const stylesheet = ReleaseBundleBuilder.#bundleStyles(releaseDir, name, styles);
      const esmGraph = ReleaseBundleBuilder.#writeHashed(releaseDir, `${name}.esm`, "json", JSON.stringify(modules));
      const boot = ReleaseBundleBuilder.#writeBoot(releaseDir, page, bundle, entry, esmGraph, meterFile);
      const startModules = [boot, ...(meterFile ? [meterFile] : []), bundle, ...chunks];
      const html = ReleaseBundleBuilder.#withStylesheet(fs.readFileSync(path.join(releaseDir, page), "utf8"), stylesheet, page)
        .replace(entry.tag, entry.tag.replace(entry.src, boot));
      const manifest = ReleaseBundleBuilder.#startupManifest(releaseDir, page, html, [stylesheet, ...startModules, ...layerOne]);
      const startup = ReleaseBundleBuilder.#writeHashed(releaseDir, `${name}.startup`, "json",
        `${JSON.stringify(manifest, null, 2)}\n`);
      fs.writeFileSync(path.join(releaseDir, page), ReleaseBundleBuilder.#withStartupBytes(html, manifest.totalBytes, page));
      pagesBuilt[page] = Object.freeze({ boot, meter: meterFile, bundle, chunks: Object.freeze(chunks), stylesheet, esmGraph,
        startup, startupBytes: manifest.totalBytes });
    }
    const files = ReleaseBundleBuilder.#listFiles(path.join(releaseDir, BUILD_DIR)).map((file) =>
      `${BUILD_DIR}/${file}`);
    return Object.freeze({ pages: Object.freeze(pagesBuilt), files: Object.freeze(files.sort()) });
  }

  // One entry's bundle with its own chunks; returns esbuild's outputs.
  static #bundle(releaseDir, entryFile) {
    return ReleaseBundleBuilder.#runEsbuild(releaseDir, { entryPoints: [entryFile], bundle: true, splitting: true, format: "esm",
      chunkNames: "chunks/[name]-[hash]" }).metafile.outputs;
  }

  static #outputOf(outputs, entryFile) {
    const output = Object.keys(outputs).find((file) => outputs[file].entryPoint === entryFile);
    if (!output) throw new Error(`esbuild wrote no bundle for ${entryFile}`);
    return output;
  }

  // The page's stylesheets, in page order, as one minified file. Returns its release path.
  static #bundleStyles(releaseDir, name, styles) {
    const entry = path.join(releaseDir, BUILD_DIR, `${name}.styles.css`);
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    fs.writeFileSync(entry, styles.map((href) => `@import ${JSON.stringify(`../${href.split(/[?#]/u)[0]}`)};\n`).join(""));
    try {
      const { outputs } = ReleaseBundleBuilder.#runEsbuild(releaseDir, { entryPoints: [`${BUILD_DIR}/${name}.styles.css`],
        bundle: true }).metafile;
      const output = Object.keys(outputs).find((file) => file.endsWith(".css"));
      if (!output) throw new Error(`esbuild wrote no stylesheet for ${name}`);
      return ReleaseBundleBuilder.#relative(releaseDir, output);
    } finally {
      fs.rmSync(entry);
    }
  }

  static #runEsbuild(releaseDir, options) {
    const result = require("esbuild").buildSync({
      absWorkingDir: releaseDir,
      outdir: BUILD_DIR,
      target: "es2022",
      minify: true,
      sourcemap: "linked",
      entryNames: "[name]-[hash]",
      metafile: true,
      logLevel: "error",
      write: true,
      ...options,
    });
    // A warning is a defect in the source (a duplicate object key keeps only its last value): the release refuses it.
    if (result.warnings.length > 0) {
      const lines = result.warnings.map((warning) =>
        `${warning.location?.file ?? "?"}:${warning.location?.line ?? "?"} ${warning.text}`);
      throw new Error(["esbuild warnings:", ...lines].join("\n"));
    }
    return result;
  }

  // The page with the one stylesheet where its first stylesheet link stood; the other links are gone.
  static #withStylesheet(html, stylesheet, page) {
    const links = /^[ \t]*<link\b[^>]*\brel="stylesheet"[^>]*>\r?\n/gmu;
    let first = true;
    const result = html.replace(links, (line) => {
      if (!first) return "";
      first = false;
      return line.replace(/\bhref="[^"]*"/u, `href="${stylesheet}"`);
    });
    if (first) throw new Error(`${page} has no stylesheet`);
    return result;
  }

  // The page's one module script: its tag, its src as written (with any query) and the file it names.
  static #entryOf(html, page) {
    const tags = html.replace(/<!--[^]*?-->/gu, "").match(/<script\b[^>]*\btype="module"[^>]*>/gu) ?? [];
    if (tags.length !== 1) throw new Error(`${page} must load exactly one module entry`);
    const src = tags[0].match(/\bsrc="([^"]+)"/u)?.[1];
    if (!src) throw new Error(`${page} module entry has no src`);
    return { tag: tags[0], src, file: src.split(/[?#]/u)[0] };
  }

  // The chunks the start loads: the bundle's static imports first (they load with it), then each start import()
  // (START_IMPORTS) with its own static imports, nearest first, so a root page preloads them instead of waiting for each
  // import() in turn. A chunk reached only through another import() is loaded when the game asks for it.
  static #startChunks(outputs, start) {
    const seen = new Set([start]);
    const order = [];
    const visit = (from, kind) => {
      for (const record of outputs[from].imports ?? []) {
        if (record.kind !== kind || record.external || seen.has(record.path)) continue;
        if (kind === "dynamic-import" && !START_IMPORTS.includes(outputs[record.path]?.entryPoint)) continue;
        seen.add(record.path);
        order.push(record.path);
      }
    };
    for (let index = -1; index < order.length; index += 1) visit(index < 0 ? start : order[index], "import-statement");
    for (let index = -1; index < order.length; index += 1) {
      const before = order.length;
      visit(index < 0 ? start : order[index], "dynamic-import");
      for (let next = before; next < order.length; next += 1) visit(order[next], "import-statement");
    }
    return order;
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
module.exports = { ReleaseBundleBuilder, BUILD_DIR, START_IMPORTS };

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

