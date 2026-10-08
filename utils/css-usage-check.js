"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const espree = require("espree");

const ROOT = path.resolve(__dirname, "..");
const STYLES = ["src/game/presentation/styles/style.css", "src/game/presentation/styles/inventory.css"];

// Class names the code can put on elements: every token of a string literal or template text, plus the
// static prefix before a dynamic part (`is-${tone}`, "slot--" + kind).
class ClassVocabulary {
  tokens = new Set();
  prefixes = new Set();

  addHtml(text) {
    for (const token of text.split(/[^A-Za-z0-9_-]+/)) this.tokens.add(token);
  }

  addModule(text) {
    const visit = (node) => {
      if (!node || typeof node.type !== "string") return;
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

function projectVocabulary() {
  const vocabulary = new ClassVocabulary();
  const walk = (directory) => {
    for (const entry of fs.readdirSync(path.join(ROOT, directory), { withFileTypes: true })) {
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(relative);
      else if (relative.endsWith(".js")) vocabulary.addModule(fs.readFileSync(path.join(ROOT, relative), "utf8"));
    }
  };
  walk("src");
  for (const page of ["index.html", "dev.html"]) vocabulary.addHtml(fs.readFileSync(path.join(ROOT, page), "utf8"));
  return vocabulary;
}

// Negative fixtures: an unknown class is reported; static and dynamic uses are accepted.
const fixture = new ClassVocabulary();
fixture.addModule('const card = `item-card is-${tone}`; const slot = "slot--" + kind; el.className = "panel";');
assert.deepEqual(unusedClasses(".panel { } .item-card .is-positive { } .slot--rod { } .old-grid { }", fixture), ["old-grid"],
  "a class nobody uses is reported, static and dynamic uses are accepted");

const vocabulary = projectVocabulary();
let total = 0;
for (const file of STYLES) {
  const css = fs.readFileSync(path.join(ROOT, file), "utf8");
  const unused = unusedClasses(css, vocabulary);
  total += classSelectors(css).length;
  assert.deepEqual(unused, [], `${file} styles classes that no code uses: ${unused.join(", ")}`);
}
console.log(`CSS usage passed: ${total} class selectors in ${STYLES.length} stylesheets are all used by code; unused-class fixture rejected.`);
