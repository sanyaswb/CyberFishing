// Spec 182 stage C (TK-352): the starfall's ordinary stars on the WebGL scene.
// - A star is a short bright streak: its head flies along a steep slant (angleDeg below the horizon ± angleJitterDeg,
//   to the left or the right), its tail grows to lengthPx behind it, it flares in fast and fades over its last share of
//   life. One streak texture (a bright head fading to a clear tail) is drawn once in code; each star is a particle
//   anchored at its head, rotated along its flight and stretched to its tail's length.
// - How many: perMinute [at strength 0, at 1] over the whole sky (TK-355, like the rain: the sky zones whole, or the
//   background's top third), × the share of it on screen, so a narrow phone screen shows fewer at the same density, at the night's strength (world.weather.starfall,
//   StarfallNight: rises and falls through the night). Stars start at random moments (an accumulator of the rate, so
//   the count follows the strength without a fixed rhythm) at a random point of a visible sky zone (world.skyRegions,
//   picked by area; with the switch off — the background's top third). When skyZoned is true, one shared Graphics mask
//   (on both the stars' ParticleContainer and the bolide's Container) clips tails and glow cleanly at the sky zone edges
//   and redraws only when the sky rectangles change; stars leaving the zone also fade out smoothly inside it.
// - Stage D (TK-353), the bolide: when the night's bolideSerial changes (StarfallNight: at most one a night, at any
//   moment, quiet stretches too) one big star falls: a long tail (bolide.lengthPx), wider, brighter, slower and longer
//   than the others (bolide.lifeSec), with a glowing head (bolide.glowPx) that flickers a little; it starts in a visible
//   sky zone (none on screen: it is skipped) and fades like the others. Two sprites of its own (the streak and a glow
//   drawn once), additive, in front of the ordinary stars.
// Drawing (docs/rendering.md 16, 22, 23): one ParticleContainer, one texture, additive blend, no filter; a fixed pool
// sized by the settings (it grows only when they grow); unused particles have alpha 0. Frames only while a star flies.
const STREAK_W = 64;
const GLOW = 32;
const STREAK_H = 8;
const MAX_STEP_SEC = 0.1;
const MAX_POOL = 96;
const DYNAMIC = Object.freeze({ position: true, vertex: true, rotation: true, color: true, uvs: false });

const clamp01 = (value) => (value <= 0 ? 0 : value >= 1 ? 1 : value);
const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const pairAt = (pair, index, fallback) => number(Array.isArray(pair) ? pair[index] : undefined, fallback);
const parseColor = (text) => (/^#[0-9a-f]{6}$/iu.test(text) ? Number.parseInt(text.slice(1), 16) : 0xffffff);

export class PixiStarfallRenderer {
  #pixi;
  #random;
  #streak;
  #glow;
  #container;
  #bolideContainer;
  #bolideTail;
  #bolideHead;
  #bolide = { alive: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, length: 0, phase: 0 };
  #bolideSerial = null;
  #bolideColor = { text: "", value: 0xffffff };
  #particles = [];
  // Per star: head position (screen px), velocity (px/s), age and life (s), tail length (px), alive.
  #x = new Float32Array(0);
  #y = new Float32Array(0);
  #vx = new Float32Array(0);
  #vy = new Float32Array(0);
  #age = new Float32Array(0);
  #life = new Float32Array(0);
  #length = new Float32Array(0);
  #alive = new Uint8Array(0);
  #count = 0;
  #spawnDebt = 0;
  #lastNow = null;
  #visible = false;
  #color = { text: "", value: 0xffffff };
  #zoneRects = new Float32Array(4);
  #zoneWeights = new Float32Array(1);
  #zoneCount = 0;
  #zoneArea = 0;
  #wholeArea = 0;
  #mask;
  #maskRects = [];

  // documentTarget: makes the streak's canvas; random: () => 0…1 (visual only).
  constructor({ pixi, documentTarget, random = Math.random }) {
    if (typeof pixi?.ParticleContainer !== "function" || typeof pixi?.Particle !== "function") {
      throw new TypeError("PixiStarfallRenderer requires pixi.ParticleContainer and pixi.Particle");
    }
    if (typeof random !== "function") throw new TypeError("PixiStarfallRenderer requires random");
    this.#pixi = pixi;
    this.#random = random;
    this.#streak = pixi.Texture.from(PixiStarfallRenderer.#drawStreak(documentTarget), true);
    this.#container = new pixi.ParticleContainer({ texture: this.#streak, dynamicProperties: DYNAMIC });
    this.#container.blendMode = "add";
    this.#container.visible = false;
    this.#glow = pixi.Texture.from(PixiStarfallRenderer.#drawGlow(documentTarget), true);
    this.#bolideContainer = new pixi.Container();
    this.#bolideContainer.blendMode = "add";
    this.#bolideContainer.visible = false;
    this.#bolideTail = new pixi.Sprite(this.#streak);
    this.#bolideTail.anchor.set(1, 0.5);
    this.#bolideHead = new pixi.Sprite(this.#glow);
    this.#bolideHead.anchor.set(0.5, 0.5);
    this.#bolideContainer.addChild(this.#bolideTail, this.#bolideHead);
    this.#mask = new pixi.Graphics();
  }

  // Right over the background's sky, under the water and everything in the world (rendering.md 14).
  mount(stage) {
    stage.addChild(this.#container);
    stage.addChild(this.#bolideContainer);
    stage.addChild(this.#mask);
  }

  get status() {
    return { active: this.#visible, stars: this.#count, pool: this.#particles.length, bolide: this.#bolide.alive };
  }

  // world: the frame's world model (null: not on the scene); viewWidth / viewHeight: the logical screen; nowMs: the
  // frame's clock; settings: CONFIG.canvas.starfall. Returns whether the scene must present a frame.
  update(world, viewWidth, viewHeight, nowMs, settings) {
    const elapsed = this.#lastNow === null ? 0 : Math.min(MAX_STEP_SEC, Math.max(0, (nowMs - this.#lastNow) / 1000));
    this.#lastNow = nowMs;
    // A bolide falls when the night's serial changes (the first frame only takes the serial as it is).
    const serial = number(world?.weather?.bolideSerial, 0);
    const bolideDue = this.#bolideSerial !== null && serial !== this.#bolideSerial;
    if (world) this.#bolideSerial = serial;
    if (!world || settings?.enabled !== true) { this.#clear(); return this.#hide(); }
    const strength = clamp01(number(world.weather?.starfall, 0));
    if (strength <= 0 && this.#count === 0 && !this.#bolide.alive && !bolideDue) { this.#spawnDebt = 0; return this.#hide(); }
    this.#prepareZones(world, viewWidth, viewHeight);
    if (bolideDue && this.#zoneCount > 0) this.#spawnBolide(settings);
    const bolideFlying = this.#updateBolide(elapsed, settings);
    const lifeMax = Math.max(0.1, pairAt(settings.lifeSec, 1, 0.9));
    const perMinuteMax = Math.max(0, pairAt(settings.perMinute, 1, 30));
    this.#ensurePool(Math.min(MAX_POOL, Math.ceil(perMinuteMax / 60 * lifeMax * 2) + 4));
    this.#color = PixiStarfallRenderer.#parse(this.#color, settings.color);
    const low = Math.max(0, pairAt(settings.perMinute, 0, 0));
    const share = this.#wholeArea > 0 ? Math.min(1, this.#zoneArea / this.#wholeArea) : 0;
    const rate = strength > 0 && this.#zoneCount > 0 ? (low + (perMinuteMax - low) * strength) / 60 * share : 0;
    this.#spawnDebt += rate * elapsed * (0.5 + this.#random());
    const before = this.#count;
    this.#updateStars(elapsed, settings);
    const shown = !this.#visible;
    this.#visible = true;
    this.#container.visible = true;
    // A frame only while a star flies (or the last one just went out); a starfall night between stars presents none.
    return shown || this.#count > 0 || before > 0 || bolideFlying;
  }

  dispose() {
    this.#streak.destroy(true);
    this.#glow.destroy(true);
  }

  #updateStars(elapsed, settings) {
    const opacity = clamp01(number(settings.opacity, 0.9));
    const fade = clamp01(number(settings.fadeShare, 0.4));
    const widthPx = Math.max(0.5, number(settings.widthPx, 2));
    let alive = 0;
    for (let index = 0; index < this.#particles.length; index += 1) {
      const particle = this.#particles[index];
      if (!this.#alive[index]) {
        if (this.#spawnDebt >= 1) { this.#spawnDebt -= 1; this.#spawn(index, settings); }
        else { particle.alpha = 0; continue; }
      }
      this.#age[index] += elapsed;
      const life = this.#life[index];
      if (this.#age[index] >= life) { this.#alive[index] = 0; particle.alpha = 0; continue; }
      this.#x[index] += this.#vx[index] * elapsed;
      this.#y[index] += this.#vy[index] * elapsed;
      // Out of every sky zone: it fades out from here.
      if (this.#age[index] < life * (1 - fade) && !this.#insideZone(this.#x[index], this.#y[index])) {
        this.#age[index] = life * (1 - fade);
      }
      const age = this.#age[index];
      const share = age / life;
      const flare = Math.min(1, share / 0.08);
      const envelope = share > 1 - fade ? (1 - share) / Math.max(1e-6, fade) : 1;
      const speed = Math.hypot(this.#vx[index], this.#vy[index]);
      const tail = Math.min(this.#length[index], speed * age);
      particle.x = this.#x[index];
      particle.y = this.#y[index];
      particle.rotation = Math.atan2(this.#vy[index], this.#vx[index]);
      particle.scaleX = Math.max(0.01, tail / STREAK_W);
      particle.scaleY = widthPx / STREAK_H;
      particle.alpha = opacity * flare * clamp01(envelope);
      particle.tint = this.#color.value;
      alive += 1;
    }
    // A debt the pool could not take now waits at most one star.
    this.#spawnDebt = Math.min(this.#spawnDebt, 1);
    this.#count = alive;
  }

  #spawn(index, settings) {
    const random = this.#random;
    const pick = random() * this.#zoneArea;
    let zone = 0;
    while (zone < this.#zoneCount - 1 && this.#zoneWeights[zone] < pick) zone += 1;
    const offset = zone * 4;
    this.#x[index] = this.#zoneRects[offset] + random() * this.#zoneRects[offset + 2];
    this.#y[index] = this.#zoneRects[offset + 1] + random() * this.#zoneRects[offset + 3];
    const angle = (number(settings.angleDeg, 35) + number(settings.angleJitterDeg, 12) * (2 * random() - 1)) * Math.PI / 180;
    const side = random() < 0.5 ? -1 : 1;
    const speed = pairAt(settings.speedPx, 0, 500) + (pairAt(settings.speedPx, 1, 900) - pairAt(settings.speedPx, 0, 500)) * random();
    this.#vx[index] = side * Math.cos(angle) * speed;
    this.#vy[index] = Math.sin(angle) * speed;
    this.#length[index] = pairAt(settings.lengthPx, 0, 60) + (pairAt(settings.lengthPx, 1, 140) - pairAt(settings.lengthPx, 0, 60)) * random();
    this.#life[index] = pairAt(settings.lifeSec, 0, 0.4) + (pairAt(settings.lifeSec, 1, 0.9) - pairAt(settings.lifeSec, 0, 0.4)) * random();
    this.#age[index] = 0;
    this.#alive[index] = 1;
  }

  // Stage D: the bolide starts in the upper half of a visible sky zone, on a shallower slant than the stars.
  #spawnBolide(settings) {
    const random = this.#random;
    const look = settings.bolide ?? {};
    const pick = random() * this.#zoneArea;
    let zone = 0;
    while (zone < this.#zoneCount - 1 && this.#zoneWeights[zone] < pick) zone += 1;
    const offset = zone * 4;
    const bolide = this.#bolide;
    bolide.x = this.#zoneRects[offset] + random() * this.#zoneRects[offset + 2];
    bolide.y = this.#zoneRects[offset + 1] + random() * this.#zoneRects[offset + 3] * 0.5;
    const angle = number(look.angleDeg, 22) * Math.PI / 180;
    const slow = pairAt(look.speedPx, 0, 250);
    const speed = slow + (pairAt(look.speedPx, 1, 400) - slow) * random();
    const side = random() < 0.5 ? -1 : 1;
    bolide.vx = side * Math.cos(angle) * speed;
    bolide.vy = Math.sin(angle) * speed;
    const short = pairAt(look.lengthPx, 0, 300);
    bolide.length = short + (pairAt(look.lengthPx, 1, 500) - short) * random();
    const brief = pairAt(look.lifeSec, 0, 2.2);
    bolide.life = brief + (pairAt(look.lifeSec, 1, 3.2) - brief) * random();
    bolide.age = 0;
    bolide.phase = random() * Math.PI * 2;
    bolide.alive = true;
  }

  // Returns whether the bolide is in the air this frame (or just went out).
  #updateBolide(elapsed, settings) {
    const bolide = this.#bolide;
    if (!bolide.alive) {
      if (this.#bolideContainer.visible) { this.#bolideContainer.visible = false; return true; }
      return false;
    }
    const look = settings.bolide ?? {};
    const fade = clamp01(number(settings.fadeShare, 0.4));
    bolide.age += elapsed;
    if (bolide.age >= bolide.life) { bolide.alive = false; this.#bolideContainer.visible = false; return true; }
    bolide.x += bolide.vx * elapsed;
    bolide.y += bolide.vy * elapsed;
    if (bolide.age < bolide.life * (1 - fade) && !this.#insideZone(bolide.x, bolide.y)) bolide.age = bolide.life * (1 - fade);
    const share = bolide.age / bolide.life;
    const flare = Math.min(1, share / 0.05);
    const envelope = share > 1 - fade ? (1 - share) / Math.max(1e-6, fade) : 1;
    const alpha = clamp01(number(look.opacity, 1)) * flare * clamp01(envelope);
    this.#bolideColor = PixiStarfallRenderer.#parse(this.#bolideColor, look.color);
    const speed = Math.hypot(bolide.vx, bolide.vy);
    const tail = this.#bolideTail;
    tail.x = bolide.x;
    tail.y = bolide.y;
    tail.rotation = Math.atan2(bolide.vy, bolide.vx);
    tail.scale.set(Math.max(0.01, Math.min(bolide.length, speed * bolide.age) / STREAK_W),
      Math.max(0.5, number(look.widthPx, 5)) / STREAK_H);
    tail.alpha = alpha;
    tail.tint = this.#bolideColor.value;
    const head = this.#bolideHead;
    const flicker = 1 + 0.12 * Math.sin(bolide.age * 23 + bolide.phase);
    head.x = bolide.x;
    head.y = bolide.y;
    head.scale.set(Math.max(1, number(look.glowPx, 28)) / GLOW * flicker);
    head.alpha = alpha;
    head.tint = this.#bolideColor.value;
    this.#bolideContainer.visible = true;
    return true;
  }

  // The sky zones' visible parts on screen with cumulative areas; without zones — the background's top third.
  #prepareZones(world, viewWidth, viewHeight) {
    const zoned = world.skyZoned === true;
    const regions = world.skyRegions;
    const count = zoned ? (regions ? regions.count : 0) : 1;
    if (this.#zoneRects.length < count * 4) {
      this.#zoneRects = new Float32Array(count * 4);
      this.#zoneWeights = new Float32Array(count);
    }
    let total = 0, visible = 0, whole = 0;
    for (let index = 0; index < count; index += 1) {
      let rectX, rectY, rectWidth, rectHeight;
      if (zoned) {
        const rect = regions.getAt(index);
        rectX = rect.x; rectY = rect.y; rectWidth = rect.width; rectHeight = rect.height;
      } else {
        const layers = world.backgroundLayers;
        const base = layers && layers.count > 0 ? layers.getAt(0) : null;
        rectX = base ? base.x : 0; rectY = base ? base.y : 0;
        rectWidth = base ? base.width : viewWidth; rectHeight = (base ? base.height : viewHeight) / 3;
      }
      if (rectWidth > 0 && rectHeight > 0) whole += rectWidth * rectHeight;
      const left = Math.max(0, rectX), top = Math.max(0, rectY);
      const right = Math.min(viewWidth, rectX + rectWidth), bottom = Math.min(viewHeight, rectY + rectHeight);
      if (!(right > left && bottom > top)) continue;
      const offset = visible * 4;
      this.#zoneRects[offset] = left; this.#zoneRects[offset + 1] = top;
      this.#zoneRects[offset + 2] = right - left; this.#zoneRects[offset + 3] = bottom - top;
      total += (right - left) * (bottom - top);
      this.#zoneWeights[visible] = total;
      visible += 1;
    }
    this.#zoneCount = visible;
    this.#zoneArea = total;
    this.#wholeArea = whole;
    this.#updateMask(zoned, regions);
  }

  // Clips both the ordinary stars and the bolide to the sky zones, redrawing only when their rectangles change.
  #updateMask(zoned, regions) {
    if (!zoned) {
      // An unassigned mask is drawn again (Pixi resets includeInBuild), so it is emptied too.
      if (this.#container.mask || this.#bolideContainer.mask) {
        this.#container.mask = null;
        this.#bolideContainer.mask = null;
        this.#mask.clear();
        this.#maskRects.length = 0;
      }
      return;
    }
    const count = regions ? regions.count : 0;
    const rects = this.#maskRects;
    let same = rects.length === count * 4;
    for (let index = 0; same && index < count; index += 1) {
      const region = regions.getAt(index), offset = index * 4;
      same = rects[offset] === region.x && rects[offset + 1] === region.y && rects[offset + 2] === region.width &&
        rects[offset + 3] === region.height;
    }
    if (!same) {
      rects.length = count * 4;
      this.#mask.clear();
      for (let index = 0; index < count; index += 1) {
        const region = regions.getAt(index), offset = index * 4;
        rects[offset] = region.x; rects[offset + 1] = region.y; rects[offset + 2] = region.width; rects[offset + 3] = region.height;
        this.#mask.rect(region.x, region.y, region.width, region.height);
      }
      if (count > 0) this.#mask.fill(0xffffff);
    }
    if (this.#container.mask !== this.#mask) this.#container.mask = this.#mask;
    if (this.#bolideContainer.mask !== this.#mask) this.#bolideContainer.mask = this.#mask;
  }

  #insideZone(x, y) {
    for (let zone = 0; zone < this.#zoneCount; zone += 1) {
      const offset = zone * 4;
      const left = this.#zoneRects[offset], top = this.#zoneRects[offset + 1];
      if (x >= left && y >= top && x <= left + this.#zoneRects[offset + 2] && y <= top + this.#zoneRects[offset + 3]) return true;
    }
    return false;
  }

  #ensurePool(size) {
    if (size <= this.#particles.length) return;
    const grow = (array, Type) => { const next = new Type(size); next.set(array); return next; };
    this.#x = grow(this.#x, Float32Array);
    this.#y = grow(this.#y, Float32Array);
    this.#vx = grow(this.#vx, Float32Array);
    this.#vy = grow(this.#vy, Float32Array);
    this.#age = grow(this.#age, Float32Array);
    this.#life = grow(this.#life, Float32Array);
    this.#length = grow(this.#length, Float32Array);
    this.#alive = grow(this.#alive, Uint8Array);
    while (this.#particles.length < size) {
      // Anchored at the head (the texture's right end): the tail stretches back along the flight.
      const particle = new this.#pixi.Particle({ texture: this.#streak, anchorX: 1, anchorY: 0.5, alpha: 0 });
      this.#particles.push(particle);
      this.#container.addParticle(particle);
    }
    this.#container.update();
  }

  #clear() {
    this.#bolide.alive = false;
    this.#bolideContainer.visible = false;
    this.#alive.fill(0);
    this.#count = 0;
    this.#spawnDebt = 0;
  }

  #hide() {
    if (!this.#visible) return false;
    this.#visible = false;
    this.#container.visible = false;
    for (let index = 0; index < this.#particles.length; index += 1) this.#particles[index].alpha = 0;
    return true;
  }

  static #parse(cache, value) {
    const text = typeof value === "string" ? value : "#ffffff";
    if (text === cache.text) return cache;
    return { text, value: parseColor(text) };
  }

  // A soft round glow (the bolide's head), bright in the middle, clear at the edge; drawn once.
  static #drawGlow(documentTarget) {
    const canvas = documentTarget.createElement("canvas");
    canvas.width = GLOW;
    canvas.height = GLOW;
    const context = canvas.getContext("2d");
    const image = context.createImageData(GLOW, GLOW);
    const data = image.data;
    for (let y = 0; y < GLOW; y += 1) {
      for (let x = 0; x < GLOW; x += 1) {
        const distance = Math.hypot(x + 0.5 - GLOW / 2, y + 0.5 - GLOW / 2) / (GLOW / 2);
        const offset = (y * GLOW + x) * 4;
        data[offset] = 255; data[offset + 1] = 255; data[offset + 2] = 255;
        data[offset + 3] = Math.round(255 * Math.max(0, 1 - distance) ** 2);
      }
    }
    context.putImageData(image, 0, 0);
    return canvas;
  }

  // A streak: clear at the left (the tail), bright at the right (the head), soft above and below; drawn once.
  static #drawStreak(documentTarget) {
    const canvas = documentTarget.createElement("canvas");
    canvas.width = STREAK_W;
    canvas.height = STREAK_H;
    const context = canvas.getContext("2d");
    const image = context.createImageData(STREAK_W, STREAK_H);
    const data = image.data;
    for (let y = 0; y < STREAK_H; y += 1) {
      const across = 1 - Math.abs((y + 0.5) / STREAK_H * 2 - 1);
      for (let x = 0; x < STREAK_W; x += 1) {
        const along = (x + 0.5) / STREAK_W;
        const head = along > 0.9 ? 1 : along * along;
        const offset = (y * STREAK_W + x) * 4;
        data[offset] = 255; data[offset + 1] = 255; data[offset + 2] = 255;
        data[offset + 3] = Math.round(255 * head * across * across);
      }
    }
    context.putImageData(image, 0, 0);
    return canvas;
  }
}
