"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_ROOT = path.resolve(__dirname, "../../..");
const PRODUCTION_STYLES = "src/game/presentation/styles/";
const DEV_STYLES = "src/dev/styles/";

// HTML is the CSS composition root. Tests read the same ordered assets as the browser.
function readPageStylesheets({ projectRoot = DEFAULT_ROOT, page = "index.html", html = null } = {}) {
  if (page !== "index.html" && page !== "dev.html") throw new Error(`Unknown native page: ${page}`);
  const source = html ?? fs.readFileSync(path.join(projectRoot, page), "utf8");
  const stylesheets = [];
  const seen = new Set();
  for (const link of source.replace(/<!--[^]*?-->/g, "").matchAll(/<link\b[^>]*>/gi)) {
    const attributes = new Map([...link[0].matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g)]
      .map((match) => [match[1].toLowerCase(), match[3]]));
    if (!attributes.get("rel")?.toLowerCase().split(/\s+/).includes("stylesheet")) continue;
    const href = attributes.get("href");
    if (!href || /^(?:[a-z]+:|[/\\])/i.test(href)) throw new Error(`Stylesheet must use a relative project path: ${href}`);
    const relative = decodeURIComponent(href.split(/[?#]/, 1)[0]);
    const absolute = path.resolve(projectRoot, relative);
    const inside = path.relative(projectRoot, absolute);
    if (inside.startsWith("..") || path.isAbsolute(inside)) throw new Error(`Stylesheet escapes project: ${href}`);
    const file = inside.split(path.sep).join("/");
    if (!file.startsWith(PRODUCTION_STYLES) && !file.startsWith(DEV_STYLES)) {
      throw new Error(`Stylesheet has no presentation/DEV owner: ${file}`);
    }
    if (!file.endsWith(".css")) throw new Error(`Stylesheet must be CSS: ${file}`);
    if (page === "index.html" && file.startsWith(DEV_STYLES)) throw new Error(`Production loads DEV CSS: ${file}`);
    if (seen.has(file)) throw new Error(`Duplicate stylesheet: ${file}`);
    if (!fs.existsSync(absolute)) throw new Error(`Missing stylesheet: ${file}`);
    seen.add(file);
    const css = fs.readFileSync(absolute, "utf8");
    if (/@import\b/i.test(css.replace(/\/\*[^]*?\*\//g, ""))) throw new Error(`Native stylesheet must not add an import waterfall: ${file}`);
    stylesheets.push({ file, href, css });
  }
  if (stylesheets.length === 0) throw new Error(`${page} has no stylesheets`);
  return stylesheets;
}

function readPageCss(options = {}) {
  return readPageStylesheets(options).map(({ css }) => css).join("\n");
}

function validatePageStyleComposition(projectRoot = DEFAULT_ROOT) {
  const production = readPageStylesheets({ projectRoot });
  const development = readPageStylesheets({ projectRoot, page: "dev.html" });
  const productionPaths = production.map(({ file }) => file);
  const reused = development.filter(({ file }) => file.startsWith(PRODUCTION_STYLES)).map(({ file }) => file);
  if (JSON.stringify(reused) !== JSON.stringify(productionPaths) ||
      JSON.stringify(development.slice(0, production.length).map(({ file }) => file)) !== JSON.stringify(productionPaths)) {
    throw new Error("DEV must reuse production CSS in the same order, followed by DEV styles");
  }
  if (!development.some(({ file }) => file.startsWith(DEV_STYLES))) throw new Error("DEV page has no DEV stylesheet");
  const version = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8")).version;
  for (const { file, href } of [...production, ...development]) {
    if (new URL(href, "http://project.local/").searchParams.get("v") !== version) {
      throw new Error(`Stylesheet cache version differs from project version: ${file}`);
    }
  }
  const linked = new Set(development.map(({ file }) => file));
  const walk = (relative) => {
    for (const entry of fs.readdirSync(path.join(projectRoot, relative), { withFileTypes: true })) {
      const file = relative + entry.name;
      if (entry.isDirectory()) walk(`${file}/`);
      else if (file.endsWith(".css") && !linked.has(file)) throw new Error(`Unlinked stylesheet: ${file}`);
    }
  };
  walk(PRODUCTION_STYLES);
  walk(DEV_STYLES);
  return { production, development };
}

module.exports = { readPageStylesheets, readPageCss, validatePageStyleComposition };
