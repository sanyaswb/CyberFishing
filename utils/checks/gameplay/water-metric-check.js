"use strict";

const assert = require("node:assert/strict");
const { SourceRuntime } = require("../../testing/core/source_runtime");

const runtime = new SourceRuntime();
const { WaterMetric } = runtime.importModule("src/game/domain/locations/water_metric.js");
const { LocationWaterMetricResolver } = runtime.importModule(
  "src/game/domain/locations/location_water_metric_resolver.js");

// Test location: castable water 520..1160 virtual px, 50 px per metre (12.8 m uniform).
const LOCATION = Object.freeze({ pixelsPerMeter: 50, shoreY: 1160, topY: 520, centerX: 1280 });

// G-112: authored metres are exact, independent of artistic perspective and retired camera overrides.
for (const tiltDegrees of [17, 30, 53, 90]) for (const cameraDistanceMeters of [30, 900]) {
  const metric = new WaterMetric({ ...LOCATION, maxMeters: 30, tiltDegrees, farScale: .3, cameraDistanceMeters });
  assert.equal(metric.topMeters, 30, 'G-112: 30 m stays exactly 30 m after angle/camera edits');
  assert.equal(metric.yAtMeters(30), LOCATION.topY, 'G-112: the 30 m aim reaches the authored far edge');
}

// G-111/G-112: angle edits flatten surface markers without zooming X or changing metres.
function checkSimpleWaterProjection() {
  const point = {}, ground = {}, velocity = {}, restored = {}, shifted = {};
  const close = (a,b,message,tolerance=1e-7) => assert(Math.abs(a-b) <= tolerance * Math.max(1,Math.abs(b)),message);
  for (const tiltDegrees of [1,17,30,53,90]) for (const maxMeters of [.1,30,1000])
    for (const farScale of [.05,.3,1]) for (const lateralExpansion of [false,true]) {
    const metric = new WaterMetric({...LOCATION,maxMeters,tiltDegrees,farScale,lateralExpansion});
    assert.equal(metric.topMeters,maxMeters,'authored length is exact at every angle and far scale');
    assert.equal(metric.topY,LOCATION.topY,'full authored height is retained');
    assert.equal(metric.yAtMeters(maxMeters),LOCATION.topY,'far metres reach the upper edge');
    assert.equal(metric.pixelsPerMeterX(metric.shoreY),50,'near X keeps the original 50 px per metre');
    close(metric.surfaceScaleAt(metric.topY),farScale,'far size means exactly the chosen share of near size');
    close(metric.pixelsPerMeterY(metric.topY) / metric.pixelsPerMeterY(metric.shoreY),farScale,
      'far depth motion has the same configured compression');
    if(tiltDegrees===30)close(metric.surfaceSquashY,.5,'30 degrees gives half-height surface ellipses');
    if(tiltDegrees===90)assert.equal(metric.surfaceSquashY,1,'90 degrees makes surface areas circular');
    assert.equal(metric.pixelsPerMeter,50,'base engine/catalog units stay unchanged');
    for(const share of [-.1,0,.1,.5,.9,1,1.1]) {
      const depth=maxMeters*share;
      metric.toVirtual(2,depth,point);metric.toGround(point.x,point.y,ground);
      close(ground.x,2,'lateral inverse');close(ground.y,depth,'depth inverse');
      assert(Number.isFinite(point.x+point.y)&&metric.pixelsPerMeterY(point.y)>0&&metric.surfaceScaleAt(point.y)>0,
        'positive finite scales throughout and outside water');
      if(!lateralExpansion)assert.equal(metric.pixelsPerMeterX(point.y),50,'parallel grid never changes its X unit');
      if(share>0&&share<1) {
        metric.velocityFromBasePlane(point.x,point.y,30,-20,velocity);
        metric.velocityToBasePlane(point.x,point.y,velocity.x,velocity.y,restored);
        close(restored.x,30,'lateral velocity inverse');close(restored.y,-20,'depth velocity inverse');
        metric.toBasePlane(point.x,point.y,ground);
        const dt=1e-5;
        metric.fromBasePlane(ground.x+30*dt,ground.y-20*dt,shifted);
        metric.fromBasePlane(ground.x-30*dt,ground.y+20*dt,restored);
        close((shifted.x-restored.x)/(2*dt),velocity.x,'off-centre lateral derivative',1e-4);
        close((shifted.y-restored.y)/(2*dt),velocity.y,'depth derivative',1e-4);
      }
    }
  }
  const resolver=new LocationWaterMetricResolver({pixelsPerMeter:50});
  const bounds={left:0,right:2560,top:LOCATION.topY,bottom:LOCATION.shoreY};
  const profile={maxMeters:30,farScale:.3};
  const metric=resolver.resolve(bounds,profile,{tiltDegrees:30,cameraDistanceMeters:30});
  assert.equal(metric.lateralExpansion,false,'omitted grid-width settings default off');
  assert.equal(resolver.resolve(bounds,{...profile,linearShare:.9},{tiltDegrees:30,cameraDistanceMeters:900}),metric,
    'retired camera and legacy-only controls cannot alter the modern metric');
  const {CONFIG}=runtime.importModule('src/game/config/runtime/game_config.js');
  assert.equal(CONFIG.locations.map.test.distanceProfile.lateralExpansion,false,'reset/default grid width is off');
  assert.equal(CONFIG.locations.map.test.distanceProfile.farScale,.3,'the simple default is 30% at the far edge');
  const {CastingRenderFrameBuilder}=runtime.importModule('src/game/presentation/rendering/casting_render_frame_builder.js');
  const {GameRenderFrame}=runtime.importModule('src/game/presentation/rendering/game_render_frame.js');
  const projector={virtualToScreen:(x,y,out)=>{out.x=x;out.y=y;return out;},getScale:()=>1};
  const source={};
  for(const method of ['isAiming','getEquipment','getGameStateName','getCastDistance','getPowerAimVisual',
    'getAccuracyPreview','getBounds','getNow'])source[method]=()=>false;
  const builder=new CastingRenderFrameBuilder({projector,getWaterMetric:()=>metric,config:{},
    canvasMetrics:{width:2560,height:1440},hudStyleResolver:{resolveBarStyle:()=>({})},chumSource:source,labels:{}});
  const frame=new GameRenderFrame();
  for(const metres of [10,20,30]) {
    frame.reset();
    builder.buildInto({target:frame.casting,intent:{casting:{depthLimit:{visible:false},visible:true,zoneVisible:true,
      virtualBottomY:LOCATION.shoreY,maxDistance:metres*50,mode:'rod'}},clipRegions:[]});
    close(metric.metersFromShore(frame.casting.aimingZone.lineY),metres,
      'real 10/20/30 m aiming line agrees with calibrated metres');
  }
}
checkSimpleWaterProjection();

function checkGroundChumPersistence() {
  const { ChumService } = runtime.importModule("src/game/application/chum/chum_service.js");
  const metric = new WaterMetric({ ...LOCATION, maxMeters: 30, tiltDegrees: 45, farScale: .3 });
  const cacheData = new Map();
  const cache = { get: (key, fallback) => cacheData.has(key) ? JSON.parse(cacheData.get(key)) : fallback,
    set: (key, value) => cacheData.set(key, JSON.stringify(value)) };
  const config = { baits: { mix: { id: "mix", radius: 50, targetFishes: ["carp"], rampUpTimeMs: 1000,
    peakDurationMs: 1000, totalBonusTimeMs: 4000, minBonusDurationHours: .001, maxBonus: 2, minBonus: 1.2 } } };
  let now = 0;
  const services = { cache, now: () => now, rng: { next: () => .5 } };
  const point = {};
  const service = new ChumService("projection-test", config, () => metric, services);
  metric.toVirtual(2, 10, point); service.deployBait(point.x, point.y, "mix");
  service.update(1000, 1);
  assert.equal(service.getChumDataAt(point.x, point.y).bonus, 2, "the delivered centre receives the peak bonus");
  metric.toVirtual(2.1, 10, point); now = 1000; service.deployBait(point.x, point.y, "mix");
  assert.equal(service.getZones().length, 1, "nearby ground zones retain replacement behavior");
  const saved = cacheData.get("chum_active_projection-test");
  assert.deepEqual(Object.keys(JSON.parse(saved)[0]).sort(), ["baitId", "deployRealTimeMs", "id", "isDelivered", "x", "y"],
    "the existing save shape is unchanged");
  const reloaded = new ChumService("projection-test", config, () => metric, services);
  reloaded.update(2000, 1);
  assert.equal(reloaded.getChumDataAt(point.x, point.y).bonus, 2, "reload restores the same ground influence and timing");
  reloaded.saveToStorage(); assert.equal(cacheData.get("chum_active_projection-test"), saved, "reload/save preserves bytes");
  reloaded.update(9000, 1); assert.equal(reloaded.getZones().length, 0, "expiry still removes persisted zones");
  service.dispose(); reloaded.dispose();
}
checkGroundChumPersistence();

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

  const flatLateral = new WaterMetric({ ...LOCATION, maxMeters: 30, linearShare: 0.5, lateralExpansion: false });
  assert.equal(flatLateral.lateralExpansion, false);
  close(flatLateral.pixelsPerMeterX(520), 50, "without lateral expansion the far lateral scale stays 50 px/m");
  close(flatLateral.pixelsPerMeterX(1000), 50, "near lateral scale stays 50 px/m");
  const farFishFlat = { x: 0, y: 0 }, nearFishFlat = { x: 0, y: 0 };
  flatLateral.toVirtual(2, 25, farFishFlat);
  flatLateral.toVirtual(2, 2, nearFishFlat);
  close(farFishFlat.x - 1280, 100, "without lateral expansion 2 m sideways is always 100 virtual px");
  close(nearFishFlat.x - 1280, 100, "near and far lateral offsets match");
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

function checkGroundPlaneWithoutLateralExpansion() {
  const metric = new WaterMetric({ ...LOCATION, maxMeters: 30, linearShare: 0.5, lateralExpansion: false });
  const close = (actual, expected, message, epsilon) =>
    assert(Math.abs(actual - expected) <= epsilon, `${message}: expected ${expected}, received ${actual}`);
  const plane = { x: 0, y: 0 }, back = { x: 0, y: 0 }, velocity = { x: 0, y: 0 }, velocityBack = { x: 0, y: 0 };
  const shifted = { x: 0, y: 0 };
  for (const [x, y] of [[1280, 1160], [100, 1100], [2400, 900], [300, 700], [2000, 530], [1500, 450]]) {
    metric.toBasePlane(x, y, plane);
    close(metric.distanceBasePixels(1280, 1160, x, y), Math.hypot(plane.x - 1280, plane.y - 1160),
      `plane distance equals ground distance without lateral expansion at (${x}, ${y})`, 1e-7);
    metric.fromBasePlane(plane.x, plane.y, back);
    close(back.x, x, "fromBasePlane inverts toBasePlane without lateral expansion (x)", 1e-7);
    close(back.y, y, "fromBasePlane inverts toBasePlane without lateral expansion (y)", 1e-7);
    for (const [vx, vy] of [[120, 0], [0, -80], [-60, 45]]) {
      metric.velocityFromBasePlane(x, y, vx, vy, velocity);
      const h = 1e-4;
      metric.fromBasePlane(plane.x + vx * h, plane.y + vy * h, shifted);
      close(velocity.x, (shifted.x - x) / h, `velocity x is derivative without lateral expansion at (${x}, ${y})`, 1e-2);
      close(velocity.y, (shifted.y - y) / h, `velocity y is derivative without lateral expansion at (${x}, ${y})`, 1e-2);
      metric.velocityToBasePlane(x, y, velocity.x, velocity.y, velocityBack);
      close(velocityBack.x, vx, "velocityToBasePlane inverts velocityFromBasePlane without lateral expansion (x)", 1e-9);
      close(velocityBack.y, vy, "velocityToBasePlane inverts velocityFromBasePlane without lateral expansion (y)", 1e-9);
    }
  }
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
  profile.lateralExpansion = false;
  const noLateral = resolver.resolve(bounds, profile);
  assert.notEqual(noLateral, edited, "toggling lateralExpansion rebuilds the metric");
  assert.equal(noLateral.lateralExpansion, false);
  assert.equal(noLateral.pixelsPerMeterX(520), 50);
  profile.lateralExpansion = true;
  const withLateral = resolver.resolve(bounds, profile);
  assert.notEqual(withLateral, noLateral, "re-enabling lateralExpansion rebuilds the metric");
  assert.equal(withLateral.lateralExpansion, true);
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
  const resolver = new LocationWaterMetricResolver({ pixelsPerMeter: CONFIG.physics.simulation.pixelsPerMeter });
  const metric = resolver.resolve(bounds, map.distanceProfile, map.perspective);
  assert.equal(metric.tiltDegrees, map.perspective.tiltDegrees, "the shipped location actually composes its camera profile");
  assert.equal(metric.topY, bounds.top, "the shipped camera never crops the green zone");
  assert.equal(metric.shoreY, bounds.bottom);
  assert.equal(metric.topMeters, map.distanceProfile.maxMeters, "the production 30 m stays exactly 30 m");
  const overhead = resolver.resolve(bounds, map.distanceProfile, { ...map.perspective, tiltDegrees: 90 });
  assert(Math.abs(overhead.topMeters - map.distanceProfile.maxMeters) < 1e-9,
    "angle edits preserve the authored length");
  assert.equal(metric.pixelsPerMeterX(bounds.bottom), overhead.pixelsPerMeterX(bounds.bottom),
    "the production tilt preserves reference width");
}

// G-112: actual illustrated chum containment and calibrated landing range through each viewport.
function checkUnifiedWaterAreas() {
  const { CONFIG } = runtime.importModule("src/game/config/runtime/game_config.js");
  const { WorldPerspective } = runtime.importModule("src/game/domain/locations/world_perspective.js");
  const { ViewportProjector } = runtime.importModule("src/game/application/viewport/viewport_projector.js");
  const { BoatChumRenderFrameBuilder } = runtime.importModule("src/game/presentation/rendering/boat_chum_render_frame_builder.js");
  const { GameRenderFrame } = runtime.importModule("src/game/presentation/rendering/game_render_frame.js");
  const { ChumZone } = runtime.importModule("src/game/application/chum/chum_zone.js");
  const { LandingAreaRenderFrameBuilder } = runtime.importModule("src/game/presentation/rendering/landing_area_render_frame_builder.js");
  const { WorldRenderFrameBuilder } = runtime.importModule("src/game/presentation/rendering/world_render_frame_builder.js");
  const { GameWorld } = runtime.importModule("src/game/application/world/game_world.js");
  const resolver = new LocationWaterMetricResolver({ pixelsPerMeter: 50 });
  const bounds = { left: 0, right: 2560, top: 520, bottom: 1160 };
  const profile = { maxMeters: 30, farScale: .3, lateralExpansion: true };
  let camera = { tiltDegrees: 90 };
  const getWaterMetric = () => resolver.resolve(bounds, profile, camera);
  const perspective = new WorldPerspective({ getWaterMetric });
  const projector = new ViewportProjector(CONFIG.locations, "test", y => perspective.getPerspective(y));
  const stableWidths = new Map();
  const metricPoint = {}, screenPoint = { set(x, y) { this.x = x; this.y = y; return this; } };
  const zones = [];
  const chum = { getZones: () => zones, getBoats: () => [] };
  const builder = new BoatChumRenderFrameBuilder({ projector, config: CONFIG, chum, getWaterMetric });
  const frame = new GameRenderFrame();
  const rodPoint = { set(x, y) { this.x = x; this.y = y; return this; } };
  const landing = new LandingAreaRenderFrameBuilder({ projector, getWaterMetric,
    config: { ...CONFIG, locations: { ...CONFIG.locations, showCatchZone: true } },
    canvasMetrics: { width: 1000, height: 1000 }, getNet: () => null,
    getRodScreenX: () => projector.virtualToScreen(1500, bounds.bottom, rodPoint).x,
    landingPolicyResolver: { resolve: () => ({ getLandingDistanceMeters: () => 1 }) } });
  for (const lateralExpansion of [false, true]) for (const tiltDegrees of [17, 53, 90, 1, 45]) {
    profile.lateralExpansion = lateralExpansion;
    camera = { ...camera, tiltDegrees };
    const metric = getWaterMetric();
    const waterCell = { isCastable: true, hasCollision: false };
    const map = { currentLocationId: "test", getCastableBoundsVirtual: () => bounds,
      getCellAtVirtualPos: (_x, y) => y >= bounds.top && y <= bounds.bottom ? waterCell : null, getBackgroundRenderData: () => ({ loaded: false }) };
    const config = { ...CONFIG, locations: { ...CONFIG.locations, lockZoneXToScreen: false,
      map: { test: { ...CONFIG.locations.map.test, distanceProfile: profile, perspective: camera } } } };
    const world = new GameWorld({ map, projector, locationConfig: config.locations, waterMetricResolver: resolver,
      canvasMetrics: { width: 1000, height: 1000 } });
    assert.equal(world.getWaterMetric(), metric, "runtime, visual projection and clipping retain one metric instance");
    assert.equal(world.getDynamicBounds().top, metric.topY, "casting bounds retain the fixed authored water edge");
    assert.equal(world.checkWater(1280, metric.topY + .01), waterCell);
    assert.equal(world.checkWater(1280, metric.topY - .01), null,
      "points above the fixed castable zone remain unavailable to physics");
    const worldBuilder = new WorldRenderFrameBuilder({ map, projector, config, getWaterMetric,
      canvasMetrics: { width: 1000, height: 1000 }, locationId: "test", boatChumBuilder: builder });
    assert.equal(getWaterMetric(), metric, "unchanged projection reuses the exact runtime metric");
    zones.length = 0;
    for (const share of [.1, .5, .9]) {
      const depth = metric.topMeters * share;
      metric.toVirtual(3, depth, metricPoint);
      const zone = new ChumZone(depth, metricPoint.x, metricPoint.y,
        { id: "test", radius: 50, minBonus: 1, maxBonus: 2, targetFishes: ["carp"] }, 0, true);
      zone.currentBonus = 2; zones.push(zone);
      assert.equal(zone.getMultiplierAt(zone.x, zone.y, "pike", metric), 1, "species filtering stays intact");
      assert.equal(zone.getMultiplierAt(zone.x, zone.y, null, metric), 2, "centre always receives the bonus");
    }
    for (const [width, height] of [[390, 844], [844, 390]]) {
      projector.update(width, height); projector.pan(73, 91); frame.reset(); builder.buildInto(frame.world);
      for (let i = 0; i < zones.length; i++) {
        const rendered = frame.world.chumZones.getAt(i), source = zones[i];
        assert.equal(rendered.pointCount,0,'modern areas use the existing allocation-free ellipse record');
        for(const angle of [0,Math.PI/4,Math.PI/2,Math.PI]) for(const fraction of [.99,1.01]) {
          projector.screenToVirtual(rendered.x+Math.cos(angle)*rendered.radiusX*fraction,
            rendered.y+Math.sin(angle)*rendered.radiusY*fraction,screenPoint);
          assert.equal(source.getMultiplierAt(screenPoint.x,screenPoint.y,'carp',metric),fraction<1?2:1,
            'near/far/off-centre rendered ellipses and actual chum bonus have the same boundary');
        }
        const widthKey=width+'/'+height+'/'+i;
        if(!stableWidths.has(widthKey))stableWidths.set(widthKey,rendered.radiusX);
        assert(Math.abs(rendered.radiusX-stableWidths.get(widthKey))<1e-7,
          'tilt and grid width do not zoom an existing surface marker');
        if(tiltDegrees===90)assert.equal(rendered.radiusX,rendered.radiusY,'90-degree areas are circular');
      }
      const record=frame.world.chumZones.getAt(0);
      frame.reset();builder.buildInto(frame.world);
      assert.equal(frame.world.chumZones.getAt(0),record,'unchanged areas reuse their frame record');
      landing.buildInto({ target: frame.fishing.fightAreas, bottom: bounds.bottom, debug: {}, equipment: {} });
      const catchZone = frame.fishing.fightAreas.catchZone;
      assert.equal(catchZone.kind, "polygon");
      for (let j = 0; j < catchZone.pointCount; j++) {
        projector.screenToVirtual(catchZone.points[j*2], catchZone.points[j*2+1], screenPoint);
        assert(Math.abs(metric.distanceBasePixels(1500, bounds.bottom, screenPoint.x, screenPoint.y) - 50) < 1e-7,
          "landing contours continue to show actual ground range, including off-centre shear");
      }
      frame.reset(); worldBuilder.buildInto({ target: frame.world });
      const region = frame.world.clipRegions.getAt(0);
      assert(Math.abs(region.height / projector.getScale() - (bounds.bottom - bounds.top)) < 1e-8,
        "water animation/clipping always spans the full castable height");
      projector.screenToVirtual(region.x, region.y, screenPoint);
      assert(Math.abs(metric.metersFromShore(screenPoint.y) - metric.topMeters) < 1e-7,
        "render/wave clipping and gameplay bounds agree on the visible far distance");
    }
    const original = zones[0];
    const other=new ChumZone('other',original.x+metric.surfaceScaleAt(original.y)*20,original.y,{radius:50},0,true);
    assert(original.checkOverlap(other,metric)&&other.checkOverlap(original,metric),'surface overlap is symmetric');
    original.isExpired = true;
    assert.equal(original.getMultiplierAt(original.x, original.y, null, metric), 1);
    original.isExpired = false; original.isDelivered = false;
    assert.equal(original.getMultiplierAt(original.x, original.y, null, metric), 1);
  }
  const before=getWaterMetric(); profile.farScale=.6;
  assert.notEqual(getWaterMetric(),before,"far scale edits invalidate the shared metric");
  const last = getWaterMetric(); camera = { ...camera, tiltDegrees: 0 };
  assert.equal(getWaterMetric(), last, "invalid live camera edits retain the previous metric");
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
  for (const tiltDegrees of [0, -1, 91, Infinity, NaN]) {
    assert.throws(() => new WaterMetric({ ...LOCATION, maxMeters: 30, tiltDegrees }), /tiltDegrees/u);
  }
  for (const farScale of [0, .01, -1, 1.1, Infinity, NaN]) {
    assert.throws(() => new WaterMetric({ ...LOCATION, maxMeters:30, tiltDegrees:30, farScale }), /farScale/u);
  }
  assert.throws(() => new WaterMetric({ ...LOCATION, maxMeters: 10 }), /below the uniform 12.80 m/u,
    "a maxMeters below the uniform distance is rejected");
  assert.throws(() => new WaterMetric({ ...LOCATION, pixelsPerMeter: 0 }), /positive pixelsPerMeter/u);
  assert.throws(() => new WaterMetric({ ...LOCATION, shoreY: 500 }), /shore below the top edge/u);
  assert.throws(() => new WaterMetric({ ...LOCATION, maxMeters: 30, linearShare: 1 }), /linearShare/u);
  assert.throws(() => new WaterMetric({ ...LOCATION, pixelsPerMeter: Infinity }), /positive pixelsPerMeter/u);
  assert.throws(() => new WaterMetric({ ...LOCATION, shoreY: Infinity }), /shore below the top edge/u);
  assert.throws(() => new WaterMetric({ ...LOCATION, maxMeters: Infinity }), /positive and finite/u);
  const uniformTop = new WaterMetric({ ...LOCATION, maxMeters: 12.8 });
  assert.equal(uniformTop.pixelsPerMeterY(520), 50, "maxMeters equal to the uniform distance keeps the base scale");
}

checkUniformMatchesPlainArithmetic();
checkPerspectiveCurve();
checkBasePixels();
checkGroundPlane();
checkGroundPlaneWithoutLateralExpansion();
checkResolver();
checkTestLocationProfile();
checkUnifiedWaterAreas();
checkAccuracyIndependentOfProfile();
checkValidation();
console.log("Water metric passed: exact authored metres/aiming, simple tilt/far scale, matching surface ellipse bonuses, full bounds, inverses/velocities, save timing and buffer reuse; legacy contracts preserved.");
