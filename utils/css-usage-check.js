"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const espree = require("espree");
const { readPageStylesheets, validatePageStyleComposition } = require("./testing/styles/page_stylesheet_reader");

const ROOT = path.resolve(__dirname, "..");

// Class names the code can put on elements: every token of a string literal or template text, plus the
// static prefix before a dynamic part (`is-${tone}`, "slot--" + kind).
class ClassVocabulary {
  tokens = new Set();
  prefixes = new Set();

  addHtml(text) {
    for (const token of text.split(/[^A-Za-z0-9_-]+/)) this.tokens.add(token);
  }

  addModule(text, onInjectedStyle = () => {}) {
    const visit = (node) => {
      if (!node || typeof node.type !== "string") return;
      if (node.type === "AssignmentExpression" && node.left.type === "MemberExpression" &&
          node.left.object.name === "style" && ["textContent", "innerHTML"].includes(node.left.property.name) &&
          node.right.type === "TemplateLiteral" && node.right.expressions.length === 0) {
        onInjectedStyle(node.right.quasis[0].value.cooked);
      }
      if (node.type === "Literal" && typeof node.value === "string") this.#addText(node.value);
      if (node.type === "TemplateLiteral") {
        node.quasis.forEach((quasi, index) => {
          this.#addText(quasi.value.cooked);
          if (index < node.quasis.length - 1) this.#addPrefix(quasi.value.cooked);
        });
      }
      if (node.type === "BinaryExpression" && node.operator === "+" && node.left.type === "Literal" &&
        typeof node.left.value === "string") this.#addPrefix(node.left.value);
      for (const key of Object.keys(node)) {
        const value = node[key];
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value.type === "string") visit(value);
      }
    };
    visit(espree.parse(text, { ecmaVersion: "latest", sourceType: "module" }));
  }

  knows(className) {
    return this.tokens.has(className) || [...this.prefixes].some((prefix) => className.startsWith(prefix));
  }

  #addText(text) {
    for (const token of text.split(/[^A-Za-z0-9_-]+/)) this.tokens.add(token);
  }

  #addPrefix(text) {
    const match = text.match(/([A-Za-z0-9_-]+)$/);
    if (match && match[1].length >= 3) this.prefixes.add(match[1]);
  }
}

function classSelectors(css) {
  return [...new Set([...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/\.([A-Za-z_][\w-]*)(?![^{]*;)/g)].map((m) => m[1]))];
}

function unusedClasses(css, vocabulary) {
  return classSelectors(css).filter((name) => !vocabulary.knows(name));
}

function stylePolicyViolations(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const bem = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
  const violations = classSelectors(source)
    .filter((name) => !bem.test(name) || /^(?:is|has)-/.test(name))
    .map((name) => `Non-BEM class: ${name}`);
  if (/font\s*:[^;{}]*\b\d+(?:\.\d+)?px[^;{}]*\binherit\s*;/i.test(source)) {
    violations.push("Invalid font shorthand: inherit cannot be a font family");
  }
  if (/outline(?:-style|-width)?\s*:\s*(?:none|0(?:px)?)\s*!important/i.test(source)) {
    violations.push("Forced focus outline removal");
  }
  if (/:\s+(?:active|hover|checked|focus-visible)\b/.test(source)) {
    violations.push("Whitespace splits a pseudo-class");
  }
  return violations;
}

function staticStyleViolations(source) {
  const violations = [];
  if (/createElement\(\s*["']style["']\s*\)/.test(source) || /\.cssText\s*=/.test(source)) {
    violations.push("Injected presentation styles");
  }
  for (const match of source.matchAll(/style=["']([^"']*)["']/g)) {
    if (!match[1].startsWith("--")) violations.push("Static inline presentation style");
  }
  return violations;
}

function projectVocabulary() {
  const production = new ClassVocabulary();
  const development = new ClassVocabulary();
  const injected = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(path.join(ROOT, directory), { withFileTypes: true })) {
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(relative);
      else if (relative.endsWith(".js")) {
        const text = fs.readFileSync(path.join(ROOT, relative), "utf8");
        assert.deepEqual(staticStyleViolations(text), [], `${relative} must leave static appearance in CSS`);
        const dev = relative.startsWith("src/dev/") || relative.startsWith("src/bootstrap/development/");
        development.addModule(text, (css) => injected.push({ file: relative, css, dev }));
        if (!dev) production.addModule(text);
      }
    }
  };
  walk("src");
  production.addHtml(fs.readFileSync(path.join(ROOT, "index.html"), "utf8"));
  for (const page of ["index.html", "dev.html"]) development.addHtml(fs.readFileSync(path.join(ROOT, page), "utf8"));
  return { production, development, injected };
}

// Negative fixtures: an unknown class is reported; static and dynamic uses are accepted.
const fixture = new ClassVocabulary();
fixture.addModule('const card = `item-card is-${tone}`; const slot = "slot--" + kind; el.className = "panel";');
assert.deepEqual(unusedClasses(".panel { } .item-card .is-positive { } .slot--rod { } .old-grid { }", fixture), ["old-grid"],
  "a class nobody uses is reported, static and dynamic uses are accepted");

const link = (href) => `<link rel="stylesheet" href="${href}">`;
const fixturePath = "src/game/presentation/styles/game-shell.css";
assert.throws(() => readPageStylesheets({ html: link(fixturePath) + link(`${fixturePath}?different=1`) }), /Duplicate stylesheet/);
assert.throws(() => readPageStylesheets({ html: link("src/game/presentation/styles/missing.css") }), /Missing stylesheet/);
assert.throws(() => readPageStylesheets({ html: link("src/dev/styles/dev-tools.css") }), /Production loads DEV CSS/);
assert.throws(() => readPageStylesheets({ html: link("../../outside.css") }), /escapes project/);
assert.throws(() => readPageStylesheets({ html: link("https://external.example/styles.css") }), /relative project path/);
assert.equal(stylePolicyViolations('.is-open {} .card__image--large {}').length, 1);
assert.equal(stylePolicyViolations('.card { font: 700 12px inherit; }').length, 1);
assert.equal(stylePolicyViolations('*:focus { outline: none !important; }').length, 1);
assert.equal(stylePolicyViolations('button: active { transform: scale(1); }').length, 1);
assert.equal(staticStyleViolations('document.createElement("style");').length, 1);
assert.equal(staticStyleViolations('el.style.cssText = "color: red";').length, 1);
assert.equal(staticStyleViolations('`<span style="color:red">text</span>`').length, 1);
assert.deepEqual(staticStyleViolations('`<span style="--debug-overlay-color:${color};">text</span>`'), []);

const composition = validatePageStyleComposition();
const vocabulary = projectVocabulary();
const stylesheets = composition.development;
let total = 0;
for (const { file, css } of [...stylesheets, ...vocabulary.injected]) {
  const dev = file.startsWith("src/dev/");
  const unused = unusedClasses(css, dev ? vocabulary.development : vocabulary.production);
  total += classSelectors(css).length;
  assert.deepEqual(stylePolicyViolations(css), [], `${file} violates the BEM/focus/font policy`);
  assert.deepEqual(unused, [], `${file} styles classes that no code uses: ${unused.join(", ")}`);
}
assert.equal(vocabulary.injected.length, 0, "static presentation styles belong in native CSS assets");
console.log(`CSS usage passed: ${total} class selectors across ${stylesheets.length} linked stylesheets and no injected blocks; native order/version/ownership/reachability and BEM/focus/font policy valid; 13 negative fixtures rejected.`);
