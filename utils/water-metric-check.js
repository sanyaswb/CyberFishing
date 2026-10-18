"use strict";

const assert = require("node:assert/strict");
const { SourceRuntime } = require("./testing/core/source_runtime");

const runtime = new SourceRuntime();
const { WaterMetric } = runtime.importModule("src/game/domain/locations/water_metric.js");
const { LocationWaterMetricResolver } = runtime.importModule(
  "src/game/domain/locations/location_water_metric_resolver.js");

// Test location: castable water 520..1160 virtual px, 50 px per metre (12.8 m uniform).
const LOCATION = Object.freeze({ pixelsPerMeter: 50, shoreY: 1160, topY: 520, centerX: 1280 });

function checkUniformMatchesPlainArithmetic() {
  const metric = new WaterMetric(LOCATION);
  assert.equal(metric.isUniform, true);
  let seed = 7;
  const next = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let index = 0; index < 500; index++) {
    const x1 = next() * 2560, y1 = 400 + next() * 900, x2 = next() * 2560, y2 = 400 + next() * 900;
    assert(Object.is(metric.distanceMeters(x1, y1, x2, y2), Math.hypot(x1 - x2, y1 - y2) / 50),
      "a uniform metric gives the plain pixel distance divided by pixelsPerMeter");
    assert(Object.is(metric.metersFromShore(y1), (1160 - y1) / 50));
    const meters = next() * 20;
    assert(Object.is(metric.yAtMeters(meters), 1160 - meters * 50));
    assert(Object.is(metric.distanceBasePixels(x1, y1, x2, y2), Math.hypot(x1 - x2, y1 - y2)),
      "uniform base pixels are the plain virtual pixel distance");
    const basePixels = next() * 900;
    assert(Object.is(metric.yAtBasePixels(basePixels), 1160 - basePixels), "uniform base pixels map 1:1 to height");
    assert(Object.is(metric.virtualPixelsFromShore(basePixels), basePixels), "uniform base pixels are map pixels");
    const plane = { x: NaN, y: NaN };
    metric.toBasePlane(x1, y1, plane);
    assert(Object.is(plane.x, x1) && Object.is(plane.y, y1), "the uniform ground plane is the virtual plane");
    metric.fromBasePlane(x2, y2, plane);
    assert(Object.is(plane.x, x2) && Object.is(plane.y, y2), "the uniform ground plane maps back 1:1");
    metric.velocityToBasePlane(x1, y1, x2, y2, plane);
    assert(Object.is(plane.x, x2) && Object.is(plane.y, y2), "uniform velocities are unchanged");
    metric.velocityFromBasePlane(x1, y1, x2, y2, plane);
    assert(Object.is(plane.x, x2) && Object.is(plane.y, y2), "uniform velocities map back unchanged");
  }
  assert(Object.is(metric.topBasePixels, 1160 - 520), "uniform water height in base pixels is the virtual height");
  assert.equal(metric.pixelsPerMeterX(520), 50);
  assert.equal(metric.pixelsPerMeterY(520), 50);
  assert.equal(metric.topMeters, 12.8);
}

function checkPerspectiveCurve() {
  const metric = new WaterMetric({ ...LOCATION, maxMeters: 30, linearShare: 0.5 });
  const close = (actual, expected, message, epsilon = 1e-9) =>
    assert(Math.abs(actual - expected) <= epsilon, `${message}: expected ${expected}, received ${actual}`);
  close(metric.metersFromShore(1160), 0, "the shore line is 0 m");
  close(metric.metersFromShore(1000), 3.2, "the lower half keeps 50 px per metre");
  close(metric.metersFromShore(840), 6.4, "the join lies at half the water height");
  close(metric.metersFromShore(520), 30, "the top edge lies at maxMeters");
  close(metric.topMeters, 30, "topMeters");
  close(metric.pixelsPerMeterY(841), 50, "below the join the depth scale is the base scale");
  close(metric.pixelsPerMeterY(839.999), 50, "the scale has no kink at the join", 1e-3);
  assert(metric.pixelsPerMeterY(520) < 8, "far water is strongly compressed");
  close(metric.pixelsPerMeterX(1000), 50, "lateral scale is the base scale near the shore");
  close(metric.pixelsPerMeterX(520), 50 * Math.sqrt(metric.pixelsPerMeterY(520) / 50),
    "lateral compression is the square root of the depth compression");
  let previous = -Infinity, previousScale = Infinity;
  for (let y = 1300; y >= 300; y -= 5) {
    const meters = metric.metersFromShore(y);
    assert(meters > previous, "metres grow monotonically away from the shore");
    const scale = metric.pixelsPerMeterY(y);
    assert(scale <= previousScale + 1e-12, "pixels per metre never grow with distance");
    close(metric.yAtMeters(meters), y, `yAtMeters inverts metersFromShore at y=${y}`, 1e-7);
    previous = meters;
    previousScale = scale;
  }
  close(metric.distanceMeters(1280, 1160, 1280, 520), 30, "straight out from the shore to the top is 30 m");
  close(metric.distanceMeters(1280, 520, 1380, 520), 100 / metric.pixelsPerMeterX(520),
    "a sideways distance uses the lateral scale at its height");
  const ground = { x: 0, y: 0 }, back = { x: 0, y: 0 };
  for (const [x, y] of [[1280, 1160], [100, 900], [2400, 600], [1500, 450]]) {
    metric.toVirtual(metric.toGround(x, y, ground).x, ground.y, back);
    close(back.x, x, "toVirtual inverts toGround (x)", 1e-7);
    close(back.y, y, "toVirtual inverts toGround (y)", 1e-7);
  }
  const fish = { x: 0, y: 0 };
  metric.toVirtual(2, 25, fish);
  const nearFish = { x: 0, y: 0 };
  metric.toVirtual(2, 2, nearFish);
  assert(fish.x - 1280 < nearFish.x - 1280, "the same 2 m sideways spans fewer pixels far away");
}

function checkLocationTilt() {
  const { WorldPerspective } = runtime.importModule("src/game/domain/locations/world_perspective.js");
  const point = {}, back = {}, plane = {}, velocity = {}, restored = {}, shifted = {};
  const close = (actual, expected, message, tolerance = 1e-7) =>
    assert(Math.abs(actual - expected) < tolerance, `${message}: ${actual} != ${expected}`);
  for (const tiltDegrees of [1, 15, 30, 45, 90]) {
    for (const linearShare of [0, .5]) {
      const metric = new WaterMetric({ ...LOCATION, maxMeters: 1000, linearShare, tiltDegrees });
      const squash = Math.sin(tiltDegrees * Math.PI / 180);
      close(metric.pixelsPerMeterY(LOCATION.shoreY) / metric.pixelsPerMeterX(LOCATION.shoreY), squash,
        `G-073: ${tiltDegrees} degrees gives the selected shore tilt`);
      close(metric.topMeters, 1000, "tilt preserves the configured far distance");
      const perspective = new WorldPerspective({ getWaterMetric: () => metric });
      close(perspective.getPerspective(LOCATION.shoreY).squashY, squash, "areas use the metric's angle");
      for (const [x, y] of [[1280, 1200], [700, 1100], [1800, 900], [1000, 600], [1500, 450]]) {
        metric.toGround(x, y, point); metric.toVirtual(point.x, point.y, back);
        close(back.x, x, "tilted ground/map X round-trip"); close(back.y, y, "tilted ground/map Y round-trip");
        metric.toBasePlane(x, y, plane); metric.fromBasePlane(plane.x, plane.y, back);
        close(back.x, x, "tilted base/map X round-trip"); close(back.y, y, "tilted base/map Y round-trip");
        metric.velocityFromBasePlane(x, y, 40, -30, velocity);
        const dt = 1e-5;
        metric.fromBasePlane(plane.x + 40 * dt, plane.y - 30 * dt, shifted);
        close(velocity.x, (shifted.x - x) / dt, "tilted velocity X follows the position derivative", .002);
        close(velocity.y, (shifted.y - y) / dt, "tilted velocity Y follows the position derivative", .002);
        metric.velocityToBasePlane(x, y, velocity.x, velocity.y, restored);
        close(restored.x, 40, "tilted velocity X round-trip"); close(restored.y, -30, "tilted velocity Y round-trip");
      }
    }
  }
  const flatTilt = new WaterMetric({ ...LOCATION, maxMeters: 5, tiltDegrees: 30 });
  assert.equal(flatTilt.isUniform, false, "a constant-scale tilted plane still needs ground conversion");
  close(flatTilt.pixelsPerMeterY(600), 128, "short water is fitted into the authored map height");
  close(flatTilt.pixelsPerMeterY(600) / flatTilt.pixelsPerMeterX(600), .5,
    "automatic fitting keeps the selected angle even on a short constant-scale plane");
  for (const tiltDegrees of [0, -1, 91, NaN, Infinity]) {
    assert.throws(() => new WaterMetric({ ...LOCATION, maxMeters: 1000, tiltDegrees }), /tiltDegrees/u);
  }
  const resolver = new LocationWaterMetricResolver({ pixelsPerMeter: 50, logger: { error() {} } });
  const bounds = { left: 0, right: 2560, top: 520, bottom: 1160 };
  const profile = { enabled: true, linearShare: 0, maxMeters: 40, tiltDegrees: 90 };
  const overhead = resolver.resolve(bounds, profile);
  profile.tiltDegrees = 30;
  const tilted = resolver.resolve(bounds, profile);
  assert.notEqual(tilted, overhead, "editing only this location's angle rebuilds its metric");
  assert.equal(resolver.resolve(bounds, { ...profile }), tilted, "unchanged tilt keeps the cached metric");
  profile.tiltDegrees = 0;
  assert.equal(resolver.resolve(bounds, profile), tilted, "an out-of-range live tilt keeps the previous valid metric");
}

// G-074: angle and far distance are independent authoring inputs, with projection scale fitted automatically.
function checkIndependentTiltAndLength() {
  assert.doesNotThrow(() => new WaterMetric({ ...LOCATION, maxMeters: .1, tiltDegrees: 1 }),
    "G-074: 1 degree at 0.1 m must be fitted without changing either setting");
  const point = {}, back = {}, velocity = {}, restored = {}, plane = {}, shifted = {};
  const close = (actual, expected, label, epsilon = 1e-7) =>
    assert(Math.abs(actual - expected) < epsilon, `${label}: ${actual} != ${expected}`);
  for (const maxMeters of [.1, 1, 5, 12.8, 30, 1000]) {
    for (const linearShare of [0, .5]) {
      const overhead = new WaterMetric({ ...LOCATION, maxMeters, linearShare, tiltDegrees: 90 });
      for (const tiltDegrees of [1, 15, 30, 45, 90]) {
        let metric;
        assert.doesNotThrow(() => { metric = new WaterMetric({ ...LOCATION, maxMeters, linearShare, tiltDegrees }); },
          `G-074: ${tiltDegrees} degrees must work at ${maxMeters} m without changing the length`);
        close(metric.topMeters, maxMeters, "the far edge keeps its authored length");
        close(metric.topBasePixels, maxMeters * 50, "physical base-pixel units stay independent of projection zoom");
        close(metric.pixelsPerMeterY(1160) / metric.pixelsPerMeterX(1160), Math.sin(tiltDegrees * Math.PI / 180),
          "the chosen shore angle survives automatic fitting");
        let previousX = Infinity, previousY = Infinity;
        for (const fraction of [0, .1, .4, .8, 1]) {
          const meters = maxMeters * fraction;
          const y = metric.yAtMeters(meters);
          close(y, overhead.yAtMeters(meters), "editing only the angle does not alter depth-axis metre positions");
          close(metric.metersFromShore(y), meters, "the fitted depth projection remains invertible");
          metric.toVirtual(.25, meters, point); metric.toGround(point.x, point.y, back);
          close(back.x, .25, "fitted lateral projection inverts"); close(back.y, meters, "fitted depth projection inverts");
          const px = metric.pixelsPerMeterX(y), py = metric.pixelsPerMeterY(y);
          assert(px <= previousX + 1e-7 && py <= previousY + 1e-7, "scale never grows away from shore");
          previousX = px; previousY = py;
        }
        // At an off-centre point, verify the exact motion Jacobian on the fitted plane too.
        metric.toVirtual(.2, maxMeters * .3, point);
        metric.toBasePlane(point.x, point.y, plane);
        metric.velocityFromBasePlane(point.x, point.y, 1, -.5, velocity);
        const dt = Math.min(1e-5, maxMeters * 1e-5);
        metric.fromBasePlane(plane.x + dt, plane.y - .5 * dt, shifted);
        const tolerance = 1e-4 * Math.max(1, Math.abs(velocity.x), Math.abs(velocity.y));
        close(velocity.x, (shifted.x - point.x) / dt, "fitted X velocity matches finite differences", tolerance);
        close(velocity.y, (shifted.y - point.y) / dt, "fitted Y velocity matches finite differences", tolerance);
        metric.velocityToBasePlane(point.x, point.y, velocity.x, velocity.y, restored);
        close(restored.x, 1, "fitted X velocity round-trip"); close(restored.y, -.5, "fitted Y velocity round-trip");
      }
    }
  }
}

function checkBasePixels() {
  const metric = new WaterMetric({ ...LOCATION, maxMeters: 30, linearShare: 0.5 });
  const close = (actual, expected, message) =>
    assert(Math.abs(actual - expected) <= 1e-7, `${message}: expected ${expected}, received ${actual}`);
  close(metric.topBasePixels, 1500, "the top edge lies at maxMeters x pixelsPerMeter base pixels");
  for (const basePixels of [0, 160, 320, 700, 1200, 1500, 1700]) {
    close(metric.yAtBasePixels(basePixels), metric.yAtMeters(basePixels / 50), `yAtBasePixels(${basePixels})`);
  }
  close(metric.distanceBasePixels(1280, 1160, 1400, 600), metric.distanceMeters(1280, 1160, 1400, 600) * 50,
    "distanceBasePixels is the ground distance in base pixels");
  close(metric.virtualPixelsFromShore(160), 160, "near the shore base pixels are map pixels");
  close(metric.virtualPixelsFromShore(1500), 640, "the far edge is the full map height of the water");
}

function checkGroundPlane() {
  const metric = new WaterMetric({ ...LOCATION, maxMeters: 30, linearShare: 0.5 });
  const close = (actual, expected, message, epsilon) =>
    assert(Math.abs(actual - expected) <= epsilon, `${message}: expected ${expected}, received ${actual}`);
  const plane = { x: 0, y: 0 }, back = { x: 0, y: 0 }, velocity = { x: 0, y: 0 }, velocityBack = { x: 0, y: 0 };
  const shifted = { x: 0, y: 0 };
  for (const [x, y] of [[1280, 1160], [100, 1100], [2400, 900], [300, 700], [2000, 530], [1500, 450]]) {
    metric.toBasePlane(x, y, plane);
    close(metric.distanceBasePixels(1280, 1160, x, y), Math.hypot(plane.x - 1280, plane.y - 1160),
      `plane distance from the shore centre equals the ground distance at (${x}, ${y})`, 1e-7);
    metric.fromBasePlane(plane.x, plane.y, back);
    close(back.x, x, "fromBasePlane inverts toBasePlane (x)", 1e-7);
    close(back.y, y, "fromBasePlane inverts toBasePlane (y)", 1e-7);
    for (const [vx, vy] of [[120, 0], [0, -80], [-60, 45]]) {
      metric.velocityFromBasePlane(x, y, vx, vy, velocity);
      const h = 1e-4;
      metric.fromBasePlane(plane.x + vx * h, plane.y + vy * h, shifted);
      close(velocity.x, (shifted.x - x) / h, `velocity x is the derivative of fromBasePlane at (${x}, ${y})`, 1e-2);
      close(velocity.y, (shifted.y - y) / h, `velocity y is the derivative of fromBasePlane at (${x}, ${y})`, 1e-2);
      metric.velocityToBasePlane(x, y, velocity.x, velocity.y, velocityBack);
      close(velocityBack.x, vx, "velocityToBasePlane inverts velocityFromBasePlane (x)", 1e-9);
      close(velocityBack.y, vy, "velocityToBasePlane inverts velocityFromBasePlane (y)", 1e-9);
    }
  }
  metric.velocityFromBasePlane(1280, 600, 0, -100, velocity);
  assert(velocity.y > -100 / 5 && velocity.y < 0, "far away 2 m/s away from the shore covers few virtual pixels");
}

function checkResolver() {
  const errors = [];
  const resolver = new LocationWaterMetricResolver({ pixelsPerMeter: 50, logger: { error: (message) => errors.push(message) } });
  const bounds = { left: 0, right: 2560, top: 520, bottom: 1160 };
  const uniform = resolver.resolve(bounds, undefined);
  assert.equal(uniform.isUniform, true, "a location without distanceProfile gets a uniform metric");
  assert.equal(uniform.shoreY, 1160, "the shore line is the bottom edge of the castable water");
  assert.equal(resolver.resolve({ ...bounds }, null), uniform, "unchanged inputs return the same metric");
  const profile = { enabled: false, linearShare: 0.5, maxMeters: 30 };
  assert.equal(resolver.resolve(bounds, profile), uniform, "a disabled profile keeps the uniform metric");
  profile.enabled = true;
  const profiled = resolver.resolve(bounds, profile);
  assert.notEqual(profiled, uniform, "enabling the profile rebuilds the metric");
  assert(Math.abs(profiled.topMeters - 30) < 1e-9, "the profile reaches maxMeters at the top edge");
  assert.equal(resolver.resolve(bounds, { ...profile }), profiled, "an equal profile object keeps the metric");
  assert.equal(profiled.toGround(1280, 520, { x: NaN, y: NaN }).x, 0, "the centre line is between the side edges");
  profile.linearShare = 0.25;
  const edited = resolver.resolve(bounds, profile);
  assert(edited !== profiled && edited.metersFromShore(900) > 5.2 + 1e-6,
    "a live linearShare edit rebuilds the metric");
  profile.maxMeters = 0;
  assert.equal(resolver.resolve(bounds, profile), edited, "an invalid live edit keeps the previous metric");
  assert.equal(resolver.resolve(bounds, profile), edited, "the rejected input is not rebuilt every frame");
  assert(errors.length === 1 && /positive and finite/u.test(errors[0]), "the rejection is logged once");
  profile.maxMeters = 30;
  assert.notEqual(resolver.resolve(bounds, profile), edited, "a valid edit after a rejection applies again");
  assert.notEqual(resolver.resolve({ ...bounds, top: 600 }, profile), edited, "changed bounds rebuild the metric");
  assert.throws(() => new LocationWaterMetricResolver({ pixelsPerMeter: 50, logger: null })
    .resolve(bounds, { enabled: true, linearShare: 0.5, maxMeters: 0 }), /positive and finite/u,
  "an invalid profile at startup fails fast");
}

// The production test location: castable zone rows 13..29 of 40 px cells (520..1160 virtual px).
function checkTestLocationProfile() {
  const { CONFIG } = runtime.importModule("src/game/config/runtime/game_config.js");
  const locations = CONFIG.locations;
  const map = locations.map.test;
  const zone = map.zones.castable[0];
  const bounds = { left: zone.x * locations.cellSize, right: (zone.x + zone.w) * locations.cellSize,
    top: zone.y * locations.cellSize, bottom: (zone.y + zone.h) * locations.cellSize };
  const metric = new LocationWaterMetricResolver({ pixelsPerMeter: CONFIG.physics.simulation.pixelsPerMeter, logger: null })
    .resolve(bounds, map.distanceProfile);
  assert.equal(map.distanceProfile.enabled, true, "the test location has perspective metres enabled");
  assert.equal(map.distanceProfile.tiltDegrees, 30, "restore the original authored shore angle");
  assert.equal(map.distanceProfile.maxMeters, 30, "restore the original authored far distance");
  assert(Math.abs(metric.topMeters - map.distanceProfile.maxMeters) < 1e-9,
    "the far edge of the test location lies at maxMeters");
  assert(Math.abs(metric.metersFromShore(bounds.bottom - (bounds.bottom - bounds.top) * map.distanceProfile.linearShare) -
    (bounds.bottom - bounds.top) * map.distanceProfile.linearShare / CONFIG.physics.simulation.pixelsPerMeter) < 1e-9,
  "the near share of the test location keeps the base scale");
}

// G-072: exercise the shipped profile, not a separately authored perspective fixture. Equal areas must already
// shrink within the first half of the green zone; the shore stays at its lower map edge through camera changes.
function checkPerspectiveStartsAtGreenZoneShore() {
  const { CONFIG } = runtime.importModule("src/game/config/runtime/game_config.js");
  const { WorldPerspective } = runtime.importModule("src/game/domain/locations/world_perspective.js");
  const { ViewportProjector } = runtime.importModule("src/game/application/viewport/viewport_projector.js");
  const { CastingRenderFrameBuilder } = runtime.importModule("src/game/presentation/rendering/casting_render_frame_builder.js");
  const { BoatChumRenderFrameBuilder } = runtime.importModule("src/game/presentation/rendering/boat_chum_render_frame_builder.js");
  const { LandingAreaRenderFrameBuilder } = runtime.importModule("src/game/presentation/rendering/landing_area_render_frame_builder.js");
  const { GameRenderFrame } = runtime.importModule("src/game/presentation/rendering/game_render_frame.js");
  const locations = CONFIG.locations, map = locations.map.test, zone = map.zones.castable[0], cell = locations.cellSize;
  const bounds = { left: zone.x * cell, right: (zone.x + zone.w) * cell,
    top: zone.y * cell, bottom: (zone.y + zone.h) * cell };
  const resolver = new LocationWaterMetricResolver({ pixelsPerMeter: CONFIG.physics.simulation.pixelsPerMeter });
  let metric = resolver.resolve(bounds, map.distanceProfile);
  assert(metric.pixelsPerMeterY(bounds.bottom - 1) < metric.pixelsPerMeter,
    "G-072: perspective starts immediately above the lower green-zone edge");
  const perspective = new WorldPerspective({ getWaterMetric: () => metric });
  const projector = new ViewportProjector(locations, "test", y => perspective.getPerspective(y));
  const centerX = (bounds.left + bounds.right) / 2;
  const zones = [0, 1, 2].map(meters => ({ x: centerX, y: metric.yAtMeters(meters), baseRadius: 20,
    isDelivered: true, isExpired: false, currentBonus: 2, baitConfig: { minBonus: 1, maxBonus: 2 } }));
  const chumBuilder = new BoatChumRenderFrameBuilder({ projector, config: CONFIG,
    chum: { getZones: () => zones, getBoats: () => [] } });
  const chumSource = { isAiming: () => false, getEquipment: () => ({}), getGameStateName: () => "scouting",
    getCastDistance: () => metric.pixelsPerMeter, getPowerAimVisual: () => null, getAccuracyPreview: () => null,
    getBounds: () => bounds, getNow: () => 0 };
  const canvasMetrics = { width: 0, height: 0 };
  const castingBuilder = new CastingRenderFrameBuilder({ projector, getWaterMetric: () => metric, config: CONFIG,
    canvasMetrics, hudStyleResolver: { resolveBarStyle: () => ({}) }, chumSource });
  const frame = new GameRenderFrame(), shore = { set(x, y) { this.x = x; this.y = y; return this; } };
  for (const [width, height] of [[390, 844], [844, 390]]) {
    canvasMetrics.width = width; canvasMetrics.height = height;
    projector.update(width, height); projector.pan(73, 91); frame.reset();
    chumBuilder.buildInto(frame.world);
    const rendered = frame.world.chumZones;
    assert(rendered.getAt(1).radiusX < rendered.getAt(0).radiusX,
      "G-072: a chum area already shrinks 1 m from the lower green-zone edge, before mid-water");
    assert(rendered.getAt(2).radiusY < rendered.getAt(1).radiusY,
      "G-072: ground-area height keeps shrinking immediately away from shore");
    castingBuilder.buildInto({ target: frame.casting, clipRegions: [], intent: { casting: {
      visible: true, zoneVisible: true, virtualBottomY: bounds.bottom, maxDistance: metric.pixelsPerMeter, mode: "rod",
      depthLimit: { visible: false } } } });
    projector.virtualToScreen(centerX, bounds.bottom, shore);
    const aim = frame.casting.aimingZone;
    assert(Math.abs(aim.lineY + aim.fillHeight - shore.y) < 1e-8,
      "the cast area starts at the lower green-zone edge after pan/rotation");
    assert(Math.abs(metric.metersFromShore((aim.lineY - shore.y) / projector.getScale() + bounds.bottom) - 1) < 1e-8,
      "the cast boundary and chum centre use the same metre from the green-zone shore");
  }
  const moved = { ...bounds, top: bounds.top + 170, bottom: bounds.bottom + 170 };
  metric = resolver.resolve(moved, map.distanceProfile);
  assert.equal(metric.metersFromShore(moved.bottom), 0, "moving the green zone moves its distance origin");
  assert(perspective.getPerspective(moved.bottom - 1).scale < perspective.getPerspective(moved.bottom).scale,
    "perspective starts at the edited lower green edge, independently of screen centre");
  metric = resolver.resolve(bounds, { ...map.distanceProfile, tiltDegrees: 30, maxMeters: 40 });
  frame.reset(); chumBuilder.buildInto(frame.world);
  const shoreArea = frame.world.chumZones.getAt(0);
  assert(Math.abs(shoreArea.radiusY / shoreArea.radiusX - .5) < 1e-8,
    "actual chum render geometry uses the 30-degree shore angle, independent of camera scale");
  const landingBuilder = new LandingAreaRenderFrameBuilder({ projector, getWaterMetric: () => metric,
    config: { ...CONFIG, locations: { ...CONFIG.locations, showCatchZone: true } },
    canvasMetrics, getRodScreenX: () => projector.virtualToScreen(centerX, bounds.bottom, shore).x,
    getNet: () => null, landingPolicyResolver: { resolve: () => ({ getLandingDistanceMeters: () => 1 }) } });
  landingBuilder.buildInto({ target: frame.fishing.fightAreas, bottom: bounds.bottom, debug: {}, equipment: {} });
  assert.equal(frame.fishing.fightAreas.catchZone.visible, true, "the tested landing area is visible");
  const landingRadius = frame.fishing.fightAreas.catchZone.radiusX / projector.getScale();
  assert(Math.abs(metric.distanceMeters(centerX, bounds.bottom, centerX + landingRadius, bounds.bottom) - 1) < 1e-8,
    "the actual landing area spans its physical metre after automatic projection zoom");
}

// The cast accuracy spread lives in map pixels: for the same target height on the map, the spread ellipse is the
// same with and without a distance profile (the owner keeps accuracy apart from perspective metres).
function checkAccuracyIndependentOfProfile() {
  const { CastPowerAim } = runtime.importModule("src/game/application/casting/cast_power_aim.js");
  const projector = {
    virtualToScreen: (x, y, out) => { out.x = x; out.y = y; return out; },
    screenToVirtual: (x, y, out) => { out.x = x; out.y = y; return out; },
    getScale: () => 1,
    getPerspective: (y) => ({ scale: 0.4 + y / 2000, squashY: 0.6 }),
  };
  const preview = (metric, maxDistance) => {
    const aim = new CastPowerAim({ config: { casting: { accuracyDistancePercent: 10 } }, projector,
      getWaterMetric: () => metric, getViewportSize: () => ({ width: 2560, height: 1440 }), rng: { next: () => 0.5 } });
    aim.update({ pointerDown: true, pointerStart: { x: 1280, y: 100 }, pointerCurrent: { x: 1280, y: 300 } }, null, 16);
    return aim.getAccuracyPreview({ left: 0, right: 2560, top: 520, bottom: 1160 }, maxDistance, 80, null, 1);
  };
  const curve = new WaterMetric({ ...LOCATION, maxMeters: 30, linearShare: 0.5 });
  const mapHeight = curve.virtualPixelsFromShore(750);
  const curved = preview(curve, 750);
  const flat = preview(new WaterMetric(LOCATION), mapHeight);
  assert(Math.abs(curved.radiusPx - mapHeight * 0.1 / 2) < 1e-9, "the spread is a share of the map height of the cast");
  for (const key of ["radiusPx", "radiusX", "radiusY", "x", "y"]) {
    assert(Math.abs(curved[key] - flat[key]) < 1e-9, `accuracy ${key} is the same with and without the profile`);
  }
}

function checkValidation() {
  for (const maxMeters of [0, -1, NaN, Infinity]) {
    assert.throws(() => new WaterMetric({ ...LOCATION, maxMeters }), /positive and finite/u,
      "non-positive or non-finite lengths are rejected");
  }
  assert.throws(() => new WaterMetric({ ...LOCATION, pixelsPerMeter: 0 }), /positive pixelsPerMeter/u);
  assert.throws(() => new WaterMetric({ ...LOCATION, shoreY: 500 }), /shore below the top edge/u);
  assert.throws(() => new WaterMetric({ ...LOCATION, maxMeters: 30, linearShare: 1 }), /linearShare/u);
  const uniformTop = new WaterMetric({ ...LOCATION, maxMeters: 12.8 });
  assert.equal(uniformTop.pixelsPerMeterY(520), 50, "maxMeters equal to the uniform distance keeps the base scale");
}

checkUniformMatchesPlainArithmetic();
checkPerspectiveCurve();
checkIndependentTiltAndLength();
checkLocationTilt();
checkBasePixels();
checkGroundPlane();
checkResolver();
checkTestLocationProfile();
checkPerspectiveStartsAtGreenZoneShore();
checkAccuracyIndependentOfProfile();
checkValidation();
console.log("Water metric passed: the uniform metric equals the plain pixelsPerMeter arithmetic (metres and base " +
  "pixels); the perspective curve keeps the base scale up to linearShare, joins without a kink, reaches maxMeters at " +
  "the top edge, inverts exactly and compresses lateral distances by the square root of the depth compression; base " +
  "pixels and the ground plane (positions, velocities) follow the curve and invert; the location resolver reuses its metric until bounds or the enabled profile change and keeps " +
  "the previous metric on an invalid live edit; independent angles/lengths fit automatically with exact endpoints, inverses and velocity Jacobians; the shipped 30-degree/30-m profile compresses cast/chum areas from the green-zone shore through pan/rotation and edited bounds; the cast accuracy spread stays in map pixels; invalid profiles are rejected.");
