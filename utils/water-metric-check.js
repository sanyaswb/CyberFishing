"use strict";

const assert = require("node:assert/strict");
const { SourceRuntime } = require("./testing/core/source_runtime");

const { WaterMetric } = new SourceRuntime().importModule("src/game/domain/locations/water_metric.js");

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
  }
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
checkValidation();
console.log("Water metric passed: the uniform metric equals the plain pixelsPerMeter arithmetic; the perspective curve " +
  "keeps the base scale up to linearShare, joins without a kink, reaches maxMeters at the top edge, inverts exactly " +
  "and compresses lateral distances by the square root of the depth compression; invalid profiles are rejected.");
