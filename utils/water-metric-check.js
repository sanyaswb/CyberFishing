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
    assert(Object.is(metric.lateralVirtualPixels(basePixels, y1), basePixels), "uniform lateral base pixels are 1:1");
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
  close(metric.lateralVirtualPixels(100, 1000), 100, "near the shore lateral base pixels stay 1:1");
  close(metric.lateralVirtualPixels(100, 520), 100 * metric.pixelsPerMeterX(520) / 50,
    "far away lateral base pixels shrink with the lateral scale");
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
  profile.maxMeters = 10;
  assert.equal(resolver.resolve(bounds, profile), edited, "an invalid live edit keeps the previous metric");
  assert.equal(resolver.resolve(bounds, profile), edited, "the rejected input is not rebuilt every frame");
  assert(errors.length === 1 && /below the uniform 12.80 m/u.test(errors[0]), "the rejection is logged once");
  profile.maxMeters = 30;
  assert.notEqual(resolver.resolve(bounds, profile), edited, "a valid edit after a rejection applies again");
  assert.notEqual(resolver.resolve({ ...bounds, top: 600 }, profile), edited, "changed bounds rebuild the metric");
  assert.throws(() => new LocationWaterMetricResolver({ pixelsPerMeter: 50, logger: null })
    .resolve(bounds, { enabled: true, linearShare: 0.5, maxMeters: 10 }), /below the uniform/u,
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
  assert(Math.abs(metric.topMeters - map.distanceProfile.maxMeters) < 1e-9,
    "the far edge of the test location lies at maxMeters");
  assert(Math.abs(metric.metersFromShore(bounds.bottom - (bounds.bottom - bounds.top) * map.distanceProfile.linearShare) -
    (bounds.bottom - bounds.top) * map.distanceProfile.linearShare / CONFIG.physics.simulation.pixelsPerMeter) < 1e-9,
  "the near share of the test location keeps the base scale");
}

function checkValidation() {
  assert.throws(() => new WaterMetric({ ...LOCATION, maxMeters: 10 }), /below the uniform 12.80 m/u,
    "a maxMeters below the uniform distance is rejected");
  assert.throws(() => new WaterMetric({ ...LOCATION, pixelsPerMeter: 0 }), /positive pixelsPerMeter/u);
  assert.throws(() => new WaterMetric({ ...LOCATION, shoreY: 500 }), /shore below the top edge/u);
  assert.throws(() => new WaterMetric({ ...LOCATION, maxMeters: 30, linearShare: 1 }), /linearShare/u);
  const uniformTop = new WaterMetric({ ...LOCATION, maxMeters: 12.8 });
  assert.equal(uniformTop.pixelsPerMeterY(520), 50, "maxMeters equal to the uniform distance keeps the base scale");
}

checkUniformMatchesPlainArithmetic();
checkPerspectiveCurve();
checkBasePixels();
checkGroundPlane();
checkResolver();
checkTestLocationProfile();
checkValidation();
console.log("Water metric passed: the uniform metric equals the plain pixelsPerMeter arithmetic (metres and base " +
  "pixels); the perspective curve keeps the base scale up to linearShare, joins without a kink, reaches maxMeters at " +
  "the top edge, inverts exactly and compresses lateral distances by the square root of the depth compression; base " +
  "pixels and the ground plane (positions, velocities) follow the curve and invert; the location resolver reuses its metric until bounds or the enabled profile change and keeps " +
  "the previous metric on an invalid live edit; the test location reaches maxMeters at its far edge; invalid profiles are rejected.");
