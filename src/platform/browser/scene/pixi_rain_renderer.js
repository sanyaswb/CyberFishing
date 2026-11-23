// Spec 172 D4 (TK-271): procedural rain on the WebGL scene, iteration 1.
// - Drops: streaks from a texture generated once. Each drop first picks where it lands, then falls to that point at the
//   wind's slant. TK-273: where it lands is inside the rain zones on screen (world.rainRegions, drawn in the zone
//   editor; a zone is picked by its visible area), and the drops are clipped to those zones by a mask, so it rains only
//   there; with the rain zones' switch off (world.rainZoned false) the drops land anywhere from the far edge of the
//   water down to the bottom of the screen, unclipped. Its size, length and
//   speed follow the water's perspective at the landing point (WaterMetric.surfaceScaleAt), so far drops are smaller and
//   slower. The number of falling drops follows the rain's and the storm's intensity (world.weather).
// - Impacts: a drop that lands inside a castable zone (world.clipRegions, the water) leaves a ring that widens and
//   fades on the surface, and a ripple in the water's picture (waterRipples, read by PixiWaterRenderer like the boat's
//   wake, spec 156). Drops landing on land vanish (splashes on hard ground: iteration 2).
// - TK-271.2: drops and rings belong to the world. Their landing points are kept as shares of the location's background
//   (world.backgroundLayers[0]; the screen without one) and placed on screen every frame, so a camera move or a resized
//   window carries them with the location. maxDrops is the rain over the whole rain area (the rain zones, or the
//   background below the water's far edge without zones) at strength 1; the screen shows the share of it that is visible,
//   so a narrower window shows fewer drops at the same density instead of squeezing them all in.
// Spec 180 (TK-326): `settings` is the rain's look already resolved at the rain's strength (WeatherLookResolver: the
// count, length, width, speed, depth and spreads between their ends at 0 and 100); `weatherSettings` is
// CONFIG.weather — the storm's share of extra drops and its slant (storm), the wind's slant, its gust share and how fast
// the slant follows (wind). Each drop gets its own length (± lengthJitter), slant (± slantJitterDeg) and speed
// (± speedJitter); a faster drop is longer by speedStretch.
// Drawing (docs/rendering.md 16, 22, 23): two ParticleContainers, one texture each, no filter: the rings right over the
// water (mountSurface), the drops in front of the tackle (mountAir). Fixed pools sized by the settings (they grow only
// when the settings grow); unused particles have alpha 0. Pixi 8 uploads vertex (scale), rotation and color (tint,
// alpha) only when declared dynamic (ParticleBuffer.update), so they are. The scene presents a frame only while a drop
// or a ring is alive.
import { clampUnit, finiteOr } from "../../../engine/math/number_normalization.js";
import { effectOfPair } from "../../../engine/math/strength_value.js";
import { regionsBounds } from "../../../engine/math/rectangle_bounds.js";
import { BackgroundPlacement } from "./background_placement.js";
import { mixColor, SceneColor } from "./scene_color.js";
import { ScreenZoneSet } from "./screen_zone_set.js";
import { ZoneRectMask } from "./zone_rect_mask.js";

const NO_REGIONS = Object.freeze({ count: 0, getAt: () => null });
const STREAK_WIDTH = 4;
const STREAK_HEIGHT = 64;
const RING_SIZE = 64;
const MAX_STEP_SEC = 0.1;
const MAX_SLANT_DEG = 72;
const DYNAMIC = Object.freeze({ position: true, vertex: true, rotation: true, color: true, uvs: false });

// Spec 179: a straight RGB mix of two 0xRRGGBB colours (share 0 → a, 1 → b).

export class PixiRainRenderer {
  #pixi;
  #random;
  #streak;
  #ring;
  #air;
  #surface;
  #drops = [];
  #rings = [];
  // Per drop: landing point (shares of the background, TK-271.2), perspective scale, age and life (s), whether it falls.
  #dropU = new Float32Array(0);
  #dropV = new Float32Array(0);
  #dropScale = new Float32Array(0);
  #dropAge = new Float32Array(0);
  #dropLife = new Float32Array(0);
  #dropActive = new Uint8Array(0);
  // Spec 180 D16: each drop's own length factor and slant offset (radians).
  #dropLength = new Float32Array(0);
  #dropSlant = new Float32Array(0);
  #ringRecords = [];
  #ringCount = 0;
  #waterRipples = Object.freeze({ owner: this, get count() { return this.owner.#ringCount; },
    getAt(index) { return this.owner.#ringRecords[index]; } });
  #rippleView = { puffs: this.#waterRipples, settings: null };
  #area = { left: 0, top: 0, right: 0, bottom: 0 };
  // TK-271.2: this frame's world -> screen placement (screen = origin + share x size).
  #view = new BackgroundPlacement();
  #lastNow = null;
  #slantDeg = 0;
  #falling = 0;
  #visible = false;
  #stepMs = 0;
  #dropColor = new SceneColor();
  #ringColor = new SceneColor();
  #emissionDropColor = new SceneColor();
  #emissionRingColor = new SceneColor();
  #dropTint = 0xffffff;
  #ringTint = 0xffffff;
  // TK-273, TK-358: the rain area on screen (the rain zones, or the background below the water) and the drops' mask.
  #zones = new ScreenZoneSet();
  #mask;
  #point = { x: 0, y: 0 };

  // documentTarget: makes the textures' canvases; random: () => 0…1 (the drops' places and timing; visual only).
  constructor({ pixi, documentTarget, random = Math.random }) {
    if (typeof pixi?.ParticleContainer !== "function" || typeof pixi?.Particle !== "function") {
      throw new TypeError("PixiRainRenderer requires pixi.ParticleContainer and pixi.Particle");
    }
    if (typeof random !== "function") throw new TypeError("PixiRainRenderer requires random");
    this.#pixi = pixi;
    this.#random = random;
    this.#streak = pixi.Texture.from(PixiRainRenderer.#drawStreak(documentTarget), true);
    this.#ring = pixi.Texture.from(PixiRainRenderer.#drawRing(documentTarget), true);
    this.#air = new pixi.ParticleContainer({ texture: this.#streak, dynamicProperties: DYNAMIC });
    this.#surface = new pixi.ParticleContainer({ texture: this.#ring, dynamicProperties: DYNAMIC });
    this.#air.visible = false;
    this.#surface.visible = false;
    this.#mask = new ZoneRectMask({ pixi, target: this.#air });
  }

  // The rings go on the water: mounted right after it, under the tackle.
  mountSurface(stage) {
    stage.addChild(this.#surface);
  }

  // The drops go in front of the tackle: mounted after it.
  // Its zone mask lives in the scene for its transform (Pixi does not draw a mask itself).
  mountAir(stage) {
    stage.addChild(this.#air);
    this.#mask.mount(stage);
  }

  // For PixiWaterRenderer: the rings as ripple puffs ({ count, getAt(i) → { x, y, size, life } }) and their settings
  // (CONFIG.canvas.rain.rings.ripple), or null while there are none.
  get waterRipples() {
    return this.#ringCount > 0 && this.#rippleView.settings ? this.#rippleView : null;
  }

  // For DEV: whether it rains on the scene, falling drops, live rings, pools, the slant and the last update's time.
  get status() {
    return { active: this.#visible, drops: this.#falling, rings: this.#ringCount, dropPool: this.#drops.length,
      ringPool: this.#rings.length, slantDeg: this.#slantDeg, stepMs: this.#stepMs };
  }

  // world: the frame's world model (null: not on the scene); viewWidth / viewHeight: the logical screen; nowMs: the
  // frame's clock; settings: the rain's resolved look; weatherSettings: CONFIG.weather ({ storm, wind }). Returns whether
  // the scene must present a frame.
  update(world, viewWidth, viewHeight, nowMs, settings, weatherSettings = null) {
    const elapsed = this.#lastNow === null ? 0 : Math.min(MAX_STEP_SEC, Math.max(0, (nowMs - this.#lastNow) / 1000));
    this.#lastNow = nowMs;
    // Off the scene or switched off: no drop keeps falling.
    if (!world || settings?.enabled !== true) { this.#clear(); return this.#hide(); }
    const weather = world.weather;
    const rain = clampUnit(finiteOr(weather?.rain, 0));
    const storm = clampUnit(finiteOr(weather?.storm, 0));
    const stormSettings = weatherSettings?.storm;
    const windSettings = weatherSettings?.wind;
    const maxDrops = Math.max(0, Math.floor(finiteOr(settings?.maxDrops, 0)));
    const dropCap = Math.max(maxDrops, Math.floor(finiteOr(settings?.maxDropsCap, maxDrops)));
    // Spec 187 D7: the storm's extra drops [від, до] by its strength (none with no storm); the pool holds the larger end.
    const dropsShare = stormSettings?.rainDropsShare;
    const stormShare = Math.max(0, effectOfPair(dropsShare, 0, storm));
    const stormShareCap = Array.isArray(dropsShare) ? Math.max(0, finiteOr(dropsShare[0], 0), finiteOr(dropsShare[1], 0)) : 0;
    // Spec 180 D1: drops come only from rain; a storm thickens the rain that falls (a storm without rain has no drops).
    const strength = rain > 0 ? 1 + stormShare : 0;
    if (strength <= 0 && this.#falling === 0 && this.#ringCount === 0) return this.#hide();
    const started = performance.now();
    const rings = settings?.rings;
    this.#ensurePools(Math.floor(dropCap * (1 + stormShareCap)), Math.max(0, Math.floor(finiteOr(rings?.maxRings, 0))));
    this.#rippleView.settings = rings?.ripple ?? null;
    // Spec 179 D4: an emission turns the rain red (its colours, mixed with the emission's intensity).
    const emission = clampUnit(finiteOr(weather?.emission, 0));
    this.#dropTint = mixColor(this.#dropColor.read(settings?.color),
      this.#emissionDropColor.read(settings?.emissionColor ?? settings?.color), emission);
    this.#ringTint = mixColor(this.#ringColor.read(rings?.color),
      this.#emissionRingColor.read(rings?.emissionColor ?? rings?.color), emission);
    const windDir = Math.max(-1, Math.min(1, finiteOr(weather?.windDirection, 0)));
    const rawWindStrength = weather?.windStrength;
    const windStrength = rawWindStrength !== undefined && rawWindStrength !== null && Number.isFinite(Number(rawWindStrength))
      ? clampUnit(Number(rawWindStrength))
      : Math.abs(windDir);
    const windGust = clampUnit(finiteOr(weather?.windGust, 0));
    const windSlant = Math.max(0, finiteOr(windSettings?.rainSlantDeg, 0));
    const stormSlant = Math.max(0, effectOfPair(stormSettings?.rainSlantDeg, 0, storm));
    const gustShare = Math.max(0, finiteOr(windSettings?.gustSlantShare, 1.2));
    const rawSlant = (windStrength + windGust * gustShare) * windSlant + stormSlant;
    const targetSlant = windDir * Math.min(MAX_SLANT_DEG, rawSlant);
    const followPerSec = Math.max(0, finiteOr(windSettings?.slantFollowPerSec, 2)) +
      Math.min(1, windGust * 3) * Math.max(0, finiteOr(windSettings?.gustFollowPerSec, 6));
    this.#slantDeg += (targetSlant - this.#slantDeg) * Math.min(1, elapsed * followPerSec);
    const area = regionsBounds(world.clipRegions, this.#area);
    this.#view.place(world, viewWidth, viewHeight);
    this.#prepareZones(world, area, viewWidth, viewHeight);
    // TK-271.2: the visible share of the whole rain area's drops (none on screen: no new drop; falling ones finish).
    const zones = this.#zones;
    const visibleShare = zones.wholeArea > 0 ? Math.min(1, zones.visibleArea / zones.wholeArea) : 0;
    const spawning = Math.min(Math.floor(dropCap * (1 + stormShareCap)), Math.round(maxDrops * strength * visibleShare));
    // Drops first: the rings their impacts leave this frame are drawn in this frame.
    this.#updateDrops(elapsed, spawning, settings, world, area, viewWidth, viewHeight);
    this.#updateRings(elapsed, rings);
    this.#visible = true;
    this.#air.visible = true;
    this.#surface.visible = this.#ringCount > 0;
    this.#stepMs = performance.now() - started;
    return true;
  }

  // The containers go with the scene's stage (Application.destroy with children); the generated textures are ours.
  dispose() {
    this.#streak.destroy(true);
    this.#ring.destroy(true);
  }

  #clear() {
    this.#dropActive.fill(0);
    this.#falling = 0;
    this.#ringCount = 0;
    for (let index = 0; index < this.#rings.length; index += 1) this.#rings[index].alpha = 0;
  }

  #hide() {
    if (!this.#visible) return false;
    this.#visible = false;
    this.#air.visible = false;
    this.#surface.visible = false;
    for (let index = 0; index < this.#drops.length; index += 1) this.#drops[index].alpha = 0;
    return true;
  }

  #updateDrops(elapsed, target, settings, world, area, viewWidth, viewHeight) {
    const fall = Math.max(1, finiteOr(settings?.fallPx, 500));
    const speed = Math.max(1, finiteOr(settings?.speedPx, 1500));
    const jitter = clampUnit(finiteOr(settings?.speedJitter, 0.15));
    const length = Math.max(0, finiteOr(settings?.lengthPx, 36));
    const width = Math.max(0, finiteOr(settings?.widthPx, 1.6));
    const opacity = clampUnit(finiteOr(settings?.opacity, 0.4));
    const minScale = clampUnit(finiteOr(settings?.minScale, 0.3));
    const lengthJitter = clampUnit(finiteOr(settings?.lengthJitter, 0));
    const slantJitter = Math.max(0, finiteOr(settings?.slantJitterDeg, 0)) * Math.PI / 180;
    const stretch = Math.max(0, finiteOr(settings?.speedStretch, 0));
    const meanLife = fall / speed;
    const baseAngle = this.#slantDeg * Math.PI / 180;
    let falling = 0;
    for (let index = 0; index < this.#drops.length; index += 1) {
      const particle = this.#drops[index];
      if (!this.#dropActive[index]) {
        if (index >= target) { particle.alpha = 0; continue; }
        // A new drop starts somewhere along its fall, so a rising rain does not arrive in one wave.
        this.#spawnDrop(index, world, area, viewWidth, viewHeight, minScale, fall, speed, jitter, lengthJitter, slantJitter);
        this.#dropAge[index] = this.#random() * this.#dropLife[index];
      } else {
        this.#dropAge[index] += elapsed;
        if (this.#dropAge[index] >= this.#dropLife[index]) {
          this.#impact(index, world);
          if (index >= target) { this.#dropActive[index] = 0; particle.alpha = 0; continue; }
          this.#spawnDrop(index, world, area, viewWidth, viewHeight, minScale, fall, speed, jitter, lengthJitter, slantJitter);
        }
      }
      const scale = this.#dropScale[index];
      const left = 1 - this.#dropAge[index] / this.#dropLife[index];
      const distance = left * fall * scale;
      const slant = Math.tan(baseAngle + this.#dropSlant[index]);
      // A faster drop (shorter life than the mean) is longer by speedStretch.
      const speedRatio = meanLife / Math.max(1e-6, this.#dropLife[index]);
      const dropLength = length * this.#dropLength[index] * (1 + stretch * (speedRatio - 1));
      particle.x = this.#view.screenX(this.#dropU[index]) - distance * slant;
      particle.y = this.#view.screenY(this.#dropV[index]) - distance;
      particle.rotation = -Math.atan(slant);
      particle.scaleX = width * scale / STREAK_WIDTH;
      particle.scaleY = Math.max(0, dropLength) * scale / STREAK_HEIGHT;
      particle.alpha = opacity * (0.55 + 0.45 * scale);
      particle.tint = this.#dropTint;
      falling += 1;
    }
    this.#falling = falling;
  }

  #spawnDrop(index, world, area, viewWidth, viewHeight, minScale, fall, speed, jitter, lengthJitter = 0, slantJitter = 0) {
    // A visible part of the rain area by its size, then a point inside it, kept as shares of the background.
    const point = this.#point;
    this.#zones.pick(this.#random, point);
    this.#dropU[index] = this.#view.shareX(point.x);
    this.#dropV[index] = this.#view.shareY(point.y);
    this.#dropScale[index] = this.#scaleAt(point.y, world, area, minScale, viewHeight);
    this.#dropLife[index] = (fall / speed) * (1 + (this.#random() * 2 - 1) * jitter);
    this.#dropLength[index] = 1 + (this.#random() * 2 - 1) * lengthJitter;
    this.#dropSlant[index] = (this.#random() * 2 - 1) * slantJitter;
    this.#dropAge[index] = 0;
    this.#dropActive[index] = 1;
  }

  // The surface size at a screen y: the water metric between the water's far and near edges (extended past them), or a
  // straight ramp down the screen without a metric; never under minScale.
  #scaleAt(y, world, area, minScale, viewHeight) {
    const plane = world?.waterPlane;
    const metric = plane?.metric;
    if (metric && area && area.bottom > area.top) {
      const share = Math.max(0, (y - area.top) / (area.bottom - area.top));
      const mapY = Math.min(plane.bottom, plane.top + share * (plane.bottom - plane.top));
      return Math.max(minScale, Math.min(1, metric.surfaceScaleAt(mapY)));
    }
    return Math.max(minScale, Math.min(1, minScale + (1 - minScale) * (viewHeight > 0 ? y / viewHeight : 1)));
  }

  // A drop that reaches water leaves a ring (and a ripple through waterRipples).
  #impact(index, world) {
    const regions = world?.clipRegions;
    if (!regions || this.#ringCount >= this.#rings.length) return;
    const x = this.#view.screenX(this.#dropU[index]), y = this.#view.screenY(this.#dropV[index]);
    let water = false;
    for (let region = 0; region < regions.count && !water; region += 1) {
      const rect = regions.getAt(region);
      water = x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
    }
    if (!water) return;
    const record = this.#ringRecords[this.#ringCount];
    record.u = this.#dropU[index];
    record.v = this.#dropV[index];
    record.x = x;
    record.y = y;
    record.scale = this.#dropScale[index];
    record.age = 0;
    record.life = 0;
    this.#ringCount += 1;
  }

  // Rings widen and fade over lifeSec; finished ones are swapped out of the live range.
  #updateRings(elapsed, settings) {
    const lifeSec = Math.max(0.05, finiteOr(settings?.lifeSec, 0.7));
    const size = Math.max(0, finiteOr(settings?.sizePx, 16));
    const opacity = clampUnit(finiteOr(settings?.opacity, 0.4));
    const flatten = clampUnit(finiteOr(settings?.flatten, 0.35));
    const show = settings?.enabled === true;
    let index = 0;
    while (index < this.#ringCount) {
      const record = this.#ringRecords[index];
      record.age += elapsed;
      if (record.age >= lifeSec) {
        this.#ringCount -= 1;
        const last = this.#ringRecords[this.#ringCount];
        this.#ringRecords[this.#ringCount] = record;
        this.#ringRecords[index] = last;
        continue;
      }
      record.life = record.age / lifeSec;
      const diameter = size * record.scale * (0.3 + 0.7 * record.life);
      record.size = diameter;
      // TK-271.2: the ring stays where it fell on the water; the water's ripples read the same screen point.
      record.x = this.#view.screenX(record.u);
      record.y = this.#view.screenY(record.v);
      const particle = this.#rings[index];
      particle.x = record.x;
      particle.y = record.y;
      particle.rotation = 0;
      particle.scaleX = diameter / RING_SIZE;
      particle.scaleY = diameter * flatten / RING_SIZE;
      particle.alpha = show ? opacity * (1 - record.life) : 0;
      particle.tint = this.#ringTint;
      index += 1;
    }
    for (let rest = this.#ringCount; rest < this.#rings.length; rest += 1) this.#rings[rest].alpha = 0;
  }

  // The rain area on screen (TK-273, TK-358): the rain zones (the drops' mask, redrawn only when they change), or
  // without them the background (the screen without one) from the water's far edge down, unmasked.
  #prepareZones(world, area, viewWidth, viewHeight) {
    const zoned = world.rainZoned === true;
    const regions = world.rainRegions ?? NO_REGIONS;
    if (!zoned) {
      const view = this.#view, fallback = this.#zones.fallback;
      const top = area ? area.top : view.y + view.height * 0.35;
      fallback.x = view.x; fallback.y = top; fallback.width = view.width; fallback.height = view.y + view.height - top;
    }
    this.#zones.prepare(zoned ? regions : null, viewWidth, viewHeight);
    if (zoned) this.#mask.clipTo(regions);
    else this.#mask.release();
  }

  // Grows the pools when the settings grow (never on an ordinary frame) and re-uploads the containers' buffers.
  #ensurePools(drops, rings) {
    if (drops > this.#drops.length) {
      const old = this.#drops.length;
      const grow = (array, Type) => { const next = new Type(drops); next.set(array); return next; };
      this.#dropU = grow(this.#dropU, Float32Array);
      this.#dropV = grow(this.#dropV, Float32Array);
      this.#dropScale = grow(this.#dropScale, Float32Array);
      this.#dropAge = grow(this.#dropAge, Float32Array);
      this.#dropLife = grow(this.#dropLife, Float32Array);
      this.#dropActive = grow(this.#dropActive, Uint8Array);
      this.#dropLength = grow(this.#dropLength, Float32Array);
      this.#dropSlant = grow(this.#dropSlant, Float32Array);
      for (let index = old; index < drops; index += 1) {
        const particle = new this.#pixi.Particle({ texture: this.#streak, anchorX: 0.5, anchorY: 1, alpha: 0 });
        this.#drops.push(particle);
        this.#air.addParticle(particle);
      }
      this.#air.update();
    }
    if (rings > this.#rings.length) {
      for (let index = this.#rings.length; index < rings; index += 1) {
        const particle = new this.#pixi.Particle({ texture: this.#ring, anchorX: 0.5, anchorY: 0.5, alpha: 0 });
        this.#rings.push(particle);
        this.#surface.addParticle(particle);
        this.#ringRecords.push({ u: 0, v: 0, x: 0, y: 0, scale: 1, age: 0, life: 0, size: 0 });
      }
      this.#surface.update();
    }
  }

  // A thin streak, transparent at its tail (top) and bright at its head (bottom), drawn once.
  static #drawStreak(documentTarget) {
    const canvas = documentTarget.createElement("canvas");
    canvas.width = STREAK_WIDTH;
    canvas.height = STREAK_HEIGHT;
    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 0, STREAK_HEIGHT);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.7, "rgba(255,255,255,0.55)");
    gradient.addColorStop(1, "rgba(255,255,255,1)");
    context.fillStyle = gradient;
    context.fillRect(1, 0, STREAK_WIDTH - 2, STREAK_HEIGHT);
    return canvas;
  }

  // A thin soft ring, drawn once; the rings flatten it in perspective by their scale.
  static #drawRing(documentTarget) {
    const canvas = documentTarget.createElement("canvas");
    canvas.width = RING_SIZE;
    canvas.height = RING_SIZE;
    const context = canvas.getContext("2d");
    context.strokeStyle = "rgba(255,255,255,0.9)";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(RING_SIZE / 2, RING_SIZE / 2, RING_SIZE / 2 - 3, 0, Math.PI * 2);
    context.stroke();
    return canvas;
  }
}
