const fs = require("node:fs");
const path = require("node:path");
const { RenderTestHarness } = require("./helpers/render_test_harness");

const ROOT = path.resolve(__dirname, "..");
const HOT_METHODS = ["render", "buildInto", "update", "draw", "resolveFrame", "buildFrame"];
const checks = [];

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function filesUnder(relativeDirectory) {
  const directory = path.join(ROOT, relativeDirectory);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return filesUnder(relative);
    return entry.name.endsWith(".js") ? [relative] : [];
  });
}

function sourceOf(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let inString = "";
  let inLineComment = false;
  let inBlockComment = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1] || "";
    if (inLineComment) {
      if (char === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }
    if (inString) {
      if (char === "\\") {
        index += 1;
      } else if (char === inString) {
        inString = "";
      }
      continue;
    }
    if (char === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      inString = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function findHotMethods(source) {
  const methods = [];
  for (const methodName of HOT_METHODS) {
    const matcher = new RegExp(`(^|\\n)\\s*(?:async\\s+)?${methodName}\\s*\\([^)]*\\)\\s*\\{`, "g");
    let match = matcher.exec(source);
    while (match) {
      const openIndex = matcher.lastIndex - 1;
      const closeIndex = findMatchingBrace(source, openIndex);
      if (closeIndex >= 0) {
        methods.push({
          name: methodName,
          start: openIndex,
          end: closeIndex,
          line: lineNumberAt(source, openIndex),
          body: source.slice(openIndex + 1, closeIndex),
        });
      }
      match = matcher.exec(source);
    }
  }
  return methods;
}

function hasAllowComment(line) {
  const markerIndex = line.indexOf("allocation-check-allow:");
  if (markerIndex < 0) return false;
  return line.slice(markerIndex + "allocation-check-allow:".length).trim().length > 0;
}

const allocationPatterns = [
  { symbol: "new", regex: /\bnew\s+[A-Z]\w*\s*\(/ },
  { symbol: "Object.assign object literal", regex: /Object\.assign\s*\([^,]+,\s*\{/ },
  { symbol: "object spread", regex: /\.\.\.[A-Za-z_$][\w$]*/ },
  { symbol: "setLineDash array literal", regex: /setLineDash\s*\(\s*\[/ },
  { symbol: "Array.from", regex: /\bArray\.from\s*\(/ },
  { symbol: "slice", regex: /\.slice\s*\(/ },
  { symbol: "concat", regex: /\.concat\s*\(/ },
  { symbol: "bind", regex: /\.bind\s*\(/ },
  { symbol: "map callback", regex: /\.map\s*\(/ },
  { symbol: "filter callback", regex: /\.filter\s*\(/ },
  { symbol: "reduce callback", regex: /\.reduce\s*\(/ },
  { symbol: "forEach callback", regex: /\.forEach\s*\(/ },
  { symbol: "inline arrow callback", regex: /=>/ },
  { symbol: "object literal argument", regex: /\w+\s*\(\s*\{/ },
  { symbol: "array literal argument", regex: /\w+\s*\(\s*\[/ },
  { symbol: "array literal assignment", regex: /=\s*\[/ },
];

function analyzeHotAllocations(files) {
  const failures = [];
  for (const file of files) {
    const source = sourceOf(file);
    const methods = findHotMethods(source);
    for (const method of methods) {
      const lines = method.body.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (hasAllowComment(line)) continue;
        for (const pattern of allocationPatterns) {
          pattern.regex.lastIndex = 0;
          if (pattern.regex.test(line)) {
            failures.push({
              file: normalizePath(file),
              line: method.line + index + 1,
              method: method.name,
              symbol: pattern.symbol,
              source: line.trim(),
            });
          }
        }
      }
    }
  }
  return failures;
}

function assertNoAllocationFailures(failures) {
  if (failures.length > 0) {
    const details = failures
      .map(
        (failure) =>
          `${failure.file}:${failure.line} ${failure.method}() allocates via ${failure.symbol}: ${failure.source}`,
      )
      .join("\n");
    throw new Error(`render hot path allocation violations\n${details}`);
  }
  checks.push("render hot methods contain no unchecked allocation patterns");
}

const harness = new RenderTestHarness(ROOT);
const context = harness.createContext({
  console,
  Math,
  Number,
  Object,
  Set,
  String,
  TypeError,
  Error,
});

harness.load(context, [
  "src/render/core/render_allocation_diagnostics.js",
  "src/render/core/render_frame_buffer.js",
  "src/render/core/render_order.js",
  "src/render/pipeline/game_render_pipeline.js",
  "src/core/fishing/pole_fight_sector_geometry.js",
  "src/app/rendering/fight_area_render_frame_builder.js",
]);

harness.run(context, `
const buffer = new RenderFrameBuffer();
const frameA = buffer.acquire();
const pointA = frameA.fishing.fightAreas.sectorPoints.acquire();
pointA.x = 1;
const frameB = buffer.acquire();
const pointB = frameB.fishing.fightAreas.sectorPoints.acquire();
if (frameA !== frameB) throw new Error("frame object is not reused");
if (pointA !== pointB) throw new Error("sector point records are not reused");
if (frameA.fishing.fightAreas.sectorPoints.getAt(0) !== pointB) {
  throw new Error("sector point records are not accessible without callback allocation");
}
const passes = [{ render() {} }];
const pipeline = new GameRenderPipeline({ passes });
if (pipeline.getPassCount() !== 1) throw new Error("render pass instances are not reused");
`, "utils/render-allocation-check.js#reuse");
checks.push("GameRenderFrame and ReusableRenderList records are reused");
checks.push("GameRenderPipeline reuses render pass instances");

const hotFiles = filesUnder("src/render")
  .concat(filesUnder("src/app/rendering"))
  .concat(["src/app/application.js"])
  .filter((file) => normalizePath(file) !== "src/render/core/render_pass.js");
assertNoAllocationFailures(analyzeHotAllocations(hotFiles));

assert(
  !/get\s+items\s*\(/.test(sourceOf("src/render/core/render_frame_buffer.js")),
  "ReusableRenderList does not expose mutable item storage",
);
assert(
  !/setLineDash\s*\(\s*\[/.test(hotFiles.map(sourceOf).join("\n")),
  "setLineDash uses reusable dash constants",
);
assert(
  !/drawFittedText\s*\(\s*\{/.test(sourceOf("src/render/screens/victory_renderer.js")),
  "VictoryRenderer reuses fitted text options",
);

const syntheticSource = `
class SyntheticHotPath {
  render() {
    const point = new Point();
    Object.assign(point, { x: 1 });
    this.draw({ value: 1 });
    this.ctx.setLineDash([1, 2]);
    [1].forEach((value) => this.draw(value));
  }
  update() {
    const list = Array.from(items);
    return list.slice().concat([]);
  }
  buildInto() {
    const debug = new DebugOnly(); // allocation-check-allow: debug-only allocation is outside production path
  }
}
`;
const syntheticFile = "__synthetic_hot_path__.js";
const originalSourceOf = sourceOf;
function syntheticAnalyze() {
  const methods = findHotMethods(syntheticSource);
  const failures = [];
  for (const method of methods) {
    const lines = method.body.split(/\\r?\\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (hasAllowComment(line)) continue;
      for (const pattern of allocationPatterns) {
        pattern.regex.lastIndex = 0;
        if (pattern.regex.test(line)) {
          failures.push({
            file: syntheticFile,
            line: method.line + index + 1,
            method: method.name,
            symbol: pattern.symbol,
          });
        }
      }
    }
  }
  return failures;
}
const syntheticFailures = syntheticAnalyze();
if (syntheticFailures.length < 8) {
  throw new Error("synthetic allocation violations were not detected");
}
if (syntheticFailures.some((failure) => failure.symbol === "debug-only")) {
  throw new Error("local allocation whitelist comments must suppress only their own line");
}
checks.push("synthetic hot path allocation fixture fails as expected");

console.log("render-allocation-check passed:");
for (const message of checks) console.log("- " + message);
