// Spec 179 stage C (TK-323): fiery ash in the air during an emission, on the WebGL scene.
// - Embers: soft round sparks of different sizes from one texture generated once, drawn additively. Each lives a
//   random time, fades in, glows with a slow flicker, cools from the hot colour toward the cool one and fades out.
// - Motion: smooth chaos, slower than rain. Every ember drifts with the wind and a slow rise, and wanders along two
//   slow sines per axis with its own frequencies and phases (a cheap stand-in for curl noise: no per-frame random and
//   no allocation). A depth share (0.4…1) scales its size and speed, so near embers are larger and faster.
// - World-anchored like the rain (TK-271.2): positions are shares of the location's background (world.backgroundLayers[0];
//   the screen without one), placed on screen every frame, so a camera move carries the embers with the location. New
//   embers start in the visible part; one that leaves it ends early. TK-355 (owner: «як у дощу»): maxParticles is the
//   count over the whole location (its background) at full intensity; the screen shows the share of it that is
//   visible, so a narrow phone screen shows fewer embers at the same density instead of squeezing them all in. The live
//   count follows the emission's intensity (world.weather.emission).
// - TK-349: where it flies — the ash zones on screen (world.ashRegions, zones.ash in the zone editor, apart from the
//   rain's). New embers start inside a visible zone (picked by its visible area), the count is maxParticles × the zones'
//   visible area / the location's area (TK-355), and an ember that drifts out of every zone fades out over its fade share (no mask, so
//   the edge stays soft). With the switch off (world.ashZoned false) the whole screen is the ash's.
// Spec 180 (TK-326): `settings` is the ash's look already resolved at the emission's strength (WeatherLookResolver:
// count, opacity, rise and wander between their ends at 0 and 100); the wind's drift is the wind's
// (`weatherSettings.wind.ashDriftPx`). TK-379: the drift follows the wind's direction, strength and gusts (like the
// rain's slant) and eases toward it (`settings.windFollowPerSec`); `settings.followsWind` false turns it off.
// Drawing (docs/rendering.md 16, 22, 23): one ParticleContainer, one texture, additive blend, no filter, a fixed pool
// sized by the settings (it grows only when the settings grow); unused particles have alpha 0. position, vertex
// (scale) and color (tint, alpha) change every frame, so they are dynamic (Pixi 8 ParticleBuffer.update). The scene
// presents a frame only while an ember is alive.
import { clampUnit, finiteOr } from "../../../engine/math/number_normalization.js";
import { effectOfPair } from "../../../engine/math/strength_value.js";
import { BackgroundPlacement } from "./background_placement.js";
import { mixColor, SceneColor } from "./scene_color.js";
import { ScreenZoneSet } from "./screen_zone_set.js";

const GLOW_SIZE = 32;
const MAX_STEP_SEC = 0.1;
const TWO_PI = Math.PI * 2;
const DYNAMIC = Object.freeze({ position: true, vertex: true, rotation: false, color: true, uvs: false });

const NO_REGIONS = Object.freeze({ count: 0, getAt: () => null });

export class PixiAshRenderer {
  #pixi;
  #random;
  #glow;
  #container;
  #particles = [];
  // Per ember: position (shares of the background), depth, size, age and life (s), wander frequencies and phases,
  // flicker, whether it is alive.
  #u = new Float32Array(0);
  #v = new Float32Array(0);
  #depth = new Float32Array(0);
  #size = new Float32Array(0);
  #age = new Float32Array(0);
  #life = new Float32Array(0);
  #freq = new Float32Array(0);
  #phase = new Float32Array(0);
  #alive = new Uint8Array(0);
  #count = 0;
  #time = 0;
  // TK-379: the wind's drift now, px/s (eases toward the wind).
  #windDrift = 0;
  #lastNow = null;
  #visible = false;
  #stepMs = 0;
  #view = new BackgroundPlacement();
  // TK-349: the ash zones' visible rectangles (left, top, width, height) and cumulative areas; grow with the zone count.
  #zoned = false;
  #zones = new ScreenZoneSet();
  #point = { x: 0, y: 0 };
  #hot = new SceneColor();
  #cool = new SceneColor();
  #hotValue = 0xffffff;
  #coolValue = 0xffffff;

  // documentTarget: makes the texture's canvas; random: () => 0…1 (the embers' places and timing; visual only).
  constructor({ pixi, documentTarget, random = Math.random }) {
    if (typeof pixi?.ParticleContainer !== "function" || typeof pixi?.Particle !== "function") {
      throw new TypeError("PixiAshRenderer requires pixi.ParticleContainer and pixi.Particle");
    }
    if (typeof random !== "function") throw new TypeError("PixiAshRenderer requires random");
    this.#pixi = pixi;
    this.#random = random;
    this.#glow = pixi.Texture.from(PixiAshRenderer.#drawGlow(documentTarget), true);
    this.#container = new pixi.ParticleContainer({ texture: this.#glow, dynamicProperties: DYNAMIC });
    this.#container.blendMode = "add";
    this.#container.visible = false;
  }

  // The embers fly in front of everything in the world: mounted last of the world's kinds.
  mount(stage) {
    stage.addChild(this.#container);
  }

  get status() {
    return { active: this.#visible, embers: this.#count, pool: this.#particles.length, stepMs: this.#stepMs };
  }

  // world: the frame's world model (null: not on the scene); viewWidth / viewHeight: the logical screen; nowMs: the
  // frame's clock; settings: the ash's resolved look; weatherSettings: CONFIG.weather ({ wind }). Returns whether the
  // scene must present a frame.
  update(world, viewWidth, viewHeight, nowMs, settings, weatherSettings = null) {
    const elapsed = this.#lastNow === null ? 0 : Math.min(MAX_STEP_SEC, Math.max(0, (nowMs - this.#lastNow) / 1000));
    this.#lastNow = nowMs;
    if (!world || settings?.enabled !== true) { this.#clear(); return this.#hide(); }
    // Spec 180 D10: the ash's own strength (follows the emission unless DevTools holds it).
    const intensity = clampUnit(finiteOr(world.weather?.ash ?? world.weather?.emission, 0));
    const max = Math.max(0, Math.floor(finiteOr(settings?.maxParticles, 0)));
    const cap = Math.max(max, Math.floor(finiteOr(settings?.maxParticlesCap, max)));
    this.#view.place(world, viewWidth, viewHeight);
    this.#prepareZones(world, viewWidth, viewHeight);
    // TK-355: the visible share of the location's ash (its zones, or the whole background) at the location's density.
    const share = Math.min(1, this.#zones.visibleArea / Math.max(1, this.#view.area));
    const target = intensity > 0 ? Math.round(max * share) : 0;
    if (target === 0 && this.#count === 0) return this.#hide();
    const started = performance.now();
    this.#ensurePool(cap);
    this.#hotValue = this.#hot.read(settings?.hotColor);
    this.#coolValue = this.#cool.read(settings?.coolColor);
    this.#time = (this.#time + elapsed) % 3600;
    this.#followWind(elapsed, settings, world.weather, weatherSettings?.wind);
    this.#updateEmbers(elapsed, target, settings, world, viewWidth, viewHeight);
    this.#visible = true;
    this.#container.visible = true;
    this.#stepMs = performance.now() - started;
    return true;
  }

  // The container goes with the scene's stage (Application.destroy with children); the generated texture is ours.
  dispose() {
    this.#glow.destroy(true);
  }

  // TK-379: the wind's drift (px/s at full depth) — direction × (strength + gust × gustSlantShare) × ashDriftPx, as the
  // rain's slant reads the wind; it catches up with the wind at windFollowPerSec (faster in a gust, gustFollowPerSec),
  // so the embers turn with the wind instead of jumping. followsWind false: no drift (it eases back to calm).
  #followWind(elapsed, settings, weather, wind) {
    const gust = clampUnit(finiteOr(weather?.windGust, 0));
    let target = 0;
    if (settings?.followsWind !== false) {
      const direction = Math.max(-1, Math.min(1, finiteOr(weather?.windDirection, 0)));
      const strength = clampUnit(finiteOr(weather?.windStrength, Math.abs(direction)));
      // Spec 187 D7: ashDriftPx is [від, до] by the wind's strength (with its gust); none with no wind.
      target = direction * effectOfPair(wind?.ashDriftPx, 0, strength + gust * Math.max(0, finiteOr(wind?.gustSlantShare, 1.2)));
    }
    const follow = Math.max(0, finiteOr(settings?.windFollowPerSec, 1.5)) +
      Math.min(1, gust * 3) * Math.max(0, finiteOr(wind?.gustFollowPerSec, 6));
    this.#windDrift += (target - this.#windDrift) * Math.min(1, elapsed * follow);
  }

  #updateEmbers(elapsed, target, settings, world, viewWidth, viewHeight) {
    const windDrift = this.#windDrift;
    const sizeMin = Math.max(0, finiteOr(settings?.sizePx?.[0], 2));
    const sizeMax = Math.max(sizeMin, finiteOr(settings?.sizePx?.[1], 9));
    const lifeMin = Math.max(0.1, finiteOr(settings?.lifeSec?.[0], 3));
    const lifeMax = Math.max(lifeMin, finiteOr(settings?.lifeSec?.[1], 7));
    const rise = finiteOr(settings?.riseSpeedPx, 18);
    const wander = Math.max(0, finiteOr(settings?.wanderPx, 26));
    const opacity = clampUnit(finiteOr(settings?.opacity, 0.85));
    const flicker = clampUnit(finiteOr(settings?.flicker, 0.35));
    const fade = clampUnit(finiteOr(settings?.fadeShare, 0.25));
    const view = this.#view;
    const toU = 1 / Math.max(1, view.width);
    const toV = 1 / Math.max(1, view.height);
    // The visible part of the background, in shares (embers start there and end when they leave it).
    const left = (0 - view.x) * toU;
    const top = (0 - view.y) * toV;
    const right = (viewWidth - view.x) * toU;
    const bottom = (viewHeight - view.y) * toV;
    let alive = 0;
    for (let index = 0; index < this.#particles.length; index += 1) {
      const particle = this.#particles[index];
      if (!this.#alive[index]) {
        if (alive >= target) { particle.alpha = 0; continue; }
        this.#spawn(index, sizeMin, sizeMax, lifeMin, lifeMax);
      }
      this.#age[index] += elapsed;
      const life = this.#life[index];
      const age = this.#age[index];
      const u = this.#u[index];
      const v = this.#v[index];
      if (age >= life || u < left - 0.02 || u > right + 0.02 || v < top - 0.02 || v > bottom + 0.02) {
        this.#alive[index] = 0;
        particle.alpha = 0;
        continue;
      }
      // TK-349: out of every ash zone — it fades out from here (its age jumps to the start of the fade).
      if (this.#zoned && age < life * (1 - fade) && !this.#zones.contains(view.screenX(u), view.screenY(v))) {
        this.#age[index] = life * (1 - fade);
      }
      const depth = this.#depth[index];
      const freq = this.#freq[index];
      const phase = this.#phase[index];
      const t = this.#time;
      // Two slow sines per axis with the ember's own frequency and phase: smooth, never repeating in step with others.
      const wanderX = Math.sin(t * freq + phase) + 0.6 * Math.sin(t * freq * 1.73 + phase * 2.1);
      const wanderY = Math.cos(t * freq * 0.83 + phase * 1.3) + 0.6 * Math.sin(t * freq * 2.27 + phase * 0.7);
      const speedX = (windDrift + wander * wanderX) * depth;
      const speedY = (-rise + wander * 0.7 * wanderY) * depth;
      this.#u[index] = u + speedX * elapsed * toU;
      this.#v[index] = v + speedY * elapsed * toV;
      const share = age / life;
      const envelope = share < fade ? share / fade : share > 1 - fade ? (1 - share) / fade : 1;
      const glow = 1 - flicker * (0.5 + 0.5 * Math.sin(t * freq * 6 + phase * 3));
      particle.x = view.x + this.#u[index] * view.width;
      particle.y = view.y + this.#v[index] * view.height;
      const scale = this.#size[index] * depth / GLOW_SIZE;
      particle.scaleX = scale;
      particle.scaleY = scale;
      particle.alpha = opacity * clampUnit(envelope) * glow;
      particle.tint = mixColor(this.#hotValue, this.#coolValue, share);
      alive += 1;
    }
    this.#count = alive;
  }

  #spawn(index, sizeMin, sizeMax, lifeMin, lifeMax) {
    const random = this.#random;
    // A visible ash zone (or the visible background) by its area, then a point inside it, as shares of the background.
    const point = this.#point;
    this.#zones.pick(random, point);
    this.#u[index] = this.#view.shareX(point.x);
    this.#v[index] = this.#view.shareY(point.y);
    this.#depth[index] = 0.4 + 0.6 * random();
    this.#size[index] = sizeMin + (sizeMax - sizeMin) * random() * random();
    this.#life[index] = lifeMin + (lifeMax - lifeMin) * random();
    this.#age[index] = this.#life[index] * 0.1 * random();
    this.#freq[index] = 0.35 + 0.9 * random();
    this.#phase[index] = TWO_PI * random();
    this.#alive[index] = 1;
  }

  // TK-349, TK-358: the ash zones' visible parts (none on screen: no new ember), or without zones the background.
  #prepareZones(world, viewWidth, viewHeight) {
    this.#zoned = world.ashZoned === true;
    if (!this.#zoned) {
      const view = this.#view, fallback = this.#zones.fallback;
      fallback.x = view.x; fallback.y = view.y; fallback.width = view.width; fallback.height = view.height;
    }
    this.#zones.prepare(this.#zoned ? world.ashRegions ?? NO_REGIONS : null, viewWidth, viewHeight);
  }

  #ensurePool(size) {
    if (size <= this.#particles.length) return;
    const grow = (array, Type) => { const next = new Type(size); next.set(array); return next; };
    this.#u = grow(this.#u, Float32Array);
    this.#v = grow(this.#v, Float32Array);
    this.#depth = grow(this.#depth, Float32Array);
    this.#size = grow(this.#size, Float32Array);
    this.#age = grow(this.#age, Float32Array);
    this.#life = grow(this.#life, Float32Array);
    this.#freq = grow(this.#freq, Float32Array);
    this.#phase = grow(this.#phase, Float32Array);
    this.#alive = grow(this.#alive, Uint8Array);
    while (this.#particles.length < size) {
      const particle = new this.#pixi.Particle({ texture: this.#glow, anchorX: 0.5, anchorY: 0.5, alpha: 0 });
      this.#particles.push(particle);
      this.#container.addParticle(particle);
    }
    this.#container.update();
  }

  #clear() {
    this.#alive.fill(0);
    this.#count = 0;
  }

  #hide() {
    if (!this.#visible) return false;
    this.#visible = false;
    this.#container.visible = false;
    for (let index = 0; index < this.#particles.length; index += 1) this.#particles[index].alpha = 0;
    return true;
  }

  // A soft round glow, bright in the middle and transparent at the edge, drawn once.
  static #drawGlow(documentTarget) {
    const canvas = documentTarget.createElement("canvas");
    canvas.width = GLOW_SIZE;
    canvas.height = GLOW_SIZE;
    const context = canvas.getContext("2d");
    const half = GLOW_SIZE / 2;
    const gradient = context.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.25, "rgba(255,255,255,0.85)");
    gradient.addColorStop(0.6, "rgba(255,255,255,0.25)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
    return canvas;
  }
}
