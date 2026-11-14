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
// Drawing (docs/rendering.md 16, 22, 23): two ParticleContainers, one texture each, no filter: the rings right over the
// water (mountSurface), the drops in front of the tackle (mountAir). Fixed pools sized by the settings (they grow only
// when the settings grow); unused particles have alpha 0. Pixi 8 uploads vertex (scale), rotation and color (tint,
// alpha) only when declared dynamic (ParticleBuffer.update), so they are. The scene presents a frame only while a drop
// or a ring is alive.
const STREAK_WIDTH = 4;
const STREAK_HEIGHT = 64;
const RING_SIZE = 64;
const MAX_STEP_SEC = 0.1;
const SLANT_FOLLOW_PER_SEC = 2;
const GUST_FOLLOW_BONUS_PER_SEC = 6;
const GUST_SLANT_SHARE = 1.2;
const MAX_SLANT_DEG = 72;
const DYNAMIC = Object.freeze({ position: true, vertex: true, rotation: true, color: true, uvs: false });

const clamp01 = (value) => (value <= 0 ? 0 : value >= 1 ? 1 : value);
const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const parseColor = (text) => (/^#[0-9a-f]{6}$/iu.test(text) ? Number.parseInt(text.slice(1), 16) : 0xffffff);

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
  #ringRecords = [];
  #ringCount = 0;
  #waterRipples = Object.freeze({ owner: this, get count() { return this.owner.#ringCount; },
    getAt(index) { return this.owner.#ringRecords[index]; } });
  #rippleView = { puffs: this.#waterRipples, settings: null };
  #area = { left: 0, top: 0, right: 0, bottom: 0 };
  // TK-271.2: this frame's world -> screen placement (screen = origin + share x size).
  #view = { x: 0, y: 0, width: 1, height: 1 };
  #lastNow = null;
  #slantDeg = 0;
  #falling = 0;
  #visible = false;
  #stepMs = 0;
  #dropColor = { text: "", value: 0xffffff };
  #ringColor = { text: "", value: 0xffffff };
  // TK-273: the rain zones' visible rectangles (left, top, width, height) and their cumulative areas, rebuilt each
  // frame into arrays that grow only with the number of zones; the mask is redrawn only when the rectangles change.
  #zoned = false;
  #zoneRects = new Float32Array(0);
  #zoneWeights = new Float32Array(0);
  #zoneCount = 0;
  #zoneArea = 0;
  // TK-271.2: the whole rain area on screen (zones or the background below the water); #zoneArea is its visible part.
  #rainArea = 0;
  #mask;
  #maskRects = [];

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
    this.#mask = new pixi.Graphics();
  }

  // The rings go on the water: mounted right after it, under the tackle.
  mountSurface(stage) {
    stage.addChild(this.#surface);
  }

  // The drops go in front of the tackle: mounted after it.
  // Its zone mask lives in the scene for its transform (Pixi does not draw a mask itself).
  mountAir(stage) {
    stage.addChild(this.#air);
    stage.addChild(this.#mask);
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
  // frame's clock; settings: CONFIG.canvas.rain. Returns whether the scene must present a frame.
  update(world, viewWidth, viewHeight, nowMs, settings) {
    const elapsed = this.#lastNow === null ? 0 : Math.min(MAX_STEP_SEC, Math.max(0, (nowMs - this.#lastNow) / 1000));
    this.#lastNow = nowMs;
    // Off the scene or switched off: no drop keeps falling.
    if (!world || settings?.enabled !== true) { this.#clear(); return this.#hide(); }
    const weather = world.weather;
    const rain = clamp01(number(weather?.rain, 0));
    const storm = clamp01(number(weather?.storm, 0));
    const maxDrops = Math.max(0, Math.floor(number(settings?.maxDrops, 0)));
    const stormShare = Math.max(0, number(settings?.stormDropsShare, 0));
    const strength = Math.min(1 + stormShare, rain + storm * stormShare);
    if (strength <= 0 && this.#falling === 0 && this.#ringCount === 0) return this.#hide();
    const started = performance.now();
    const rings = settings?.rings;
    this.#ensurePools(Math.floor(maxDrops * (1 + stormShare)), Math.max(0, Math.floor(number(rings?.maxRings, 0))));
    this.#rippleView.settings = rings?.ripple ?? null;
    this.#dropColor = PixiRainRenderer.#color(this.#dropColor, settings?.color);
    this.#ringColor = PixiRainRenderer.#color(this.#ringColor, rings?.color);
    const windDir = Math.max(-1, Math.min(1, number(weather?.windDirection, 0)));
    const rawWindStrength = weather?.windStrength;
    const windStrength = rawWindStrength !== undefined && rawWindStrength !== null && Number.isFinite(Number(rawWindStrength))
      ? clamp01(Number(rawWindStrength))
      : Math.abs(windDir);
    const windGust = clamp01(number(weather?.windGust, 0));
    const windSlant = Math.max(0, number(settings?.windSlantDeg, 0));
    const stormSlant = Math.max(0, number(settings?.stormSlantDeg, 0));
    const rawSlant = (windStrength + windGust * GUST_SLANT_SHARE) * windSlant + storm * stormSlant;
    const targetSlant = windDir * Math.min(MAX_SLANT_DEG, rawSlant);
    const followPerSec = SLANT_FOLLOW_PER_SEC + Math.min(1, windGust * 3) * GUST_FOLLOW_BONUS_PER_SEC;
    this.#slantDeg += (targetSlant - this.#slantDeg) * Math.min(1, elapsed * followPerSec);
    const area = this.#waterArea(world.clipRegions);
    this.#placeView(world, viewWidth, viewHeight);
    this.#prepareZones(world, area, viewWidth, viewHeight);
    // TK-271.2: the visible share of the whole rain area's drops (none on screen: no new drop; falling ones finish).
    const visibleShare = this.#rainArea > 0 ? Math.min(1, this.#zoneArea / this.#rainArea) : 0;
    const spawning = Math.min(Math.floor(maxDrops * (1 + stormShare)), Math.round(maxDrops * strength * visibleShare));
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
    const fall = Math.max(1, number(settings?.fallPx, 500));
    const speed = Math.max(1, number(settings?.speedPx, 1500));
    const jitter = clamp01(number(settings?.speedJitter, 0.15));
    const length = Math.max(0, number(settings?.lengthPx, 36));
    const width = Math.max(0, number(settings?.widthPx, 1.6));
    const opacity = clamp01(number(settings?.opacity, 0.4));
    const minScale = clamp01(number(settings?.minScale, 0.3));
    const slant = Math.tan(this.#slantDeg * Math.PI / 180);
    const rotation = -Math.atan(slant);
    let falling = 0;
    for (let index = 0; index < this.#drops.length; index += 1) {
      const particle = this.#drops[index];
      if (!this.#dropActive[index]) {
        if (index >= target) { particle.alpha = 0; continue; }
        // A new drop starts somewhere along its fall, so a rising rain does not arrive in one wave.
        this.#spawnDrop(index, world, area, viewWidth, viewHeight, minScale, fall, speed, jitter);
        this.#dropAge[index] = this.#random() * this.#dropLife[index];
      } else {
        this.#dropAge[index] += elapsed;
        if (this.#dropAge[index] >= this.#dropLife[index]) {
          this.#impact(index, world);
          if (index >= target) { this.#dropActive[index] = 0; particle.alpha = 0; continue; }
          this.#spawnDrop(index, world, area, viewWidth, viewHeight, minScale, fall, speed, jitter);
        }
      }
      const scale = this.#dropScale[index];
      const left = 1 - this.#dropAge[index] / this.#dropLife[index];
      const distance = left * fall * scale;
      particle.x = this.#screenX(this.#dropU[index]) - distance * slant;
      particle.y = this.#screenY(this.#dropV[index]) - distance;
      particle.rotation = rotation;
      particle.scaleX = width * scale / STREAK_WIDTH;
      particle.scaleY = length * scale / STREAK_HEIGHT;
      particle.alpha = opacity * (0.55 + 0.45 * scale);
      particle.tint = this.#dropColor.value;
      falling += 1;
    }
    this.#falling = falling;
  }

  #spawnDrop(index, world, area, viewWidth, viewHeight, minScale, fall, speed, jitter) {
    // A visible part of the rain area by its size, then a point inside it, kept as shares of the background.
    const pick = this.#random() * this.#zoneArea;
    let zone = 0;
    while (zone < this.#zoneCount - 1 && this.#zoneWeights[zone] < pick) zone += 1;
    const offset = zone * 4;
    const x = this.#zoneRects[offset] + this.#random() * this.#zoneRects[offset + 2];
    const y = this.#zoneRects[offset + 1] + this.#random() * this.#zoneRects[offset + 3];
    const view = this.#view;
    this.#dropU[index] = (x - view.x) / view.width;
    this.#dropV[index] = (y - view.y) / view.height;
    this.#dropScale[index] = this.#scaleAt(y, world, area, minScale, viewHeight);
    this.#dropLife[index] = (fall / speed) * (1 + (this.#random() * 2 - 1) * jitter);
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
    const x = this.#screenX(this.#dropU[index]), y = this.#screenY(this.#dropV[index]);
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
    const lifeSec = Math.max(0.05, number(settings?.lifeSec, 0.7));
    const size = Math.max(0, number(settings?.sizePx, 16));
    const opacity = clamp01(number(settings?.opacity, 0.4));
    const flatten = clamp01(number(settings?.flatten, 0.35));
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
      record.x = this.#screenX(record.u);
      record.y = this.#screenY(record.v);
      const particle = this.#rings[index];
      particle.x = record.x;
      particle.y = record.y;
      particle.rotation = 0;
      particle.scaleX = diameter / RING_SIZE;
      particle.scaleY = diameter * flatten / RING_SIZE;
      particle.alpha = show ? opacity * (1 - record.life) : 0;
      particle.tint = this.#ringColor.value;
      index += 1;
    }
    for (let rest = this.#ringCount; rest < this.#rings.length; rest += 1) this.#rings[rest].alpha = 0;
  }

  // TK-271.2: the frame's placement of world points: the background's rectangle on screen, or the screen without one.
  #placeView(world, viewWidth, viewHeight) {
    const layers = world.backgroundLayers;
    const background = layers && layers.count > 0 ? layers.getAt(0) : null;
    const view = this.#view;
    if (background && background.width > 0 && background.height > 0) {
      view.x = background.x; view.y = background.y; view.width = background.width; view.height = background.height;
    } else {
      view.x = 0; view.y = 0; view.width = Math.max(1, viewWidth); view.height = Math.max(1, viewHeight);
    }
  }

  #screenX(share) {
    return this.#view.x + share * this.#view.width;
  }

  #screenY(share) {
    return this.#view.y + share * this.#view.height;
  }

  // The rain area on screen: the rain zones (TK-273), or without them the background (the screen without one) from the
  // water's far edge down; its visible parts with cumulative sizes for picking, the whole area for the density
  // (TK-271.2), and the drops' mask (redrawn only when the zones' screen rectangles change; none without zones).
  #prepareZones(world, area, viewWidth, viewHeight) {
    this.#zoned = world.rainZoned === true;
    const regions = world.rainRegions;
    const count = this.#zoned ? (regions ? regions.count : 0) : 1;
    if (this.#zoneRects.length < count * 4) {
      this.#zoneRects = new Float32Array(count * 4);
      this.#zoneWeights = new Float32Array(count);
    }
    let whole = 0, total = 0, visible = 0;
    for (let index = 0; index < count; index += 1) {
      let rectX, rectY, rectWidth, rectHeight;
      if (this.#zoned) {
        const rect = regions.getAt(index);
        rectX = rect.x; rectY = rect.y; rectWidth = rect.width; rectHeight = rect.height;
      } else {
        const view = this.#view;
        const top = area ? area.top : view.y + view.height * 0.35;
        rectX = view.x; rectY = top; rectWidth = view.width; rectHeight = view.y + view.height - top;
      }
      if (!(rectWidth > 0 && rectHeight > 0)) continue;
      whole += rectWidth * rectHeight;
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
    this.#rainArea = whole;
    this.#updateMask(this.#zoned ? regions : null, this.#zoned ? count : 0);
  }

  #updateMask(regions, count) {
    if (!regions) {
      // An unassigned mask is drawn again (Pixi resets includeInBuild), so it is emptied too.
      if (this.#air.mask) { this.#air.mask = null; this.#mask.clear(); this.#maskRects.length = 0; }
      return;
    }
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
    if (this.#air.mask !== this.#mask) this.#air.mask = this.#mask;
  }

  // The castable zones' bounding box (reused), or null.
  #waterArea(regions) {
    if (!regions || regions.count === 0) return null;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (let index = 0; index < regions.count; index += 1) {
      const region = regions.getAt(index);
      left = Math.min(left, region.x);
      top = Math.min(top, region.y);
      right = Math.max(right, region.x + region.width);
      bottom = Math.max(bottom, region.y + region.height);
    }
    if (!(right > left && bottom > top)) return null;
    const area = this.#area;
    area.left = left; area.top = top; area.right = right; area.bottom = bottom;
    return area;
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

  static #color(cache, value) {
    const text = typeof value === "string" ? value : "#ffffff";
    if (text === cache.text) return cache;
    return { text, value: parseColor(text) };
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
