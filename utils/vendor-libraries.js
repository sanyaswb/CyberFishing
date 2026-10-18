"use strict";

// Writes the pinned third-party modules under vendor/ and vendor/manifest.json from the exact npm devDependencies
// (spec 099 D2, spec 103 D2). One script owns the whole manifest, so no library can drop another's entry.
//   node utils/vendor-libraries.js          write every vendor file and vendor/manifest.json
//   node utils/vendor-libraries.js --check  fail when vendor/ differs from what the installed packages produce
// - spine-webgl: a byte copy of the package's prebuilt ESM bundle (the rod until spec 103 stage 4 replaces it).
// - pixi.js + spine-pixi-v8: one self-contained esbuild bundle of SCENE_ENTRY (esm, minified, es2022, no splitting),
//   plus one licence file for every package whose code is in it.
// The architecture check verifies the manifest hashes, that a vendor module imports nothing and its single importer,
// all without node_modules.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const ROOT_DIR = path.resolve(__dirname, "..");
const MANIFEST_FILE = "vendor/manifest.json";
const MODULE_TYPE_FILE = "vendor/package.json";
const EXACT_VERSION = /^\d+\.\d+\.\d+$/u;
const NODE_MODULES = "node_modules/";
const LICENCE_FILE = /^(?:licen[cs]e|copying)(?:\.(?:md|txt))?$/iu;

const SPINE_WEBGL = Object.freeze({
  name: "@esotericsoftware/spine-webgl",
  core: "@esotericsoftware/spine-core",
  source: "dist/esm/spine-webgl.min.mjs",
  importer: "src/platform/browser/animation/spine_runtime_module.js",
});

// The scene layer's library surface (spec 103): only what the scene uses, extended per stage.
// Ticker: the runtime module keeps Pixi's own tickers stopped, so GameLoop stays the only frame driver.
const SCENE_EXPORTS = Object.freeze({
  "pixi.js": ["Application", "ColorMatrixFilter", "Container", "DisplacementFilter", "Graphics", "RenderTexture",
    "Sprite", "Texture", "Ticker"],
  "@esotericsoftware/spine-pixi-v8": ["AtlasAttachmentLoader", "Physics", "SkeletonJson", "Spine", "SpineTexture",
    "TextureAtlas"],
});
// The layer passes skipExtensionImports, so Pixi's browser extensions (events, accessibility, DOM) never register;
// the filter system is the one of them the scene needs, so the entry registers it.
const SCENE_SIDE_EFFECTS = Object.freeze(["pixi.js/filters"]);
const SCENE_ENTRY = [
  ...SCENE_SIDE_EFFECTS.map((specifier) => `import ${JSON.stringify(specifier)};`),
  ...Object.entries(SCENE_EXPORTS).map(([specifier, names]) =>
    `export { ${names.join(", ")} } from ${JSON.stringify(specifier)};`),
  "",
].join("\n");
const PIXI_SCENE = Object.freeze({
  name: "pixi.js",
  pinned: ["pixi.js", "@esotericsoftware/spine-pixi-v8", "pixi-filters", "esbuild"],
  bundler: "esbuild",
  directory: (version) => `vendor/pixi/${version}`,
  fileName: "pixi-scene.js",
  importer: "src/platform/browser/scene/pixi_runtime_module.js",
  buildOptions: { format: "esm", minify: true, splitting: false, target: "es2022", platform: "browser",
    charset: "ascii", legalComments: "none" },
});

// Packages whose npm tarball ships no licence file: where their licence text comes from instead.
// spine-pixi-v8 lists LICENSE in `files` but does not publish it; its source headers carry the Spine Runtimes
// License that spine-core ships. @pixi/colord is MIT; the notice is the upstream LICENSE.md (github.com/omgovich/colord).
const LICENCE_FALLBACKS = Object.freeze({
  "@esotericsoftware/spine-pixi-v8": { fromPackage: "@esotericsoftware/spine-core" },
  "@pixi/colord": { mit: "Copyright (c) 2020 Vlad Shilov omgovich@ya.ru" },
});
const MIT_TERMS = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

class InstalledPackages {
  #rootDir;
  #rootPackage;
  #lock;

  constructor(rootDir) {
    this.#rootDir = rootDir;
    this.#rootPackage = readJson(path.join(rootDir, "package.json"));
    this.#lock = readJson(path.join(rootDir, "package-lock.json")).packages ?? {};
  }

  // The exact devDependency pin, the installed copy and its lockfile integrity must agree.
  pinned(name) {
    const version = this.#rootPackage.devDependencies?.[name];
    if (!EXACT_VERSION.test(version ?? "")) {
      throw new Error(`package.json must pin ${name} to an exact version, found ${JSON.stringify(version)}`);
    }
    const installed = this.installed(`node_modules/${name}`);
    if (installed.version !== version) {
      throw new Error(`installed ${name} is ${installed.version}, package.json pins ${version}; run npm install`);
    }
    return installed;
  }

  // nodeModulesPath: "node_modules/<name>" as the lockfile keys it (nested copies keep their full path).
  installed(nodeModulesPath) {
    const manifest = readJson(path.join(this.#rootDir, ...nodeModulesPath.split("/"), "package.json"));
    const lockEntry = this.#lock[nodeModulesPath];
    if (lockEntry?.version !== manifest.version || !lockEntry.integrity) {
      throw new Error(`package-lock.json has no integrity for ${nodeModulesPath}@${manifest.version}`);
    }
    return { name: manifest.name, version: manifest.version, integrity: lockEntry.integrity, manifest,
      directory: path.join(this.#rootDir, ...nodeModulesPath.split("/")) };
  }
}

class SpineWebglVendorEntry {
  static resolve(packages) {
    const spine = packages.pinned(SPINE_WEBGL.name);
    const core = packages.installed(`node_modules/${SPINE_WEBGL.core}`);
    if (core.version !== spine.manifest.dependencies?.[SPINE_WEBGL.core]) {
      throw new Error(`package-lock.json ${SPINE_WEBGL.core} does not match ${SPINE_WEBGL.name}'s dependency`);
    }
    const bundle = fs.readFileSync(path.join(spine.directory, ...SPINE_WEBGL.source.split("/")));
    const license = fs.readFileSync(path.join(spine.directory, "LICENSE"));
    const directory = `vendor/spine-webgl/${spine.version}`;
    const entry = {
      name: SPINE_WEBGL.name,
      version: spine.version,
      integrity: spine.integrity,
      bundles: [`${SPINE_WEBGL.core}@${core.version}`],
      source: SPINE_WEBGL.source,
      file: `${directory}/spine-webgl.js`,
      sha256: sha256(bundle),
      license: `${directory}/LICENSE`,
      licenseSha256: sha256(license),
      importer: SPINE_WEBGL.importer,
    };
    return { entry, files: new Map([[entry.file, bundle], [entry.license, license]]) };
  }
}

class PixiSceneVendorEntry {
  static async resolve(packages) {
    const pinned = new Map(PIXI_SCENE.pinned.map((name) => [name, packages.pinned(name)]));
    const pixi = pinned.get(PIXI_SCENE.name);
    const esbuild = require("esbuild");
    if (esbuild.version !== pinned.get(PIXI_SCENE.bundler).version) {
      throw new Error(`loaded esbuild ${esbuild.version} is not the pinned one`);
    }
    const result = await esbuild.build({
      ...PIXI_SCENE.buildOptions,
      stdin: { contents: SCENE_ENTRY, resolveDir: ROOT_DIR, sourcefile: "pixi-scene-entry.js", loader: "js" },
      absWorkingDir: ROOT_DIR,
      bundle: true,
      write: false,
      metafile: true,
      logLevel: "silent",
    });
    if (result.warnings.length > 0) throw new Error(`esbuild warnings: ${result.warnings.map((item) => item.text).join("; ")}`);
    const bundle = Buffer.from(result.outputFiles[0].contents);
    PixiSceneVendorEntry.#verifyBundle(bundle.toString("utf8"));
    const bundled = PixiSceneVendorEntry.#bundledPackages(packages, result.metafile);
    if (!bundled.some((item) => item.name === pixi.name && item.version === pixi.version)) {
      throw new Error(`the scene bundle does not contain the pinned ${pixi.name}`);
    }
    const directory = PIXI_SCENE.directory(pixi.version);
    const file = `${directory}/${PIXI_SCENE.fileName}`;
    const license = Buffer.from(PixiSceneVendorEntry.#licenceText(packages, bundled, file), "utf8");
    const entry = {
      name: pixi.name,
      version: pixi.version,
      integrity: pixi.integrity,
      bundles: bundled.filter((item) => item.name !== pixi.name).map((item) => `${item.name}@${item.version}`),
      source: `${PIXI_SCENE.bundler}@${esbuild.version} bundle of the scene entry in utils/vendor-libraries.js`,
      exports: Object.values(SCENE_EXPORTS).flat().sort(),
      file,
      sha256: sha256(bundle),
      license: `${directory}/LICENSE`,
      licenseSha256: sha256(license),
      importer: PIXI_SCENE.importer,
    };
    const size = { minified: bundle.length, gzip: zlib.gzipSync(bundle).length };
    return { entry, size, files: new Map([[entry.file, bundle], [entry.license, license]]) };
  }

  // The guard requires a self-contained module: no static import, re-export from another module or import().
  static #verifyBundle(source) {
    if (/[^\x00-\x7f]/u.test(source)) throw new Error("the scene bundle must be ASCII (charset: ascii)");
    const ast = require("acorn").parse(source, { ecmaVersion: "latest", sourceType: "module" });
    const exported = [];
    const visit = (node) => {
      if (!node || typeof node.type !== "string") return;
      if (node.type === "ImportDeclaration" || node.type === "ImportExpression" || node.source) {
        throw new Error(`the scene bundle still has a module import (${node.type})`);
      }
      if (node.type === "ExportNamedDeclaration") exported.push(...node.specifiers.map((item) => item.exported.name));
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value.type === "string") visit(value);
      }
    };
    visit(ast);
    const expected = Object.values(SCENE_EXPORTS).flat().sort();
    if (JSON.stringify(exported.sort()) !== JSON.stringify(expected)) {
      throw new Error(`the scene bundle exports ${exported.join(", ")}, expected ${expected.join(", ")}`);
    }
  }

  // Every package that contributes bytes to the output, from the esbuild metafile, sorted by name.
  static #bundledPackages(packages, metafile) {
    const output = Object.values(metafile.outputs)[0];
    const found = new Map();
    for (const [input, { bytesInOutput }] of Object.entries(output.inputs)) {
      const at = input.lastIndexOf(NODE_MODULES);
      if (bytesInOutput === 0 || at < 0) continue;
      // The innermost node_modules owns the file; a scoped name has two segments.
      const segments = input.slice(at + NODE_MODULES.length).split("/");
      const name = segments[0].startsWith("@") ? `${segments[0]}/${segments[1]}` : segments[0];
      const nodeModulesPath = `${input.slice(0, at)}${NODE_MODULES}${name}`;
      if (!found.has(nodeModulesPath)) found.set(nodeModulesPath, packages.installed(nodeModulesPath));
    }
    return [...found.values()].sort((left, right) => left.name.localeCompare(right.name, "en"));
  }

  // One section per distinct licence text, naming every bundled package it covers.
  static #licenceText(packages, bundled, file) {
    const sections = new Map();
    for (const item of bundled) {
      const text = PixiSceneVendorEntry.#packageLicence(packages, item);
      const covered = sections.get(text) ?? [];
      covered.push(`${item.name}@${item.version} (${item.manifest.license})`);
      sections.set(text, covered);
    }
    const rule = "=".repeat(80);
    const header = [`Third-party licences for ${file}, generated by utils/vendor-libraries.js.`,
      "The bundle contains code from these packages:", ...bundled.map((item) => `  ${item.name}@${item.version}`)];
    const body = [...sections].map(([text, covered]) => [rule, ...covered, rule, "", text].join("\n"));
    return `${[header.join("\n"), ...body].join("\n\n")}\n`;
  }

  static #packageLicence(packages, item) {
    const fallback = LICENCE_FALLBACKS[item.name];
    if (fallback?.fromPackage) {
      return PixiSceneVendorEntry.#licenceFile(packages.installed(`node_modules/${fallback.fromPackage}`));
    }
    if (fallback?.mit) {
      if (item.manifest.license !== "MIT") throw new Error(`${item.name} is no longer MIT; review its licence`);
      return `MIT License\n\n${fallback.mit}\n\n${MIT_TERMS}`;
    }
    return PixiSceneVendorEntry.#licenceFile(item);
  }

  static #licenceFile(item) {
    const name = fs.readdirSync(item.directory).filter((entry) => LICENCE_FILE.test(entry)).sort()[0];
    if (!name) throw new Error(`${item.name}@${item.version} ships no licence file; add it to LICENCE_FALLBACKS`);
    return fs.readFileSync(path.join(item.directory, name), "utf8").replace(/\r\n?/gu, "\n").trim();
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

async function resolvePlan(rootDir) {
  const packages = new InstalledPackages(rootDir);
  const spine = SpineWebglVendorEntry.resolve(packages);
  const scene = await PixiSceneVendorEntry.resolve(packages);
  const manifest = { schemaVersion: 1, packages: [spine.entry, scene.entry] };
  const files = new Map([
    ...spine.files,
    ...scene.files,
    [MANIFEST_FILE, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8")],
    [MODULE_TYPE_FILE, Buffer.from(`${JSON.stringify({ type: "module" }, null, 2)}\n`, "utf8")],
  ]);
  return { files, sceneSize: scene.size, sceneFile: scene.entry.file };
}

function differences(rootDir, files) {
  const found = [];
  for (const [file, bytes] of files) {
    const target = path.join(rootDir, ...file.split("/"));
    if (!fs.existsSync(target)) found.push(`${file} is missing`);
    else if (!fs.readFileSync(target).equals(bytes)) found.push(`${file} differs`);
  }
  return found;
}

async function main(args) {
  const { files, sceneSize, sceneFile } = await resolvePlan(ROOT_DIR);
  const size = `${sceneFile}: ${sceneSize.minified} bytes minified, ${sceneSize.gzip} bytes gzip`;
  if (args.includes("--check")) {
    const found = differences(ROOT_DIR, files);
    if (found.length > 0) {
      throw new Error(`vendor/ is out of date: ${found.join("; ")}; run node utils/vendor-libraries.js`);
    }
    console.log(`vendor/ matches the installed packages (${files.size} files). ${size}.`);
    return;
  }
  for (const [file, bytes] of files) {
    const target = path.join(ROOT_DIR, ...file.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  console.log(`Wrote ${[...files.keys()].join(", ")}. ${size}.`);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
