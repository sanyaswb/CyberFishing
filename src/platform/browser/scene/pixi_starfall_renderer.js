// Spec 182 stage C (TK-352): the starfall's ordinary stars on the WebGL scene.
// - A star is a short bright streak: its head flies along a steep slant (angleDeg below the horizon ± angleJitterDeg,
//   to the left or the right), its tail grows to lengthPx behind it, it flares in fast and fades over its last share of
//   life. One streak texture (a bright head fading to a clear tail) is drawn once in code; each star is a particle
//   anchored at its head, rotated along its flight and stretched to its tail's length.
// - How many: perMinute [at strength 0, at 1] over the whole sky (TK-355, like the rain: the sky zones whole, or the
//   background's top third) × the share of it on screen, so a narrow phone screen shows fewer at the same density, at
//   the night's strength (world.weather.starfall, StarfallNight: rises and falls through the night). Stars start at
//   random moments (an accumulator of the rate, so the count follows the strength without a fixed rhythm) at a random
//   point of a visible sky zone (world.skyRegions, picked by area; with the switch off — the background's top third).
// - TK-356, TK-356.1: with sky zones one Graphics mask on ONE layer (#layer: the stars' ParticleContainer and the
//   bolide's Container) clips tails and glow at the zones' edges — one stencil pass a frame, and the mask belongs to one
//   effect (Pixi 8 turns a mask's includeInBuild back on when any container drops it, so a mask shared by two layers
//   could be drawn as content). It is redrawn only when the sky rectangles change. A star whose head leaves the zone
//   still starts its fade there, so it does not fly on unseen behind the mask. With the switch off there is no mask:
//   the stars may cross the land.
// - Stage D (TK-353), the bolide: when the night's bolideSerial changes (StarfallNight: at most one a night, at any
//   moment, quiet stretches too) one big star falls: a long tail (bolide.lengthPx), wider, brighter, slower and longer
//   than the others (bolide.lifeSec), with a glowing head (bolide.glowPx) that flickers a little; it starts in a
//   visible sky zone (none on screen: it is skipped) and fades like the others. Two sprites of its own (the streak and a
//   glow drawn once), additive, in front of the ordinary stars, in the same masked layer.
// - TK-357 (owner), the bolide's burst: with bolide.burst.chance it burns out before it leaves the sky, at a random
//   share of its whole path in burst.atShare (never before 20 % by default): its head flares (burst.flashPx, over
//   burst.flashSec) and is gone; the tail stops where it is and fades smoothly (burst.tailFadeSec); sparks fly off the
//   flare (burst.particles, speed, life, size: a fixed pool of glow particles, drag and a little gravity, shrinking and
//   fading). A bolide that leaves the sky before its moment does not burst (it is clipped and fades as before).
// Drawing (docs/rendering.md 16, 22, 23): one ParticleContainer, one texture, additive blend, no filter; a fixed pool
// sized by the settings (it grows only when they grow); unused particles have alpha 0. Frames only while a star flies.
import { clampUnit, finiteOr, pairBetween, pairValue } from "../../../engine/math/number_normalization.js";
import { BackgroundPlacement } from "./background_placement.js";
import { SceneColor } from "./scene_color.js";
import { ScreenZoneSet } from "./screen_zone_set.js";
import { ZoneRectMask } from "./zone_rect_mask.js";

const STREAK_W = 64;
const GLOW = 32;
const STREAK_H = 8;
const MAX_STEP_SEC = 0.1;
const MAX_POOL = 96;
// TK-357: the bolide's burst sparks (one pool, the glow texture).
const MAX_SPARKS = 32;
const SPARK_DRAG_PER_SEC = 2.2;
const SPARK_GRAVITY_PX = 60;
const DYNAMIC = Object.freeze({ position: true, vertex: true, rotation: true, color: true, uvs: false });

const NO_REGIONS = Object.freeze({ count: 0, getAt: () => null });

export class PixiStarfallRenderer {
  #pixi;
  #random;
  #streak;
  #glow;
  // TK-356.1: the stars and the bolide in one layer, masked once.
  #layer;
  #container;
  #bolideContainer;
  #bolideTail;
  #bolideHead;
  #bolide = { alive: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, length: 0, phase: 0,
    // TK-357: the burst — planned (burstAt, s of its life; Infinity: none), then running (burstAge) with the tail's
    // alpha and length frozen at the flare.
    burstAt: Infinity, bursting: false, burstAge: 0, tailAlpha: 0, tailLength: 0, sparksLeft: 0, flashColor: 0xffffff };
  #sparks;
  #sparkParticles = [];
  #sx = new Float32Array(MAX_SPARKS);
  #sy = new Float32Array(MAX_SPARKS);
  #svx = new Float32Array(MAX_SPARKS);
  #svy = new Float32Array(MAX_SPARKS);
  #sage = new Float32Array(MAX_SPARKS);
  #slife = new Float32Array(MAX_SPARKS);
  #ssize = new Float32Array(MAX_SPARKS);
  #flashColor = new SceneColor();
  #bolideSerial = null;
  #bolideColor = new SceneColor();
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
  #color = new SceneColor();
  #colorValue = 0xffffff;
  // TK-358: the sky on screen (its zones, or the background's top third) and its mask on the stars' layer.
  #zones = new ScreenZoneSet();
  #background = new BackgroundPlacement();
  #point = { x: 0, y: 0 };
  #mask;

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
    this.#sparks = new pixi.ParticleContainer({ texture: this.#glow, dynamicProperties: DYNAMIC });
    this.#sparks.blendMode = "add";
    this.#sparks.visible = false;
    for (let index = 0; index < MAX_SPARKS; index += 1) {
      const particle = new pixi.Particle({ texture: this.#glow, anchorX: 0.5, anchorY: 0.5, alpha: 0 });
      this.#sparkParticles.push(particle);
      this.#sparks.addParticle(particle);
    }
    this.#sparks.update();
    this.#layer = new pixi.Container();
    this.#layer.addChild(this.#container, this.#bolideContainer, this.#sparks);
    this.#mask = new ZoneRectMask({ pixi, target: this.#layer });
  }

  // Right over the background's sky, under the water and everything in the world (rendering.md 14).
  mount(stage) {
    stage.addChild(this.#layer);
    // The mask lives in the scene for its transform (Pixi does not draw a mask itself).
    this.#mask.mount(stage);
  }

  get status() {
    return { active: this.#visible, stars: this.#count, pool: this.#particles.length,
      bolide: this.#bolide.alive || this.#bolide.bursting, burst: this.#bolide.bursting, sparks: this.#bolide.sparksLeft };
  }

  // world: the frame's world model (null: not on the scene); viewWidth / viewHeight: the logical screen; nowMs: the
  // frame's clock; settings: CONFIG.canvas.starfall. Returns whether the scene must present a frame.
  update(world, viewWidth, viewHeight, nowMs, settings) {
    const elapsed = this.#lastNow === null ? 0 : Math.min(MAX_STEP_SEC, Math.max(0, (nowMs - this.#lastNow) / 1000));
    this.#lastNow = nowMs;
    // A bolide falls when the night's serial changes (the first frame only takes the serial as it is).
    const serial = finiteOr(world?.weather?.bolideSerial, 0);
    const bolideDue = this.#bolideSerial !== null && serial !== this.#bolideSerial;
    if (world) this.#bolideSerial = serial;
    if (!world || settings?.enabled !== true) { this.#clear(); return this.#hide(); }
    const strength = clampUnit(finiteOr(world.weather?.starfall, 0));
    if (strength <= 0 && this.#count === 0 && !this.#bolide.alive && !this.#bolide.bursting && !bolideDue) {
      this.#spawnDebt = 0;
      return this.#hide();
    }
    this.#prepareZones(world, viewWidth, viewHeight);
    if (bolideDue && this.#zones.count > 0) this.#spawnBolide(settings);
    const bolideFlying = this.#updateBolide(elapsed, settings);
    const lifeMax = Math.max(0.1, pairValue(settings.lifeSec, 1, 0.9));
    const perMinuteMax = Math.max(0, pairValue(settings.perMinute, 1, 30));
    this.#ensurePool(Math.min(MAX_POOL, Math.ceil(perMinuteMax / 60 * lifeMax * 2) + 4));
    this.#colorValue = this.#color.read(settings.color);
    const low = Math.max(0, pairValue(settings.perMinute, 0, 0));
    const zones = this.#zones;
    const share = zones.wholeArea > 0 ? Math.min(1, zones.visibleArea / zones.wholeArea) : 0;
    const rate = strength > 0 && zones.count > 0 ? (low + (perMinuteMax - low) * strength) / 60 * share : 0;
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
    const opacity = clampUnit(finiteOr(settings.opacity, 0.9));
    const fade = clampUnit(finiteOr(settings.fadeShare, 0.4));
    const widthPx = Math.max(0.5, finiteOr(settings.widthPx, 2));
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
      if (this.#age[index] < life * (1 - fade) && !this.#zones.contains(this.#x[index], this.#y[index])) {
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
      particle.alpha = opacity * flare * clampUnit(envelope);
      particle.tint = this.#colorValue;
      alive += 1;
    }
    // A debt the pool could not take now waits at most one star.
    this.#spawnDebt = Math.min(this.#spawnDebt, 1);
    this.#count = alive;
  }

  #spawn(index, settings) {
    const random = this.#random;
    const point = this.#point;
    this.#zones.pick(random, point);
    this.#x[index] = point.x;
    this.#y[index] = point.y;
    const jitter = finiteOr(settings.angleJitterDeg, 12) * (2 * random() - 1);
    const angle = (finiteOr(settings.angleDeg, 35) + jitter) * Math.PI / 180;
    const side = random() < 0.5 ? -1 : 1;
    const speed = pairBetween(settings.speedPx, 500, 900, random());
    this.#vx[index] = side * Math.cos(angle) * speed;
    this.#vy[index] = Math.sin(angle) * speed;
    this.#length[index] = pairBetween(settings.lengthPx, 60, 140, random());
    this.#life[index] = pairBetween(settings.lifeSec, 0.4, 0.9, random());
    this.#age[index] = 0;
    this.#alive[index] = 1;
  }

  // Stage D: the bolide starts in the upper half of a visible sky zone, on a shallower slant than the stars.
  #spawnBolide(settings) {
    const random = this.#random;
    const look = settings.bolide ?? {};
    const bolide = this.#bolide;
    this.#zones.pick(random, bolide, 0.5);
    const angle = finiteOr(look.angleDeg, 22) * Math.PI / 180;
    const speed = pairBetween(look.speedPx, 250, 400, random());
    const side = random() < 0.5 ? -1 : 1;
    bolide.vx = side * Math.cos(angle) * speed;
    bolide.vy = Math.sin(angle) * speed;
    bolide.length = pairBetween(look.lengthPx, 300, 500, random());
    bolide.life = pairBetween(look.lifeSec, 2.2, 3.2, random());
    bolide.age = 0;
    bolide.phase = random() * Math.PI * 2;
    // TK-357: whether it burns out early, and when (a share of its whole path; never before atShare[0]).
    const burst = look.burst ?? {};
    const bursts = random() < clampUnit(finiteOr(burst.chance, 0));
    bolide.burstAt = bursts ? bolide.life * clampUnit(pairBetween(burst.atShare, 0.2, 0.9, random())) : Infinity;
    bolide.bursting = false;
    bolide.alive = true;
  }

  // Returns whether the bolide is in the air this frame (or just went out).
  #updateBolide(elapsed, settings) {
    const bolide = this.#bolide;
    if (bolide.bursting) return this.#updateBurst(elapsed, settings);
    if (!bolide.alive) {
      if (this.#bolideContainer.visible) { this.#bolideContainer.visible = false; return true; }
      return false;
    }
    const look = settings.bolide ?? {};
    const fade = clampUnit(finiteOr(settings.fadeShare, 0.4));
    bolide.age += elapsed;
    if (bolide.age >= bolide.life) { bolide.alive = false; this.#bolideContainer.visible = false; return true; }
    bolide.x += bolide.vx * elapsed;
    bolide.y += bolide.vy * elapsed;
    if (bolide.age < bolide.life * (1 - fade) && !this.#zones.contains(bolide.x, bolide.y)) {
      bolide.age = bolide.life * (1 - fade);
      bolide.burstAt = Infinity; // it left the sky first: no burst
    }
    const share = bolide.age / bolide.life;
    const flare = Math.min(1, share / 0.05);
    const envelope = share > 1 - fade ? (1 - share) / Math.max(1e-6, fade) : 1;
    const alpha = clampUnit(finiteOr(look.opacity, 1)) * flare * clampUnit(envelope);
    const bolideColor = this.#bolideColor.read(look.color);
    const speed = Math.hypot(bolide.vx, bolide.vy);
    const tail = this.#bolideTail;
    tail.x = bolide.x;
    tail.y = bolide.y;
    tail.rotation = Math.atan2(bolide.vy, bolide.vx);
    tail.scale.set(Math.max(0.01, Math.min(bolide.length, speed * bolide.age) / STREAK_W),
      Math.max(0.5, finiteOr(look.widthPx, 5)) / STREAK_H);
    tail.alpha = alpha;
    tail.tint = bolideColor;
    const head = this.#bolideHead;
    const flicker = 1 + 0.12 * Math.sin(bolide.age * 23 + bolide.phase);
    head.x = bolide.x;
    head.y = bolide.y;
    head.scale.set(Math.max(1, finiteOr(look.glowPx, 28)) / GLOW * flicker);
    head.alpha = alpha;
    head.tint = bolideColor;
    this.#bolideContainer.visible = true;
    if (bolide.age >= bolide.burstAt) this.#startBurst(look, tail.alpha, Math.min(bolide.length, speed * bolide.age));
    return true;
  }

  // TK-357: the flare — the head is gone, the tail freezes, the sparks fly off from the head's point.
  #startBurst(look, tailAlpha, tailLength) {
    const bolide = this.#bolide;
    const burst = look.burst ?? {};
    bolide.alive = false;
    bolide.bursting = true;
    bolide.burstAge = 0;
    bolide.tailAlpha = tailAlpha;
    bolide.tailLength = tailLength;
    bolide.flashColor = this.#flashColor.read(burst.color);
    const random = this.#random;
    const low = Math.max(0, Math.floor(pairValue(burst.particles, 0, 10)));
    const high = Math.max(low, Math.floor(pairValue(burst.particles, 1, 18)));
    const count = Math.min(MAX_SPARKS, low + Math.floor(random() * (high - low + 1)));
    const heading = Math.atan2(bolide.vy, bolide.vx);
    for (let index = 0; index < MAX_SPARKS; index += 1) {
      if (index >= count) { this.#slife[index] = 0; this.#sage[index] = 1; continue; }
      // Mostly forward (the bolide's momentum), some to the sides and back.
      const angle = heading + (random() * 2 - 1) * Math.PI * (random() < 0.7 ? 0.45 : 1);
      const speed = pairBetween(burst.particleSpeedPx, 60, 220, random());
      this.#sx[index] = bolide.x;
      this.#sy[index] = bolide.y;
      this.#svx[index] = Math.cos(angle) * speed + bolide.vx * 0.25;
      this.#svy[index] = Math.sin(angle) * speed + bolide.vy * 0.25;
      this.#sage[index] = 0;
      this.#slife[index] = pairBetween(burst.particleLifeSec, 0.4, 1.1, random());
      this.#ssize[index] = pairBetween(burst.particleSizePx, 2, 5, random());
    }
    bolide.sparksLeft = count;
    this.#sparks.visible = true;
  }

  // TK-357: the flare grows and fades, the frozen tail fades, the sparks slow, fall a little, shrink and fade.
  #updateBurst(elapsed, settings) {
    const bolide = this.#bolide;
    const look = settings.bolide ?? {};
    const burst = look.burst ?? {};
    bolide.burstAge += elapsed;
    const t = bolide.burstAge;
    const flashSec = Math.max(0.05, finiteOr(burst.flashSec, 0.35));
    const tailFadeSec = Math.max(0.05, finiteOr(burst.tailFadeSec, 1.4));
    const flash = clampUnit(t / flashSec);
    const head = this.#bolideHead;
    const glowPx = Math.max(1, finiteOr(look.glowPx, 28));
    const flashPx = Math.max(glowPx, finiteOr(burst.flashPx, 90));
    head.scale.set((glowPx + (flashPx - glowPx) * Math.sqrt(flash)) / GLOW);
    head.alpha = clampUnit(finiteOr(look.opacity, 1)) * (1 - flash) * (1 - flash);
    head.tint = bolide.flashColor;
    const tail = this.#bolideTail;
    const tailShare = clampUnit(t / tailFadeSec);
    tail.alpha = bolide.tailAlpha * (1 - tailShare * tailShare * (3 - 2 * tailShare));
    tail.scale.set(Math.max(0.01, bolide.tailLength / STREAK_W), tail.scale.y);
    const drag = Math.exp(-SPARK_DRAG_PER_SEC * elapsed);
    let sparks = 0;
    for (let index = 0; index < MAX_SPARKS; index += 1) {
      const particle = this.#sparkParticles[index];
      const life = this.#slife[index];
      this.#sage[index] += elapsed;
      if (life <= 0 || this.#sage[index] >= life) { particle.alpha = 0; continue; }
      this.#svx[index] *= drag;
      this.#svy[index] = this.#svy[index] * drag + SPARK_GRAVITY_PX * elapsed;
      this.#sx[index] += this.#svx[index] * elapsed;
      this.#sy[index] += this.#svy[index] * elapsed;
      const left = 1 - this.#sage[index] / life;
      particle.x = this.#sx[index];
      particle.y = this.#sy[index];
      const scale = this.#ssize[index] * (0.4 + 0.6 * left) / GLOW * 2;
      particle.scaleX = scale;
      particle.scaleY = scale;
      particle.alpha = clampUnit(finiteOr(look.opacity, 1)) * left;
      particle.tint = bolide.flashColor;
      sparks += 1;
    }
    bolide.sparksLeft = sparks;
    if (flash >= 1 && tailShare >= 1 && sparks === 0) {
      bolide.bursting = false;
      this.#bolideContainer.visible = false;
      this.#sparks.visible = false;
    }
    return true;
  }

  // The sky zones' visible parts (masked; redrawn only when they change), or without zones the background's top third.
  #prepareZones(world, viewWidth, viewHeight) {
    const zoned = world.skyZoned === true;
    const regions = world.skyRegions ?? NO_REGIONS;
    if (!zoned) {
      const view = this.#background.place(world, viewWidth, viewHeight), fallback = this.#zones.fallback;
      fallback.x = view.x; fallback.y = view.y; fallback.width = view.width; fallback.height = view.height / 3;
    }
    this.#zones.prepare(zoned ? regions : null, viewWidth, viewHeight);
    if (zoned) this.#mask.clipTo(regions);
    else this.#mask.release();
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
    this.#bolide.bursting = false;
    this.#bolide.sparksLeft = 0;
    this.#sparks.visible = false;
    for (const particle of this.#sparkParticles) particle.alpha = 0;
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
