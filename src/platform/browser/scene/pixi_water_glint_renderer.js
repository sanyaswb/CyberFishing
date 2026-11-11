// Spec 172 D2 (TK-270): glints on the water's waves. On every step of the water (PixiWaterRenderer, its own frame
// rate) the wave field's crests become sparkles: a texel sparkles when its crest stands above a mode's threshold, the
// brighter the higher. Modes (world.glints, blended like the time-of-day backgrounds): day sparkles over all the water,
// the sun's path (sunrise, sunset) and the moon's path; a path keeps sparkles inside a band under its light, narrow at
// the far edge and wide at the near one, and adds a soft glow of faint large particles inside the band (only on water
// texels, so it needs no mask). The weather's cloud and fog dim everything (weatherDamping).
//
// Drawing (docs/rendering.md 16, 22, 23): one ParticleContainer with one generated soft-dot texture and additive blend:
// one draw call, no filter. The particles are a fixed pool sized by the settings (it grows only when they grow); unused
// ones have alpha 0. Pixi 8 uploads a particle's vertex (scale, anchor) and color (tint, alpha) attributes only when they
// are declared dynamic or after ParticleContainer.update() (ParticleBuffer.update: static attributes upload only with
// uploadStatic); position, scale and colour change on every step, so all three are dynamic; uvs stay static (one texture).
const TEXTURE_SIZE = 32;
const GLOW_STEP = 2;
const GLOW_SPREAD = 1.8;
const MIN_ALPHA = 0.01;
const JITTER = 0.8;

const clamp01 = (value) => (value <= 0 ? 0 : value >= 1 ? 1 : value);
const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const smoothstep = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

export class PixiWaterGlintRenderer {
  #pixi;
  #texture;
  #container;
  #particles = [];
  #used = 0;
  #visible = false;
  #sparkles = 0;
  #glow = 0;
  #stepMs = 0;
  #colorText = ["", "", ""];
  #colorValue = [0xffffff, 0xffffff, 0xffffff];
  #mode = 0;

  // documentTarget: makes the sparkle's canvas. The water renderer mounts the glints right over its own objects.
  constructor({ pixi, documentTarget }) {
    if (typeof pixi?.ParticleContainer !== "function" || typeof pixi?.Particle !== "function") {
      throw new TypeError("PixiWaterGlintRenderer requires pixi.ParticleContainer and pixi.Particle");
    }
    this.#pixi = pixi;
    this.#texture = pixi.Texture.from(PixiWaterGlintRenderer.#drawDot(documentTarget), true);
    this.#container = new pixi.ParticleContainer({ texture: this.#texture,
      dynamicProperties: { position: true, vertex: true, color: true, rotation: false, uvs: false } });
    this.#container.blendMode = "add";
    this.#container.visible = false;
  }

  // Adds the glints to the scene's root container, over what was added before them (the water).
  mount(stage) {
    stage.addChild(this.#container);
  }

  // For DEV: whether the glints show, the sparkles and glow particles of the last step, the pool and the step's time.
  get status() {
    return { active: this.#visible, sparkles: this.#sparkles, glow: this.#glow, pool: this.#particles.length,
      stepMs: this.#stepMs };
  }

  // field: the WaterWaveField after its write(); area: the screen rectangle it covers ({ left, top, right, bottom });
  // glints: world.glints (none: no glints); settings: CONFIG.canvas.water.glints. Called on each water step.
  step(field, area, glints, settings) {
    if (!glints) return this.hide();
    const started = performance.now();
    const day = settings?.day, sun = settings?.sunPath, moon = settings?.moonPath;
    const damp = clamp01(1 - Math.max(0, number(settings?.weatherDamping, 1)) * Math.max(glints.cloud, glints.fog));
    const dayWeight = glints.day * Math.max(0, number(day?.intensity, 0)) * damp;
    const sunWeight = glints.sunPath * Math.max(0, number(sun?.intensity, 0)) * damp;
    const moonWeight = glints.moonPath * Math.max(0, number(moon?.intensity, 0)) * damp;
    if (settings?.enabled !== true || (dayWeight <= 0 && sunWeight <= 0 && moonWeight <= 0)) return this.hide();
    const maxGlow = Math.max(0, Math.floor(number(settings.maxGlow, 0)));
    const maxSparkles = Math.max(0, Math.floor(number(settings.maxSparkles, 0)));
    this.#ensurePool(maxGlow + maxSparkles);
    this.#colors(day, sun, moon);
    const width = field.width, height = field.height;
    const spanX = area.right - area.left, spanY = area.bottom - area.top;
    const texelWidth = spanX / width, texelHeight = spanY / height;
    let used = this.#glowPass(field, area, glints, sun, moon, sunWeight, moonWeight, texelWidth, texelHeight, maxGlow);
    this.#glow = used;
    const sparkles = this.#sparklePass(field, area, glints, day, sun, moon, dayWeight, sunWeight, moonWeight,
      texelWidth, texelHeight, used, maxSparkles);
    this.#sparkles = sparkles;
    used += sparkles;
    for (let index = used; index < this.#used; index += 1) this.#particles[index].alpha = 0;
    this.#used = used;
    this.#visible = true;
    this.#container.visible = true;
    this.#stepMs = performance.now() - started;
    return true;
  }

  // Returns whether something visible was removed.
  hide() {
    if (!this.#visible) return false;
    this.#visible = false;
    this.#container.visible = false;
    this.#sparkles = 0;
    this.#glow = 0;
    return true;
  }

  dispose() {
    this.#container.destroy();
    this.#texture.destroy(true);
  }

  // The path's soft glow: every GLOW_STEP-th texel inside a band, a large faint particle, so they merge into a strip.
  #glowPass(field, area, glints, sun, moon, sunWeight, moonWeight, texelWidth, texelHeight, limit) {
    const sunGlow = sunWeight * Math.max(0, number(sun?.glow, 0));
    const moonGlow = moonWeight * Math.max(0, number(moon?.glow, 0));
    if (limit === 0 || (sunGlow <= 0 && moonGlow <= 0)) return 0;
    const width = field.width, height = field.height, edges = field.edges, scales = field.rowScales;
    const size = GLOW_STEP * Math.max(texelWidth, texelHeight) * GLOW_SPREAD / TEXTURE_SIZE;
    let used = 0;
    for (let row = GLOW_STEP >> 1; row < height && used < limit; row += GLOW_STEP) {
      const near = (row + 0.5) / height;
      const y = area.top + (row + 0.5) * texelHeight;
      for (let column = GLOW_STEP >> 1; column < width && used < limit; column += GLOW_STEP) {
        const edge = edges[row * width + column];
        if (edge <= 0) continue;
        const x = area.left + (column + 0.5) * texelWidth;
        const sunAlpha = sunGlow > 0 ? sunGlow * PixiWaterGlintRenderer.#band(x, glints.sunX, near, sun, area) : 0;
        const moonAlpha = moonGlow > 0 ? moonGlow * PixiWaterGlintRenderer.#band(x, glints.moonX, near, moon, area) : 0;
        const alpha = Math.max(sunAlpha, moonAlpha) * edge;
        if (alpha < MIN_ALPHA) continue;
        const scale = size * scales[row];
        this.#place(used, x, y, scale, alpha, sunAlpha >= moonAlpha ? this.#colorValue[1] : this.#colorValue[2]);
        used += 1;
      }
    }
    return used;
  }

  // Sparkles on the crests. When more texels qualify than the pool holds, every stride-th one is drawn, so the
  // sparkles stay spread over the whole water instead of filling up from the far edge.
  #sparklePass(field, area, glints, day, sun, moon, dayWeight, sunWeight, moonWeight, texelWidth, texelHeight, start,
    limit) {
    if (limit === 0) return 0;
    let candidates = 0;
    const total = field.width * field.height;
    for (let index = 0; index < total; index += 1) {
      if (this.#strength(field, index, area, glints, day, sun, moon, dayWeight, sunWeight, moonWeight, texelWidth) > 0) {
        candidates += 1;
      }
    }
    const stride = Math.max(1, Math.ceil(candidates / limit));
    const width = field.width, scales = field.rowScales;
    const sizeNear = Math.max(0, number(day?.sizePx, 4)), sizeFar = Math.max(0, number(day?.sizeFarPx, 1.5));
    let seen = 0, used = 0;
    for (let index = 0; index < total && used < limit; index += 1) {
      const strength = this.#strength(field, index, area, glints, day, sun, moon, dayWeight, sunWeight, moonWeight,
        texelWidth);
      if (strength <= 0) continue;
      seen += 1;
      if (seen % stride !== 0) continue;
      const row = (index / width) | 0, column = index - row * width;
      const x = area.left + (column + 0.5 + PixiWaterGlintRenderer.#jitter(index, 0x9e3779b1)) * texelWidth;
      const y = area.top + (row + 0.5 + PixiWaterGlintRenderer.#jitter(index, 0x85ebca77)) * texelHeight;
      const mode = this.#mode;
      const settings = mode === 0 ? day : mode === 1 ? sun : moon;
      const near = Math.max(0, number(settings?.sizePx, sizeNear));
      const far = Math.max(0, number(settings?.sizeFarPx, sizeFar));
      const diameter = Math.max(far, near * scales[row]) * (0.6 + 0.4 * strength);
      this.#place(start + used, x, y, diameter / TEXTURE_SIZE, Math.min(1, strength), this.#colorValue[mode]);
      used += 1;
    }
    return used;
  }

  // A texel's sparkle strength 0…1 over the three modes; sets #mode to the strongest one (0 day, 1 sun, 2 moon).
  #strength(field, index, area, glints, day, sun, moon, dayWeight, sunWeight, moonWeight, texelWidth) {
    const crest = field.crests[index];
    let best = 0;
    this.#mode = 0;
    if (dayWeight > 0) {
      const threshold = number(day?.threshold, 0.72);
      if (crest > threshold) best = (crest - threshold) / (1 - threshold) * dayWeight;
    }
    if (sunWeight > 0 || moonWeight > 0) {
      const row = (index / field.width) | 0;
      const near = (row + 0.5) / field.height;
      const x = area.left + (index - row * field.width + 0.5) * texelWidth;
      if (sunWeight > 0) {
        const threshold = number(sun?.threshold, 0.55);
        if (crest > threshold) {
          const value = (crest - threshold) / (1 - threshold) * sunWeight *
            PixiWaterGlintRenderer.#band(x, glints.sunX, near, sun, area);
          if (value > best) { best = value; this.#mode = 1; }
        }
      }
      if (moonWeight > 0) {
        const threshold = number(moon?.threshold, 0.55);
        if (crest > threshold) {
          const value = (crest - threshold) / (1 - threshold) * moonWeight *
            PixiWaterGlintRenderer.#band(x, glints.moonX, near, moon, area);
          if (value > best) { best = value; this.#mode = 2; }
        }
      }
    }
    return best >= MIN_ALPHA ? best : 0;
  }

  // 1 inside a path's band, fading to 0 over its soft edge. near: 0 at the far edge of the water … 1 at the near one;
  // widths are shares of the water's width.
  static #band(x, axisX, near, path, area) {
    const widthFar = Math.max(0, number(path?.widthFar, 0.05));
    const widthNear = Math.max(0, number(path?.widthNear, 0.3));
    const half = (widthFar + (widthNear - widthFar) * near) * (area.right - area.left) / 2;
    if (!(half > 0)) return 0;
    const inner = half * (1 - clamp01(number(path?.softness, 0.5)));
    const distance = Math.abs(x - axisX);
    if (distance <= inner) return 1;
    if (distance >= half) return 0;
    return 1 - smoothstep((distance - inner) / (half - inner));
  }

  // A fixed offset of a texel's sparkle inside its texel (−JITTER/2 … JITTER/2 texels), so the sparkles do not line up.
  static #jitter(index, salt) {
    const hash = Math.imul(index + 1, salt) >>> 0;
    return ((hash >>> 8) / 16777216 - 0.5) * JITTER;
  }

  #place(index, x, y, scale, alpha, tint) {
    const particle = this.#particles[index];
    particle.x = x;
    particle.y = y;
    particle.scaleX = scale;
    particle.scaleY = scale;
    particle.alpha = alpha;
    particle.tint = tint;
  }

  // Colours are parsed only when their text changes.
  #colors(day, sun, moon) {
    this.#color(0, day?.color);
    this.#color(1, sun?.color);
    this.#color(2, moon?.color);
  }

  #color(index, value) {
    const text = typeof value === "string" ? value : "#ffffff";
    if (text === this.#colorText[index]) return;
    this.#colorText[index] = text;
    this.#colorValue[index] = /^#[0-9a-f]{6}$/iu.test(text) ? Number.parseInt(text.slice(1), 16) : 0xffffff;
  }

  // Grows the pool (never per step unless the settings grew it) and re-uploads the container's buffers.
  #ensurePool(size) {
    if (this.#particles.length >= size) return;
    while (this.#particles.length < size) {
      const particle = new this.#pixi.Particle({ texture: this.#texture, anchorX: 0.5, anchorY: 0.5, alpha: 0 });
      this.#particles.push(particle);
      this.#container.addParticle(particle);
    }
    this.#container.update();
  }

  // A soft round dot with a bright core, drawn once.
  static #drawDot(documentTarget) {
    const canvas = documentTarget.createElement("canvas");
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const context = canvas.getContext("2d");
    const radius = TEXTURE_SIZE / 2;
    const gradient = context.createRadialGradient(radius, radius, 0, radius, radius, radius);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.25, "rgba(255,255,255,0.8)");
    gradient.addColorStop(0.6, "rgba(255,255,255,0.18)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    return canvas;
  }
}
