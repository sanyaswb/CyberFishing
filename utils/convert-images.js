"use strict";
// utils/convert-images.js v2.0.0 (TK-223): every raster conversion of the project goes through this tool (AGENTS.md).
// Run it without arguments for a short guided menu; the menu prints the command it runs, so it can be repeated.
//
//   batch         PNG/JPG -> WebP (and/or AVIF) beside each source (or into --output).
//                 [--input assets] [--output assets] [--pattern "**/*.{png,jpg}"]
//                 [--quality low|middle|high] [--format webp|avif|both|same|jpg|png] [--max-size N]
//                 [--crop <W>x<H>[+<X>+<Y>]] [--trim [--trim-threshold 10]] [--masters] [--dry-run]
//                 --masters moves each converted source to asset-sources/<its path under assets/> (the master rule).
//   thumbnails    Masters -> display art in another folder (TK-180: fish).
//                 [--input asset-sources/fish] [--output assets/fish-display] [--size 768] [--quality middle]
//                 [--top-fraction 1] [--crop <W>x<H>[+<X>+<Y>]] [--trim [--trim-threshold 10]] [--dry-run]
//   low-copies    --manifest <json: [{ input, output, scale?, quality? }]>  (npm run assets:sync makes the name--low.webp
//                 copies with it; a Spine atlas page gets scale 0.5, quality low and alphaQuality 50, spec 166)
//   spine-region  --atlas <file.atlas> --output <picture.webp> [--size 1024] [--quality middle]
//   glow-icon     --base <icon> --glow <glow art> --glow-pad <px> --output <icon.webp> [--quality middle]
//                 (TK-315) bakes a glow into an icon: the glow art is the base art padded by --glow-pad of its own
//                 pixels on the sides and the top (the scene's tip-glow format); it is scaled to the icon, added on top
//                 and the canvas grows by the scaled pad so the halo is kept, then fits the base's longest side.
//
// --trim cuts empty (transparent or uniform) edges before resizing: art carries no margins, the place that shows it sets
// them (TK-222). The flag form of a command (--batch, --thumbnails, --low-copies, --spine-region) works the same.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const readline = require("node:readline");
const glob = require("glob");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const QUALITY = Object.freeze({
  low: Object.freeze({ name: "Low", webp: 50, avif: 40 }),
  middle: Object.freeze({ name: "Middle", webp: 80, avif: 65 }),
  high: Object.freeze({ name: "High", webp: 95, avif: 85 }),
});
const FORMATS = Object.freeze({
  webp: ["webp"],
  avif: ["avif"],
  both: ["webp", "avif"],
  same: ["same"],
  jpg: ["jpg"],
  jpeg: ["jpeg"],
  png: ["png"],
});
const LOW_COPY_MAX_SIDE = 256;
// sharp already spreads one image over libvips threads; a few files at once keeps the cores busy on small images.
const PARALLEL_FILES = Math.max(1, Math.min(4, (os.availableParallelism?.() ?? os.cpus().length) - 1));

// --- Arguments ---------------------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const options = new Map();
  const flags = new Set();
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) flags.add(token);
    else { options.set(token, next); index++; }
  }
  return {
    has: (name) => flags.has(name) || options.has(name),
    get: (name, fallback) => options.get(name) ?? fallback,
  };
}

function qualityOf(args) {
  const key = args.get("--quality", "middle");
  const quality = QUALITY[key === "medium" ? "middle" : key];
  if (!quality) throw new Error(`--quality must be low, middle or high (got ${key})`);
  return quality;
}

function sizeOf(args, name, fallback) {
  const raw = args.get(name, fallback);
  if (raw === null) return null;
  const size = Number(raw);
  if (!Number.isSafeInteger(size) || size < 1 || size > 8192) throw new Error(`${name} must be 1..8192 px (got ${raw})`);
  return size;
}

function trimOf(args) {
  if (!args.has("--trim")) return null;
  const threshold = Number(args.get("--trim-threshold", "10"));
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 255) throw new Error("--trim-threshold must be 0..255");
  return { threshold };
}

function cropOf(args) {
  if (!args.has("--crop")) return null;
  const raw = args.get("--crop");
  const match = /^(\d+)x(\d+)(?:\+(\d+)\+(\d+))?$/.exec(raw);
  if (!match) throw new Error(`--crop must be <width>x<height> or <width>x<height>+<left>+<top> (got ${raw})`);
  const width = Number(match[1]);
  const height = Number(match[2]);
  const left = match[3] !== undefined ? Number(match[3]) : 0;
  const top = match[4] !== undefined ? Number(match[4]) : 0;
  if (width < 1 || height < 1) throw new Error("--crop dimensions must be positive");
  return { left, top, width, height };
}

// A project path: inside the repository, resolved from its root.
function projectPath(relative, name) {
  if (!relative) throw new Error(`${name} is required`);
  const absolute = path.resolve(ROOT, relative);
  if (path.relative(ROOT, absolute).startsWith("..")) throw new Error(`${name} must be inside the project: ${relative}`);
  return absolute;
}

const rel = (file) => path.relative(ROOT, file).replace(/\\/g, "/");
const kb = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(2)} MB` : `${Math.round(bytes / 1024)} KB`);

// --- Shared pipeline ---------------------------------------------------------------------------------------------------

// One source image -> a sharp pipeline: optional crop, top crop, trim, resize inside a square (never enlarged).
async function pipelineOf(source, { topFraction = 1, trim = null, maxSize = null, crop = null }) {
  let image = sharp(typeof source === "string" ? fs.readFileSync(source) : source);
  if (crop) {
    image = image.extract(crop);
    if (trim) image = sharp(await image.png().toBuffer());
  }
  if (topFraction < 1) {
    const { width, height } = await image.metadata();
    image.extract({ left: 0, top: 0, width, height: Math.max(1, Math.floor(height * topFraction)) });
    // sharp trims before it extracts: the kept part goes through a lossless buffer first.
    if (trim) image = sharp(await image.png().toBuffer());
  }
  if (trim) image.trim(trim);
  if (maxSize) image.resize(maxSize, maxSize, { fit: "inside", withoutEnlargement: true });
  return image;
}

async function encode(image, format, quality, target, { alphaQuality = 100 } = {}) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const ext = (format === "same" ? path.extname(target).slice(1) : format).toLowerCase();
  let encoder;
  if (ext === "avif") {
    encoder = image.clone().avif({ quality: quality.avif, effort: 5 });
  } else if (ext === "webp") {
    encoder = image.clone().webp({ quality: quality.webp, alphaQuality });
  } else if (ext === "jpg" || ext === "jpeg") {
    encoder = image.clone().jpeg({ quality: 95 });
  } else if (ext === "png") {
    encoder = image.clone().png({ compressionLevel: 9 });
  } else {
    encoder = image.clone().webp({ quality: quality.webp, alphaQuality });
  }
  const buffer = await encoder.toBuffer();
  fs.writeFileSync(target, buffer);
  const metadata = await sharp(buffer).metadata();
  return { size: buffer.length, width: metadata.width, height: metadata.height };
}

// Runs the jobs a few at a time; every failure is reported and fails the run at the end.
async function runJobs(jobs, work) {
  const failures = [];
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      try { await work(job); } catch (error) { failures.push(`${job.label}: ${error.message}`); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL_FILES, jobs.length) }, worker));
  for (const failure of failures) console.error(`FAILED ${failure}`);
  if (failures.length > 0) process.exitCode = 1;
  return failures.length;
}

// Two sources that would write one file (x.png and x.jpg) stop the run before anything is written.
function assertUniqueTargets(jobs) {
  const seen = new Map();
  for (const job of jobs) {
    for (const target of job.targets) {
      if (seen.has(target)) throw new Error(`${rel(seen.get(target))} and ${rel(job.source)} would both write ${rel(target)}`);
      seen.set(target, job.source);
    }
  }
}

// --- Commands ----------------------------------------------------------------------------------------------------------

async function batch(args) {
  const input = projectPath(args.get("--input", "assets"), "--input");
  const output = args.has("--output") ? projectPath(args.get("--output"), "--output") : null;
  const pattern = args.get("--pattern", "**/*.{png,jpg,jpeg,PNG,JPG,JPEG}");
  const quality = qualityOf(args);
  const formatKey = args.get("--format", "webp");
  const formats = FORMATS[formatKey];
  if (!formats) throw new Error("--format must be webp, avif, both, same, jpg, or png");
  const settings = { trim: trimOf(args), maxSize: sizeOf(args, "--max-size", null), crop: cropOf(args) };
  const masters = args.has("--masters");
  const dryRun = args.has("--dry-run");
  const assetsRoot = path.join(ROOT, "assets");
  const files = glob.sync(pattern, { cwd: input, nodir: true, absolute: true,
    ignore: ["**/node_modules/**"] }).sort();
  if (files.length === 0) {
    console.log(`No matching files in ${rel(input) || "."}.`);
    process.exitCode = 1;
    return;
  }
  const jobs = files.map((source) => {
    const relative = path.relative(input, source);
    const stem = relative.replace(/\.[^.]+$/, "");
    const ext = path.extname(source).slice(1);
    const targetDir = output ? path.join(output, path.dirname(relative)) : path.dirname(source);
    const targetStem = path.join(targetDir, path.basename(stem));
    const master = masters ? path.join(ROOT, "asset-sources", path.relative(assetsRoot, source)) : null;
    if (master && path.relative(assetsRoot, source).startsWith("..")) throw new Error(`--masters needs sources under assets/: ${rel(source)}`);
    if (master && fs.existsSync(master)) throw new Error(`${rel(master)} already exists: move or remove it first`);
    const targetFormats = formats.map((format) => (format === "same" ? ext : format));
    return { source, master, label: rel(source), targets: targetFormats.map((format) => `${targetStem}.${format}`) };
  });
  assertUniqueTargets(jobs);
  console.log(`batch: ${files.length} files in ${rel(input) || "."}${output ? ` -> ${rel(output)}` : ""}, ${quality.name} (WebP ${quality.webp}, AVIF ${quality.avif})` +
    `${settings.crop ? `, crop ${settings.crop.width}x${settings.crop.height}+${settings.crop.left}+${settings.crop.top}` : ""}` +
    `${settings.maxSize ? `, max ${settings.maxSize} px` : ""}${settings.trim ? ", trimmed" : ""}${masters ? ", masters -> asset-sources" : ""}` +
    `${dryRun ? " [dry run]" : ""}`);
  let before = 0, after = 0;
  const failed = await runJobs(jobs, async (job) => {
    if (dryRun) { console.log(`  ${job.label} -> ${job.targets.map(rel).join(", ")}${job.master ? `, master ${rel(job.master)}` : ""}`); return; }
    const size = fs.statSync(job.source).size;
    const image = await pipelineOf(job.source, settings);
    const results = [];
    for (const [index, format] of formats.entries()) results.push(await encode(image, format, quality, job.targets[index]));
    before += size;
    after += results.reduce((sum, result) => sum + result.size, 0);
    if (job.master) {
      fs.mkdirSync(path.dirname(job.master), { recursive: true });
      fs.renameSync(job.source, job.master);
    }
    console.log(`  ${job.label} ${kb(size)} -> ${job.targets.map((target, index) =>
      `${path.basename(target)} ${kb(results[index].size)} ${results[index].width}x${results[index].height}`).join(", ")}`);
  });
  if (!dryRun) console.log(`Converted ${files.length - failed} of ${files.length}: ${kb(before)} -> ${kb(after)}.` +
    `${masters ? "" : " Sources stay in place: move each master to asset-sources/ (or rerun with --masters)."}`);
}

async function thumbnails(args) {
  const input = projectPath(args.get("--input", "asset-sources/fish"), "--input");
  const output = projectPath(args.get("--output", "assets/fish-display"), "--output");
  const size = sizeOf(args, "--size", "768");
  const topFraction = Number(args.get("--top-fraction", "1"));
  const quality = qualityOf(args);
  if (input === output) throw new Error("--input and --output must differ");
  if (!Number.isFinite(topFraction) || topFraction <= 0 || topFraction > 1) throw new Error("--top-fraction must be in (0, 1]");
  const settings = { topFraction, trim: trimOf(args), maxSize: size, crop: cropOf(args) };
  const files = glob.sync("**/*.{png,jpg,jpeg,webp,avif}", { cwd: input, nodir: true }).sort();
  const jobs = files.map((relative) => ({ source: path.join(input, relative), label: relative,
    targets: [path.join(output, relative.replace(/\.[^.]+$/, ".webp"))] }));
  assertUniqueTargets(jobs);
  if (args.has("--dry-run")) {
    for (const job of jobs) console.log(`  ${job.label} -> ${rel(job.targets[0])}`);
    return;
  }
  const failed = await runJobs(jobs, async (job) => encode(await pipelineOf(job.source, settings), "webp", quality, job.targets[0]));
  console.log(`Created ${files.length - failed} thumbnails at max ${size}px${settings.trim ? ", trimmed" : ""}, ${quality.name} ` +
    `(WebP ${quality.webp}) in ${rel(output)}`);
}

// The longest side becomes a quarter of the original's, at most 256 px (never enlarged), the same proportion, WebP Low.
async function lowCopies(args) {
  const manifest = JSON.parse(fs.readFileSync(projectPath(args.get("--manifest"), "--manifest"), "utf8"));
  // A job may carry scale (a Spine atlas page, spec 166: each side x scale, rounded up, so the page keeps its proportions
  // and its regions' UVs), quality (low | middle | high) and alphaQuality (0..100, lossless 100); without them, the image
  // rule above.
  const jobs = manifest.map(({ input, output, scale = null, quality = "low", alphaQuality = 100 }) => ({
    source: projectPath(input, "input"), label: input, targets: [projectPath(output, "output")], scale,
    quality: QUALITY[quality], alphaQuality }));
  for (const job of jobs) {
    if (job.source === job.targets[0] || !job.quality || (job.scale !== null && !(job.scale > 0 && job.scale < 1))) {
      throw new Error(`Invalid low copy ${job.label}`);
    }
  }
  const failed = await runJobs(jobs, async (job) => {
    const { width, height } = await sharp(job.source).metadata();
    if (job.scale !== null) {
      await encode(sharp(job.source).resize(Math.ceil(width * job.scale), Math.ceil(height * job.scale), { fit: "fill" }),
        "webp", job.quality, job.targets[0], { alphaQuality: job.alphaQuality });
      return;
    }
    const side = Math.max(1, Math.min(LOW_COPY_MAX_SIDE, Math.round(Math.max(width, height) / 4)));
    await encode(sharp(job.source).resize(side, side, { fit: "inside", withoutEnlargement: true }), "webp", job.quality, job.targets[0]);
  });
  console.log(`Created ${jobs.length - failed} low copies (images: max ${LOW_COPY_MAX_SIDE} px, WebP ${QUALITY.low.webp}; `
    + `Spine pages: half size, WebP ${QUALITY.low.webp}, alpha 50).`);
}

// A Spine atlas's one region as an upright picture (TK-181: the rod's picture before its export arrives).
async function spineRegion(args) {
  const atlasFile = projectPath(args.get("--atlas"), "--atlas");
  const output = projectPath(args.get("--output"), "--output");
  const size = sizeOf(args, "--size", "1024");
  const quality = qualityOf(args);
  const lines = fs.readFileSync(atlasFile, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const bounds = lines.filter((line) => line.startsWith("bounds:"));
  if (bounds.length !== 1) throw new Error("--spine-region needs an atlas with one region");
  const [x, y, width, height] = bounds[0].slice("bounds:".length).split(",").map(Number);
  const rotated = lines.includes("rotate:90");
  // A region stored rotated has its width and height swapped in the page; turning it clockwise makes it upright.
  const region = await sharp(path.join(path.dirname(atlasFile), lines[0]))
    .extract({ left: x, top: y, width: rotated ? height : width, height: rotated ? width : height })
    .rotate(rotated ? 90 : 0).toBuffer();
  await encode(sharp(region).resize(size, size, { fit: "inside", withoutEnlargement: true }), "webp", quality, output);
  console.log(`Created ${rel(output)} from ${rel(atlasFile)}`);
}

async function glowIcon(args) {
  const base = projectPath(args.get("--base"), "--base");
  const glow = projectPath(args.get("--glow"), "--glow");
  const output = projectPath(args.get("--output"), "--output");
  const pad = Number(args.get("--glow-pad"));
  if (!Number.isFinite(pad) || pad < 0) throw new Error("--glow-pad must be a number of glow-art pixels");
  const quality = qualityOf(args);
  const baseMeta = await sharp(base).metadata();
  const glowMeta = await sharp(glow).metadata();
  const scale = baseMeta.height / (glowMeta.height - pad);
  const margin = Math.round(pad * scale);
  const glowWidth = baseMeta.width + 2 * margin;
  const glowHeight = baseMeta.height + margin;
  const scaledGlow = await sharp(glow).resize(glowWidth, glowHeight, { fit: "fill" }).png().toBuffer();
  const canvas = sharp({ create: { width: glowWidth, height: glowHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fs.readFileSync(base), left: margin, top: margin }, { input: scaledGlow, left: 0, top: 0, blend: "screen" }]);
  // The halo grows the canvas; the icon keeps the base art's longest side (the item-art limit, spec 157 R6).
  const longest = Math.max(baseMeta.width, baseMeta.height);
  const fitted = sharp(await canvas.png().toBuffer()).resize(longest, longest, { fit: "inside", withoutEnlargement: true });
  const result = await encode(fitted, "webp", quality, output);
  console.log(`Created ${rel(output)} (${result.width}x${result.height}, ${kb(result.size)}) from ${rel(base)} + ${rel(glow)}`);
}

// --- Guided menu (no arguments) ----------------------------------------------------------------------------------------

async function menu() {
  // Answers come from one line queue, so typed and piped input behave the same.
  const prompt = readline.createInterface({ input: process.stdin });
  const lines = prompt[Symbol.asyncIterator]();
  const ask = async (question, fallback) => {
    process.stdout.write(`${question} [${fallback}]: `);
    const { value, done } = await lines.next();
    if (done) throw new Error("No answer (input closed)");
    return value.trim() || fallback;
  };
  const choose = async (question, choices, fallback) => {
    for (;;) {
      const answer = (await ask(`${question} (${choices.join("/")})`, fallback)).toLowerCase();
      if (choices.includes(answer)) return answer;
      console.log(`Choose one of: ${choices.join(", ")}`);
    }
  };
  try {
    console.log("convert-images: 1 batch (PNG/JPG -> WebP beside them), 2 thumbnails (masters -> display art), 3 help");
    const command = await choose("Command", ["1", "2", "3"], "1");
    if (command === "3") { printHelp(); return; }
    const argv = [];
    const add = (name, value, fallback) => { if (value !== fallback) argv.push(name, value); };
    if (command === "1") {
      add("--input", await ask("Folder", "assets"), "assets");
      add("--quality", await choose("Quality", ["low", "middle", "high"], "middle"), "middle");
      add("--format", await choose("Format", ["webp", "avif", "both"], "webp"), "webp");
      add("--max-size", await ask("Longest side, px (empty = keep)", "keep"), "keep");
    } else {
      add("--input", await ask("Masters folder", "asset-sources/fish"), "asset-sources/fish");
      add("--output", await ask("Output folder", "assets/fish-display"), "assets/fish-display");
      add("--size", await ask("Longest side, px", "768"), "768");
      add("--quality", await choose("Quality", ["low", "middle", "high"], "middle"), "middle");
    }
    if (await choose("Trim empty edges", ["y", "n"], "y") === "y") argv.push("--trim");
    if (command === "1" && await choose("Move sources to asset-sources/", ["y", "n"], "y") === "y") argv.push("--masters");
    const name = command === "1" ? "batch" : "thumbnails";
    console.log(`\nnode utils/convert-images.js ${[name, ...argv].join(" ")}\n`);
    if (await choose("Run it", ["y", "n"], "y") !== "y") return;
    prompt.close();
    await COMMANDS[name](parseArgs(argv));
  } finally {
    prompt.close();
  }
}

function printHelp() {
  const source = fs.readFileSync(__filename, "utf8").split("\n");
  console.log(source.slice(1, source.findIndex((line) => line.startsWith("const fs"))).map((line) => line.replace(/^\/\/ ?/, ""))
    .join("\n").trim());
}

const COMMANDS = Object.freeze({ batch, thumbnails, "low-copies": lowCopies, "spine-region": spineRegion, "glow-icon": glowIcon });

async function main(argv) {
  if (argv.length === 0) return menu();
  if (argv[0] === "help" || argv.includes("--help")) return printHelp();
  const index = argv.findIndex((token) => COMMANDS[token.replace(/^--/, "")]);
  if (index < 0) throw new Error(`Unknown command. Commands: ${Object.keys(COMMANDS).join(", ")} (or no arguments for the menu)`);
  const name = argv[index].replace(/^--/, "");
  return COMMANDS[name](parseArgs(argv.filter((_, position) => position !== index)));
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
