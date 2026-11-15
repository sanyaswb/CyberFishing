// Spec 179 stage C (TK-323): fiery ash in the air during an emission, on the WebGL scene.
// - Embers: soft round sparks of different sizes from one texture generated once, drawn additively. Each lives a
//   random time, fades in, glows with a slow flicker, cools from the hot colour toward the cool one and fades out.
// - Motion: smooth chaos, slower than rain. Every ember drifts with the wind and a slow rise, and wanders along two
//   slow sines per axis with its own frequencies and phases (a cheap stand-in for curl noise: no per-frame random and
//   no allocation). A depth share (0.4…1) scales its size and speed, so near embers are larger and faster.
// - World-anchored like the rain (TK-271.2): positions are shares of the location's background (world.backgroundLayers[0];
//   the screen without one), placed on screen every frame, so a camera move carries the embers with the location. New
//   embers start in the visible part; one that leaves it ends early. maxParticles is the count on one screen at full
//   intensity; the live count follows the emission's intensity (world.weather.emission).
// Drawing (docs/rendering.md 16, 22, 23): one ParticleContainer, one texture, additive blend, no filter, a fixed pool
// sized by the settings (it grows only when the settings grow); unused particles have alpha 0. position, vertex
// (scale) and color (tint, alpha) change every frame, so they are dynamic (Pixi 8 ParticleBuffer.update). The scene
// presents a frame only while an ember is alive.
const GLOW_SIZE = 32;
const MAX_STEP_SEC = 0.1;
const TWO_PI = Math.PI * 2;
const DYNAMIC = Object.freeze({ position: true, vertex: true, rotation: false, color: true, uvs: false });

const clamp01 = (value) => (value <= 0 ? 0 : value >= 1 ? 1 : value);
const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const parseColor = (text) => (/^#[0-9a-f]{6}$/iu.test(text) ? Number.parseInt(text.slice(1), 16) : 0xffffff);
const mixColor = (a, b, share) => {
  if (share <= 0) return a;
  if (share >= 1) return b;
  const channel = (shift) => Math.round(((a >> shift) & 255) + ((((b >> shift) & 255) - ((a >> shift) & 255)) * share));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
};

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
  #lastNow = null;
  #visible = false;
  #stepMs = 0;
  #view = { x: 0, y: 0, width: 1, height: 1 };
  #hot = { text: "", value: 0xffffff };
  #cool = { text: "", value: 0xffffff };

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
  // frame's clock; settings: CONFIG.canvas.ash. Returns whether the scene must present a frame.
  update(world, viewWidth, viewHeight, nowMs, settings) {
    const elapsed = this.#lastNow === null ? 0 : Math.min(MAX_STEP_SEC, Math.max(0, (nowMs - this.#lastNow) / 1000));
    this.#lastNow = nowMs;
    if (!world || settings?.enabled !== true) { this.#clear(); return this.#hide(); }
    const intensity = clamp01(number(world.weather?.emission, 0));
    const max = Math.max(0, Math.floor(number(settings?.maxParticles, 0)));
    const target = Math.round(max * intensity);
    if (target === 0 && this.#count === 0) return this.#hide();
    const started = performance.now();
    this.#ensurePool(max);
    this.#placeView(world, viewWidth, viewHeight);
    this.#hot = PixiAshRenderer.#color(this.#hot, settings?.hotColor);
    this.#cool = PixiAshRenderer.#color(this.#cool, settings?.coolColor);
    this.#time = (this.#time + elapsed) % 3600;
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

  #updateEmbers(elapsed, target, settings, world, viewWidth, viewHeight) {
    const sizeMin = Math.max(0, number(settings?.sizePx?.[0], 2));
    const sizeMax = Math.max(sizeMin, number(settings?.sizePx?.[1], 9));
    const lifeMin = Math.max(0.1, number(settings?.lifeSec?.[0], 3));
    const lifeMax = Math.max(lifeMin, number(settings?.lifeSec?.[1], 7));
    const rise = number(settings?.riseSpeedPx, 18);
    const wander = Math.max(0, number(settings?.wanderPx, 26));
    const windDrift = number(settings?.windDriftPx, 40);
    const opacity = clamp01(number(settings?.opacity, 0.85));
    const flicker = clamp01(number(settings?.flicker, 0.35));
    const fade = clamp01(number(settings?.fadeShare, 0.25));
    const wind = Math.max(-1, Math.min(1, number(world.weather?.windDirection, 0))) *
      clamp01(number(world.weather?.windStrength, Math.abs(number(world.weather?.windDirection, 0))));
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
        this.#spawn(index, left, top, right, bottom, sizeMin, sizeMax, lifeMin, lifeMax);
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
      const depth = this.#depth[index];
      const freq = this.#freq[index];
      const phase = this.#phase[index];
      const t = this.#time;
      // Two slow sines per axis with the ember's own frequency and phase: smooth, never repeating in step with others.
      const wanderX = Math.sin(t * freq + phase) + 0.6 * Math.sin(t * freq * 1.73 + phase * 2.1);
      const wanderY = Math.cos(t * freq * 0.83 + phase * 1.3) + 0.6 * Math.sin(t * freq * 2.27 + phase * 0.7);
      const speedX = (wind * windDrift + wander * wanderX) * depth;
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
      particle.alpha = opacity * clamp01(envelope) * glow;
      particle.tint = mixColor(this.#hot.value, this.#cool.value, share);
      alive += 1;
    }
    this.#count = alive;
  }

  #spawn(index, left, top, right, bottom, sizeMin, sizeMax, lifeMin, lifeMax) {
    const random = this.#random;
    this.#u[index] = left + (right - left) * random();
    this.#v[index] = top + (bottom - top) * random();
    this.#depth[index] = 0.4 + 0.6 * random();
    this.#size[index] = sizeMin + (sizeMax - sizeMin) * random() * random();
    this.#life[index] = lifeMin + (lifeMax - lifeMin) * random();
    this.#age[index] = this.#life[index] * 0.1 * random();
    this.#freq[index] = 0.35 + 0.9 * random();
    this.#phase[index] = TWO_PI * random();
    this.#alive[index] = 1;
  }

  // The embers' world: the background's first layer (the location's picture on screen), else the screen.
  #placeView(world, viewWidth, viewHeight) {
    const layers = world.backgroundLayers;
    const base = layers && layers.count > 0 ? layers.getAt(0) : null;
    const view = this.#view;
    if (base && base.width > 0 && base.height > 0) {
      view.x = base.x; view.y = base.y; view.width = base.width; view.height = base.height;
    } else {
      view.x = 0; view.y = 0; view.width = Math.max(1, viewWidth); view.height = Math.max(1, viewHeight);
    }
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

  static #color(cache, value) {
    const text = typeof value === "string" ? value : "#ffffff";
    if (text === cache.text) return cache;
    return { text, value: parseColor(text) };
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
