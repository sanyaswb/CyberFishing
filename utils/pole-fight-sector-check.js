const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/fishing/pole_fight_sector_geometry.js",
  "src/core/fishing/pole_fight_sector_constraint.js",
  "src/render/core/render_frame_buffer.js",
  "src/render/fishing/fight_area_renderer.js",
  "src/app/rendering/fight_area_render_frame_builder.js",
];
const FIGHT_SYSTEM_FILE = "src/systems/fight_physics_system.js";
const FISHING_RENDER_FILE =
  "src/app/rendering/fight_area_render_frame_builder.js";
const checks = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}

function approx(actual, expected, epsilon, message) {
  if (Math.abs(Number(actual) - expected) > epsilon) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
  checks.push(`${message} (${Number(actual).toFixed(4)})`);
}

const context = vm.createContext({
  console,
  Math,
  Number,
  Object,
  assert,
  approx,
});
vm.runInContext(`
class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
}
`, context);
for (const file of FILES) {
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, file), "utf8"),
    context,
    { filename: file },
  );
}

const fightSystemSource = fs.readFileSync(
  path.join(ROOT, FIGHT_SYSTEM_FILE),
  "utf8",
);
assert(
  fightSystemSource.includes("poleFightSectorLimitRadiusPx"),
  "fight runtime publishes the physical released-line radius",
);
assert(
  fightSystemSource.includes("#resolvePoleFightSectorLimitRadiusPx"),
  "autonomous, Hold and Control derive sector radius from line state",
);
const fishingRenderSource = fs.readFileSync(
  path.join(ROOT, FISHING_RENDER_FILE),
  "utf8",
);
assert(
  fishingRenderSource.includes("this.#sectorGeometry.resolve({"),
  "render preview uses the injected shared sector geometry",
);
const rendererSource = fs.readFileSync(
  path.join(ROOT, "src/render/fishing/fight_area_renderer.js"),
  "utf8",
);
assert(
  !rendererSource.includes("Math.hypot("),
  "sector renderer does not reconstruct a fake geometry radius",
);
assert(
  rendererSource.includes("model.sectorPoints"),
  "sector renderer consumes prebuilt physical geometry points",
);

vm.runInContext(`
const geometryBuilder = new PoleFightSectorGeometry();
const constraint = new PoleFightSectorConstraint({ geometry: geometryBuilder });
const origin = { x: 500, y: 700 };
const config = {
  enabled: true,
  maxAngleFromCenterDeg: 60,
  shoreOpeningWidthMeters: 1,
};
const limitRadiusPx = 300;
const pixelsPerMeter = 50;
const pointAtRadialOrigin = (angleDeg, radius) => {
  const angle = angleDeg * Math.PI / 180;
  return {
    x: origin.x + Math.sin(angle) * radius,
    y: origin.y - Math.cos(angle) * radius,
  };
};
const radiusOf = (point) => Math.hypot(point.x - origin.x, point.y - origin.y);

const geometry = geometryBuilder.resolve({
  origin,
  config,
  limitRadiusPx,
  pixelsPerMeter,
  position: pointAtRadialOrigin(0, 200),
});
const apex = {
  x: geometry.sectorApexX,
  y: geometry.sectorApexY,
};
const pointAtSectorApex = (angleDeg, distance) => {
  const angle = angleDeg * Math.PI / 180;
  return {
    x: apex.x + Math.sin(angle) * distance,
    y: apex.y - Math.cos(angle) * distance,
  };
};
const angleOf = (point) =>
  Math.atan2(point.x - apex.x, -(point.y - apex.y)) * 180 / Math.PI;
assert(geometry.active === true, "sector geometry is active with a 6 m radius");
approx(geometry.limitRadiusPx, 300, 0.000001, "6 m at 50 px/m resolves to 300 px");
approx(
  geometry.apexOffsetPx,
  25 / Math.tan(Math.PI / 3),
  0.000001,
  "1 m shore opening resolves to the expected hidden apex offset",
);
approx(geometry.sectorApexX, origin.x, 0.000001, "sector apex stays centered under the rod");
assert(geometry.sectorApexY > origin.y, "sector apex is hidden below the shoreline");
assert(
  geometryBuilder.contains({ x: origin.x - 25, y: origin.y }, geometry) &&
    geometryBuilder.contains({ x: origin.x + 25, y: origin.y }, geometry),
  "sector is exactly 1 m wide on the shoreline",
);
assert(
  !geometryBuilder.contains({ x: origin.x + 25.01, y: origin.y }, geometry),
  "point beyond the configured shore opening is rejected",
);
assert(
  geometryBuilder.contains(pointAtRadialOrigin(0, 299), geometry),
  "center point inside line radius is allowed",
);
assert(
  geometryBuilder.contains(
    {
      x: geometry.rightBoundaryRadiusIntersectionX,
      y: geometry.rightBoundaryRadiusIntersectionY,
    },
    geometry,
  ),
  "angular and radial boundary intersection is allowed",
);
assert(
  !geometryBuilder.contains(pointAtSectorApex(61, 250), geometry),
  "point outside apex angle is rejected",
);
assert(
  !geometryBuilder.contains(pointAtRadialOrigin(0, 301), geometry),
  "point outside rod-centered line radius is rejected",
);

let from = pointAtSectorApex(0, 250);
let proposed = pointAtSectorApex(20, 250);
let frame = constraint.resolveMovement({
  fromPosition: from,
  proposedPosition: proposed,
  origin,
  config,
  limitRadiusPx,
  pixelsPerMeter,
});
assert(frame.active === true, "shared movement sector is active");
assert(frame.clamped === false, "movement inside red area remains free");

from = pointAtSectorApex(50, 250);
proposed = pointAtSectorApex(70, 250);
frame = constraint.resolveMovement({
  fromPosition: from,
  proposedPosition: proposed,
  origin,
  config,
  limitRadiusPx,
  pixelsPerMeter,
});
assert(frame.clamped === true, "angle crossing is clipped");
approx(angleOf({ x: frame.positionX, y: frame.positionY }), 60, 0.0002, "angle crossing stops at first 60 degree intersection");
assert(frame.boundaryType === "angle", "angle crossing reports angular boundary");

from = pointAtRadialOrigin(0, 250);
proposed = pointAtRadialOrigin(0, 350);
frame = constraint.resolveMovement({
  fromPosition: from,
  proposedPosition: proposed,
  origin,
  config,
  limitRadiusPx,
  pixelsPerMeter,
});
assert(frame.clamped === true, "radial crossing is clipped");
approx(radiusOf({ x: frame.positionX, y: frame.positionY }), 300, 0.0002, "radial crossing stops on released-line arc");
assert(frame.boundaryType === "radius", "radial crossing reports line-radius boundary");

from = pointAtSectorApex(50, 250);
proposed = pointAtSectorApex(80, 360);
frame = constraint.resolveMovement({
  fromPosition: from,
  proposedPosition: proposed,
  origin,
  config,
  limitRadiusPx,
  pixelsPerMeter,
});
assert(frame.clamped === true, "combined angle/radius crossing is clipped once");
assert(
  Math.hypot(frame.positionX - from.x, frame.positionY - from.y) <=
    Math.hypot(proposed.x - from.x, proposed.y - from.y) + 0.000001,
  "combined solver never adds movement distance",
);
assert(
  Math.abs(angleOf({ x: frame.positionX, y: frame.positionY })) <= 60.0002 && radiusOf({ x: frame.positionX, y: frame.positionY }) <= 300.0002,
  "combined solver returns a point inside both physical boundaries",
);

from = pointAtSectorApex(80, 250);
proposed = pointAtSectorApex(75, 250);
frame = constraint.resolveMovement({
  fromPosition: from,
  proposedPosition: proposed,
  origin,
  config,
  limitRadiusPx,
  pixelsPerMeter,
});
assert(frame.recoveryMovement === true, "fish outside angle may return gradually");
assert(frame.clamped === false, "recovery does not snap fish to the boundary");
assert(Math.abs(angleOf({ x: frame.positionX, y: frame.positionY })) > 60, "gradual recovery may remain outside for another frame");

from = pointAtSectorApex(80, 250);
proposed = pointAtSectorApex(85, 250);
frame = constraint.resolveMovement({
  fromPosition: from,
  proposedPosition: proposed,
  origin,
  config,
  limitRadiusPx,
  pixelsPerMeter,
});
assert(frame.clamped === true, "movement farther outside is blocked");
approx(frame.positionX, from.x, 0.000001, "blocked outside movement keeps current X");
approx(frame.positionY, from.y, 0.000001, "blocked outside movement keeps current Y");

const paths = [];
let currentPath = null;
const strokes = [];
const fills = [];
const ctx = {
  globalAlpha: 1,
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 1,
  save() {},
  restore() {},
  beginPath() { currentPath = []; paths.push(currentPath); },
  moveTo(x, y) { currentPath.push({ type: "move", x, y }); },
  lineTo(x, y) { currentPath.push({ type: "line", x, y }); },
  arc() { throw new Error("physical sector renderer must not use a screen-space arc"); },
  closePath() { currentPath.push({ type: "close" }); },
  fill() { fills.push({ style: this.fillStyle, path: currentPath }); },
  stroke() { strokes.push({ style: this.strokeStyle, path: currentPath }); },
  setLineDash() {},
  rect() {},
  clip() {},
  fillRect() {},
  ellipse() {},
};
const projector = {
  getScale: () => 1,
  virtualToScreen: (x, y, target = {}) => {
    target.x = x;
    target.y = y;
    return target;
  },
  screenToVirtual: (x, y, target = {}) => {
    target.x = x;
    target.y = y;
    return target;
  },
};
const locations = {
  debugVisuals: true,
  showPoleFightSector: true,
  showFightLineRadius: true,
  cellSize: 40,
  currentLocationId: "test",
  map: {
    test: {
      zones: {
        castable: [{ x: 0, y: 0, w: 64, h: 20 }],
      },
    },
  },
};
const sectorDebug = {
  poleFightSectorActive: true,
  poleFightSectorClamped: false,
  poleFightSectorOriginX: origin.x,
  poleFightSectorOriginY: origin.y,
  poleFightSectorApexX: geometry.sectorApexX,
  poleFightSectorApexY: geometry.sectorApexY,
  poleFightSectorApexOffsetPx: geometry.apexOffsetPx,
  poleFightSectorMaxAngleDeg: 60,
  poleFightSectorLimitRadiusPx: 300,
  poleFightSectorLeftBoundaryRadiusIntersectionX:
    geometry.leftBoundaryRadiusIntersectionX,
  poleFightSectorLeftBoundaryRadiusIntersectionY:
    geometry.leftBoundaryRadiusIntersectionY,
  poleFightSectorRightBoundaryRadiusIntersectionX:
    geometry.rightBoundaryRadiusIntersectionX,
  poleFightSectorRightBoundaryRadiusIntersectionY:
    geometry.rightBoundaryRadiusIntersectionY,
};
const area = new GameRenderFrame().fishing.fightAreas;
const builder = new FightAreaRenderFrameBuilder({
  projector,
  config: {
    locations,
    physics: { fight: { poleFightSector: config } },
    fightPhysicsConfig: {
      getPoleFightSectorConfig: () => config,
      getPixelsPerMeter: () => pixelsPerMeter,
    },
  },
  canvasMetrics: { width: 1000, height: 800 },
  getRodScreenX: () => origin.x,
  landingAreaBuilder: { buildInto() {} },
  sectorGeometry: geometryBuilder,
});
builder.buildInto({
  target: area,
  clipRegions: new ReusableRenderList(),
  state: "playing",
  bottom: origin.y,
  fightDebug: sectorDebug,
  equipment: {},
  floatVirtualPosition: { x: origin.x, y: origin.y - 200 },
});
const renderer = new FightAreaRenderer({
  surface: ctx,
  primitives: {
    beginClip() { return false; },
    endClip() {},
  },
  styleResolver: {
    resolve() {
      return {
        catchFill: "", catchStroke: "",
        lastDashFill: "", lastDashStroke: "", lastDashDash: [],
        netFill: "", netStroke: "",
        sectorFill: "rgba(175, 0, 35, 0.28)",
        sectorClampedFill: "rgba(210, 35, 25, 0.32)",
        sectorStroke: "rgba(255, 70, 70, 0.98)",
        sectorClampedStroke: "rgba(255, 145, 35, 1)",
        sectorAxis: "rgba(255, 255, 255, 0.7)",
        lineRadiusStroke: "rgba(255, 230, 0, 0.98)",
      };
    },
  },
});
renderer.render(area);
assert(fills.length === 1, "renderer fills the red allowed movement area");
assert(strokes.length === 3, "renderer draws red boundary, center axis and yellow line arc");
const redPath = fills[0].path;
const redArc = redPath.filter((point) => point.type === "line");
assert(redPath[0].type === "move", "red sector starts at the hidden apex");
approx(redPath[0].x, apex.x, 0.000001, "red sector apex X matches physics");
approx(redPath[0].y, apex.y, 0.000001, "red sector apex Y matches physics");
const maxRedArcRadiusError = Math.max(
  ...redArc.map((point) =>
    Math.abs(Math.hypot(point.x - origin.x, point.y - origin.y) - 300)
  ),
);
approx(maxRedArcRadiusError, 0, 0.0001, "red outer arc uses exact line radius");
const yellowStroke = strokes.find((entry) => entry.style.includes("255, 230, 0"));
assert(!!yellowStroke, "yellow unrestricted line-radius arc is visible");
const yellowPoints = yellowStroke.path.filter((point) => point.type === "line" || point.type === "move");
approx(yellowPoints[0].x, 200, 0.0001, "yellow semicircle starts 300 px left of origin");
approx(yellowPoints[yellowPoints.length - 1].x, 800, 0.0001, "yellow semicircle ends 300 px right of origin");
const redTop = redArc[Math.floor(redArc.length / 2)];
const yellowTop = yellowPoints[Math.floor(yellowPoints.length / 2)];
approx(redTop.x, yellowTop.x, 0.0001, "red and yellow arcs share the same top X");
approx(redTop.y, yellowTop.y, 0.0001, "red outer arc coincides with yellow line boundary");

locations.showPoleFightSector = false;
locations.showFightLineRadius = false;
area.showSector = false;
area.showLineRadius = false;
renderer.render(area);
assert(fills.length === 1 && strokes.length === 3, "disabled visual toggles skip both debug layers");
`, context, { filename: "utils/pole-fight-sector-check.js#scenario" });

console.log("pole-fight-sector-check passed:");
for (const message of checks) console.log("- " + message);
