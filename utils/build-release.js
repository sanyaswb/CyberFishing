"use strict";

// Release bundle (spec 157 R13, owner 2026-10-31): the one release form for GitHub Pages and the game server.
//   npm run build:release -- --out <dir> [--ref <commit>]
// writes a self-contained release folder from a commit: the committed release files (pages, stylesheets, source modules,
// assets, vendor files and licences: the ?esm=1 fallback still runs from them) and build/ with
//   - one esbuild bundle per page entry, split into shared and lazy chunks (minified, with source maps), names hashed;
//   - a small boot module per page (build/<page>.boot-<hash>.js): the bundle by default, the source modules when the
//     page address has ?esm=1 (it then adds a modulepreload for every module of the page's graph first).
// Each page's module script points at its boot module; every URL stays relative, so the folder works under any path
// prefix (Pages: /CyberFishing/releases/<id>/; the server: / or another prefix). The repository and local work stay
// without a build: only a release is built. Server requirements: docs/deployment.md.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const BUILD_DIR = "build";
const PAGES = Object.freeze(["index.html", "dev.html"]);

class ReleaseBundleBuilder {
  // releaseDir holds the committed release files already; pagePreloads(page) -> { styles, modules } (ReleaseFileSet).
  static build({ releaseDir, pages = PAGES, pagePreloads }) {
    const esbuild = require("esbuild");
    const present = pages.filter((page) => fs.existsSync(path.join(releaseDir, page)));
    const entries = new Map(present.map((page) => [page, ReleaseBundleBuilder.#entryOf(fs.readFileSync(
      path.join(releaseDir, page), "utf8"), page)]));
    const result = esbuild.buildSync({
      absWorkingDir: releaseDir,
      entryPoints: [...new Set([...entries.values()].map((entry) => entry.file))],
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
    const pagesBuilt = {};
    for (const [page, entry] of entries) {
      const output = Object.keys(outputs).find((file) => outputs[file].entryPoint === entry.file);
      if (!output) throw new Error(`esbuild wrote no bundle for ${entry.file}`);
      const bundle = ReleaseBundleBuilder.#relative(releaseDir, output);
      const chunks = ReleaseBundleBuilder.#closure(outputs, output).map((file) => ReleaseBundleBuilder.#relative(releaseDir, file));
      const boot = ReleaseBundleBuilder.#writeBoot(releaseDir, page, bundle, entry, pagePreloads(page).modules);
      const html = fs.readFileSync(path.join(releaseDir, page), "utf8");
      fs.writeFileSync(path.join(releaseDir, page), html.replace(entry.tag, entry.tag.replace(entry.src, boot)));
      pagesBuilt[page] = Object.freeze({ boot, bundle, chunks: Object.freeze(chunks) });
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

  // build/<page>.boot-<hash>.js: the page's bundle, or with ?esm=1 its source modules after a modulepreload for each.
  static #writeBoot(releaseDir, page, bundle, entry, modules) {
    const name = page.replace(/\.html$/u, "");
    const bundleSpecifier = `./${path.posix.relative(BUILD_DIR, bundle)}`;
    const source = `// Release boot (spec 157 R13), generated by utils/build-release.js: the bundle; ?esm=1 runs the source modules.
const esm = new URLSearchParams(location.search).has("esm");
if (esm) {
  for (const href of ${JSON.stringify(modules)}) {
    const link = document.createElement("link");
    link.rel = "modulepreload";
    link.href = href;
    document.head.append(link);
  }
}
await import(esm ? ${JSON.stringify(`../${entry.src}`)} : ${JSON.stringify(bundleSpecifier)});
`;
    const hash = crypto.createHash("sha256").update(source).digest("hex").slice(0, 8).toUpperCase();
    const file = `${BUILD_DIR}/${name}.boot-${hash}.js`;
    fs.writeFileSync(path.join(releaseDir, file), source);
    return file;
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

module.exports = { ReleaseBundleBuilder, BUILD_DIR };
