const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const checks = [];

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function projectPath(file) {
  return normalizePath(path.relative(ROOT, file));
}

function filesUnder(relativeDirectory) {
  const directory = path.join(ROOT, relativeDirectory);
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...filesUnder(projectPath(absolute)));
    } else if (entry.name.endsWith(".js")) {
      files.push(absolute);
    }
  }
  return files;
}

function sourceLines(file) {
  return fs.readFileSync(file, "utf8").split(/\r?\n/);
}

function addFailure(failures, file, lineNumber, symbol, reason) {
  failures.push({
    file: projectPath(file),
    line: lineNumber,
    symbol,
    reason,
  });
}

function findForbiddenReferences(files, rules) {
  const failures = [];
  for (const file of files) {
    const normalized = projectPath(file);
    for (const rule of rules) {
      if (rule.allowFile && rule.allowFile(normalized)) continue;
      const lines = sourceLines(file);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        for (const pattern of rule.patterns) {
          pattern.regex.lastIndex = 0;
          if (pattern.regex.test(line)) {
            addFailure(
              failures,
              file,
              index + 1,
              pattern.symbol,
              rule.reason,
            );
          }
        }
      }
    }
  }
  return failures;
}

function assertNoFailures(failures, message) {
  if (failures.length > 0) {
    const details = failures
      .map(
        (failure) =>
          `${failure.file}:${failure.line} forbidden ${failure.symbol} (${failure.reason})`,
      )
      .join("\n");
    throw new Error(`${message}\n${details}`);
  }
  checks.push(message);
}

const renderFiles = filesUnder("src/render");
const renderCoreFiles = filesUnder("src/render/core");
const worldFiles = filesUnder("src/world").concat([path.join(ROOT, "src/app/world.js")]);

const appSystemSymbols = [
  "GameApplication",
  "GameCompositionRoot",
  "StateMachine",
  "ScoutingState",
  "WaitingState",
  "BitingState",
  "PlayingState",
  "FailedState",
  "VictoryState",
  "InventoryManager",
  "InventoryUI",
  "FishingController",
  "FightService",
  "FightSessionFactory",
  "FightPhysicsSystem",
  "TensionMeter",
  "ChumManager",
  "BiteSystem",
  "GameWorld",
  "LocationMap",
  "FloatEntity",
  "NetSystem",
];

const domainSymbols = [
  "InventoryManager",
  "FishingController",
  "FightPhysicsSystem",
  "TensionMeter",
  "ChumManager",
  "BiteSystem",
  "GameWorld",
  "LocationMap",
  "FloatEntity",
  "NetSystem",
];

const renderForbiddenRules = [
  {
    reason: "render layer must consume presentation models, not app/systems/state classes",
    patterns: appSystemSymbols.map((symbol) => ({
      symbol,
      regex: new RegExp(`\\b${symbol}\\b`),
    })),
  },
  {
    reason: "render layer must not reach browser DOM directly",
    patterns: [
      { symbol: "document", regex: /\bdocument\./ },
      { symbol: "window", regex: /\bwindow\./ },
      { symbol: "querySelector", regex: /\bquerySelector\s*\(/ },
      { symbol: "getElementById", regex: /\bgetElementById\s*\(/ },
      { symbol: "classList", regex: /\bclassList\b/ },
    ],
    allowFile: (file) => file === "src/render/core/canvas_2d_surface.js",
  },
];

const renderCoreForbiddenRules = [
  {
    reason: "render/core must stay independent from domain entities",
    patterns: domainSymbols.map((symbol) => ({
      symbol,
      regex: new RegExp(`\\b${symbol}\\b`),
    })),
  },
];

const worldForbiddenRules = [
  {
    reason: "world layer must not depend on render, DOM, Canvas, or Image details",
    patterns: [
      { symbol: "Canvas2DSurface", regex: /\bCanvas2DSurface\b/ },
      { symbol: "CanvasPrimitives", regex: /\bCanvasPrimitives\b/ },
      { symbol: "RenderFrameBuffer", regex: /\bRenderFrameBuffer\b/ },
      { symbol: "GameRenderPipeline", regex: /\bGameRenderPipeline\b/ },
      { symbol: "ImageAssetProvider", regex: /\bImageAssetProvider\b/ },
      { symbol: "document", regex: /\bdocument\./ },
      { symbol: "window", regex: /\bwindow\./ },
      { symbol: "getContext", regex: /\bgetContext\s*\(/ },
      { symbol: "new Image", regex: /\bnew\s+Image\s*\(/ },
    ],
  },
];

assertNoFailures(
  findForbiddenReferences(renderFiles, renderForbiddenRules),
  "render layer dependency direction is enforced",
);
assertNoFailures(
  findForbiddenReferences(renderCoreFiles, renderCoreForbiddenRules),
  "render/core has no domain dependencies",
);
assertNoFailures(
  findForbiddenReferences(worldFiles, worldForbiddenRules),
  "world layer has no render or browser graphics dependencies",
);

const indexSource = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
function assertScriptBefore(left, right, message) {
  const leftIndex = indexSource.indexOf(left);
  const rightIndex = indexSource.indexOf(right);
  if (leftIndex < 0 || rightIndex < 0 || leftIndex >= rightIndex) {
    throw new Error(`${message}: ${left} must be before ${right}`);
  }
  checks.push(message);
}

assertScriptBefore(
  "src/render/core/render_frame_buffer.js",
  "src/render/pipeline/game_render_pipeline.js",
  "render core scripts load before render pipeline",
);
assertScriptBefore(
  "src/render/pipeline/game_render_pipeline.js",
  "src/app/rendering/game_render_frame_builder.js",
  "render pipeline scripts load before app frame builders",
);
assertScriptBefore(
  "src/app/core/dependency_contract_validator.js",
  "src/app/bootstrap.js",
  "composition contract validator loads before bootstrap",
);

const syntheticFile = path.join(ROOT, "__synthetic_render_dependency_check__.js");
const syntheticFailure = [];
addFailure(
  syntheticFailure,
  syntheticFile,
  7,
  "InventoryManager",
  "synthetic dependency violation",
);
const syntheticMessage = `${syntheticFailure[0].file}:${syntheticFailure[0].line} forbidden ${syntheticFailure[0].symbol}`;
if (!syntheticMessage.includes("__synthetic_render_dependency_check__.js:7 forbidden InventoryManager")) {
  throw new Error("dependency failures must include file, line and forbidden symbol");
}
checks.push("dependency violations report file, line and forbidden symbol");

console.log("render-layer-dependency-check passed:");
for (const message of checks) console.log("- " + message);
