// Spec 188 stage A (TK-406): a procedural lightning strike on the WebGL scene.
// - When world.weather.strikeSerial changes (WeatherModel: the storm's strikes, DevTools «Блискавка») one bolt strikes
//   in a visible sky zone (SkySceneZones: the sky zones, or the background's top third; none on screen — skipped): from
//   near the zone's top down to its bottom (the horizon), drifting sideways; a far strike (world.weather.strikeDistance
//   toward 1) is shorter (its top lower), thinner and dimmer (settings.far).
// - Its shape is BranchingBolt's (engine/geometry): a jagged channel and a few branches, new for every strike.
// - Each segment is drawn twice, a wide soft glow under a thin core: a particle of a round texture stretched along the
//   segment (its length plus its width, so neighbours melt at the joints). A glow sprite at the top lights the cloud it
//   leaves. Additive, no filter. The particles' position, rotation and size are static properties written once per
//   strike (Pixi 8 uploads a ParticleContainer's static properties only after update()); each frame writes only the
//   alpha (the color property, dynamic).
// - Time (TK-406.1): a strike is seen for durationSec; 2–4 return strokes (settings.strokes) in its first strokesShare,
//   each a flash that dies fast (strokeDecaySec); after the last one the channel glows faintly (afterglow) and goes out
//   by the end; branches fade sooner (branchFadeSec). Frames only while a strike lasts.
// - Drawing (docs/rendering.md 16, 19, 22, 23): two 32 px textures drawn once in code, fixed pools of the largest bolt
//   the generator makes, its own masked layer (TK-356.1: one mask per layer).
// - R19: the bolt belongs to the sky, not to the screen — while it lasts its layer moves with the background (a camera
//   move carries it), and the zones' mask follows the zones (redrawn only when they change).
import { BRANCHING_BOLT_MAX_SEGMENTS, BranchingBolt } from "../../../engine/geometry/branching_bolt.js";
import { clampUnit, finiteOr, pairBetween, pairValue } from "../../../engine/math/number_normalization.js";
import { BackgroundPlacement } from "./background_placement.js";
import { SceneColor } from "./scene_color.js";
import { SkySceneZones } from "./sky_scene_zones.js";

const TEXTURE = 32;
const MAX_STEP_SEC = 0.1;
const MAX_STROKES = 6;
// The bolt starts this share of its zone below the zone's top (out of the cloud's edge).
const TOP_INSET = 0.04;
// A segment's stroke fades a little along the channel: the bottom is this share of the top's brightness.
const BOTTOM_SHARE = 0.75;
// How far the jagged channel reaches sideways from its straight line, a share of its length (roughness 0.28, 6 passes).
const EDGE_REACH = 0.12;
// The shortest strike, s (a few frames).
const MIN_LIFE_SEC = 0.05;
const STATIC = Object.freeze({ position: false, vertex: false, rotation: false, color: true, uvs: false });

export class PixiLightningRenderer {
  #pixi;
  #random;
  #soft;
  #core;
  #layer;
  #glowContainer;
  #coreContainer;
  #cloud;
  #glowParticles = [];
  #coreParticles = [];
  #sky;
  #bolt = new BranchingBolt();
  // Per segment: its share down the channel (0 top … 1 bottom) for the fade along it.
  #down = new Float32Array(BRANCHING_BOLT_MAX_SEGMENTS);
  #strokeAt = new Float32Array(MAX_STROKES);
  #strokeLevel = new Float32Array(MAX_STROKES);
  #strokes = 0;
  #age = 0;
  #life = 0;
  #alive = false;
  #shown = false;
  #opacity = 1;
  #serial = null;
  #strikeCount = 0;
  #lastNow = null;
  #point = { x: 0, y: 0 };
  #bounds = { x: 0, y: 0, width: 0, height: 0 };
  // Where the background lay on screen at the strike (the layer moves by its shift since then).
  #background = new BackgroundPlacement();
  #anchorX = 0;
  #anchorY = 0;
  #coreColor = new SceneColor();
  #glowColor = new SceneColor();

  // documentTarget: makes the textures' canvases; random: () => 0…1 (visual only).
  constructor({ pixi, documentTarget, random = Math.random }) {
    if (typeof pixi?.ParticleContainer !== "function" || typeof pixi?.Particle !== "function") {
      throw new TypeError("PixiLightningRenderer requires pixi.ParticleContainer and pixi.Particle");
    }
    if (typeof random !== "function") throw new TypeError("PixiLightningRenderer requires random");
    this.#pixi = pixi;
    this.#random = random;
    this.#soft = pixi.Texture.from(PixiLightningRenderer.#drawRound(documentTarget, 2), true);
    this.#core = pixi.Texture.from(PixiLightningRenderer.#drawRound(documentTarget, 0.6), true);
    this.#glowContainer = this.#pool(this.#soft, this.#glowParticles);
    this.#coreContainer = this.#pool(this.#core, this.#coreParticles);
    this.#cloud = new pixi.Sprite(this.#soft);
    this.#cloud.anchor.set(0.5, 0.5);
    this.#cloud.blendMode = "add";
    this.#cloud.alpha = 0;
    this.#layer = new pixi.Container();
    this.#layer.visible = false;
    this.#layer.addChild(this.#cloud, this.#glowContainer, this.#coreContainer);
    this.#sky = new SkySceneZones({ pixi, target: this.#layer });
  }

  // Right after the starfall: over the background's sky, under the water and the whole world (rendering.md 14).
  mount(stage) {
    stage.addChild(this.#layer);
    this.#sky.mount(stage);
  }

  get status() {
    return { active: this.#alive, segments: this.#alive ? this.#bolt.count : 0, strikes: this.#strikeCount };
  }

  // world: the frame's world model (null: not on the scene); viewWidth / viewHeight: the logical screen; nowMs: the
  // frame's clock; settings: CONFIG.canvas.lightning. Returns whether the scene must present a frame.
  update(world, viewWidth, viewHeight, nowMs, settings) {
    const elapsed = this.#lastNow === null ? 0 : Math.min(MAX_STEP_SEC, Math.max(0, (nowMs - this.#lastNow) / 1000));
    this.#lastNow = nowMs;
    // A strike when the serial changes (the first frame only takes the serial as it is).
    const serial = finiteOr(world?.weather?.strikeSerial, 0);
    const due = this.#serial !== null && serial !== this.#serial;
    if (world) this.#serial = serial;
    if (!world || settings?.enabled !== true) {
      this.#alive = false;
      return this.#hide();
    }
    if (due) {
      this.#sky.prepare(world, viewWidth, viewHeight);
      const distance = clampUnit(finiteOr(world.weather?.strikeDistance, 0));
      if (this.#strike(world, viewWidth, viewHeight, distance, settings)) this.#strikeCount += 1;
    }
    if (!this.#alive) return this.#hide();
    this.#age += elapsed;
    if (this.#age >= this.#life) {
      this.#alive = false;
      return this.#hide();
    }
    if (!due) this.#sky.prepare(world, viewWidth, viewHeight);
    const view = this.#background.place(world, viewWidth, viewHeight);
    this.#layer.x = view.x - this.#anchorX;
    this.#layer.y = view.y - this.#anchorY;
    this.#paint(settings);
    this.#shown = true;
    this.#layer.visible = true;
    return true;
  }

  dispose() {
    this.#soft.destroy(true);
    this.#core.destroy(true);
  }

  // A new bolt in a visible sky zone; false when no sky is on screen.
  #strike(world, viewWidth, viewHeight, distance, settings) {
    const random = this.#random;
    const zones = this.#sky.zones;
    if (!zones.pick(random, this.#point) || !zones.boundsAt(this.#point.x, this.#point.y, this.#bounds)) return false;
    const zone = this.#bounds;
    const far = settings.far ?? {};
    const lengthShare = 1 - distance * (1 - clampUnit(finiteOr(far.lengthShare, 0.45)));
    const bottom = zone.y + zone.height;
    const top = bottom - (zone.height * (1 - TOP_INSET)) * lengthShare;
    const length = bottom - top;
    const drift = pairBetween(settings.driftShare, 0.08, 0.3, random()) * length * (random() < 0.5 ? -1 : 1);
    // Away from the zone's sides by the channel's sideways reach, so the mask does not cut the bolt along its side.
    const margin = Math.min(zone.width / 2, Math.abs(drift) + length * EDGE_REACH);
    const x0 = Math.max(zone.x + margin, Math.min(zone.x + zone.width - margin, this.#point.x));
    const x1 = Math.max(zone.x, Math.min(zone.x + zone.width, x0 + drift));
    const bolt = this.#bolt.build(random, x0, top, x1, bottom, {
      generations: settings.generations, roughness: settings.roughness, branches: settings.branches,
      branchLengthShare: settings.branchLengthShare, branchAngleDeg: settings.branchAngleDeg });
    const widthScale = 1 - distance * (1 - clampUnit(finiteOr(far.widthShare, 0.5)));
    this.#opacity = 1 - distance * (1 - clampUnit(finiteOr(far.opacityShare, 0.45)));
    const coreWidth = Math.max(0.5, finiteOr(settings.coreWidthPx, 2)) * widthScale;
    const glowWidth = Math.max(coreWidth, finiteOr(settings.glowWidthPx, 14)) * widthScale;
    const branchWidth = clampUnit(finiteOr(settings.branchWidthShare, 0.55));
    for (let index = 0; index < BRANCHING_BOLT_MAX_SEGMENTS; index += 1) {
      const glow = this.#glowParticles[index], core = this.#coreParticles[index];
      if (index >= bolt.count) { glow.alpha = 0; core.alpha = 0; continue; }
      const ax = bolt.ax[index], ay = bolt.ay[index], bx = bolt.bx[index], by = bolt.by[index];
      const segment = Math.hypot(bx - ax, by - ay);
      const rotation = Math.atan2(by - ay, bx - ax);
      const share = bolt.branch[index] ? branchWidth : 1;
      this.#down[index] = clampUnit(((ay + by) / 2 - top) / Math.max(1, length));
      PixiLightningRenderer.#place(glow, ax, ay, bx, by, rotation, segment, glowWidth * share);
      PixiLightningRenderer.#place(core, ax, ay, bx, by, rotation, segment, coreWidth * share);
    }
    // Static properties go to the GPU only after update() (Pixi 8 ParticleContainer: _childrenDirty).
    this.#glowContainer.update();
    this.#coreContainer.update();
    const cloudPx = Math.max(1, finiteOr(settings.cloudGlowPx, 140)) * widthScale;
    this.#cloud.x = x0;
    this.#cloud.y = top;
    this.#cloud.scale.set(cloudPx / TEXTURE);
    this.#planStrokes(settings);
    const view = this.#background.place(world, viewWidth, viewHeight);
    this.#anchorX = view.x;
    this.#anchorY = view.y;
    this.#age = 0;
    this.#alive = true;
    return true;
  }

  // TK-406.1: the strike is seen for durationSec (random within it). The return strokes fill its first strokesShare —
  // the first at once at full brightness, the others at random moments spread over that part, each at its own level —
  // and the afterglow fades from the last one to the very end.
  #planStrokes(settings) {
    const random = this.#random;
    const low = Math.max(1, Math.round(pairValue(settings.strokes, 0, 2)));
    const high = Math.max(low, Math.round(pairValue(settings.strokes, 1, 4)));
    this.#strokes = Math.min(MAX_STROKES, low + Math.floor(random() * (high - low + 1)));
    this.#life = Math.max(MIN_LIFE_SEC, pairBetween(settings.durationSec, 0.5, 0.9, random()));
    const window = this.#life * Math.max(0.05, clampUnit(finiteOr(settings.strokesShare, 0.6)));
    const slot = this.#strokes > 1 ? window / (this.#strokes - 1) : 0;
    for (let index = 0; index < this.#strokes; index += 1) {
      // Each later stroke lands within its own slot of the window (±40 % of a slot), so they stay in order.
      const jitter = index === 0 ? 0 : (random() - 0.5) * 0.8 * slot;
      this.#strokeAt[index] = index === 0 ? 0 : Math.min(window, slot * index + jitter);
      this.#strokeLevel[index] = index === 0 ? 1 : clampUnit(pairBetween(settings.strokeLevel, 0.55, 1, random()));
    }
  }

  // The brightness now (0…1): the strongest stroke's flash, and after the last one the afterglow fading to the end.
  #intensity(settings) {
    const age = this.#age;
    const decay = Math.max(0.01, finiteOr(settings.strokeDecaySec, 0.06));
    let level = 0;
    for (let index = 0; index < this.#strokes; index += 1) {
      const since = age - this.#strokeAt[index];
      if (since < 0) break;
      level = Math.max(level, this.#strokeLevel[index] * Math.exp(-since / decay));
    }
    const last = this.#strokeAt[this.#strokes - 1];
    if (age >= last) {
      const left = Math.max(1e-3, this.#life - last);
      const glow = clampUnit(finiteOr(settings.afterglow, 0.15)) * (1 - clampUnit((age - last) / left));
      level = Math.max(level, glow);
    }
    return level;
  }

  #paint(settings) {
    const level = this.#intensity(settings) * this.#opacity;
    const branches = Math.exp(-this.#age / Math.max(0.01, finiteOr(settings.branchFadeSec, 0.18)));
    const coreAlpha = clampUnit(finiteOr(settings.coreOpacity, 1)) * level;
    const glowAlpha = clampUnit(finiteOr(settings.glowOpacity, 0.45)) * level;
    const coreColor = this.#coreColor.read(settings.coreColor);
    const glowColor = this.#glowColor.read(settings.glowColor);
    const bolt = this.#bolt;
    for (let index = 0; index < bolt.count; index += 1) {
      const along = 1 - (1 - BOTTOM_SHARE) * this.#down[index];
      const share = (bolt.branch[index] ? branches : 1) * along;
      const glow = this.#glowParticles[index], core = this.#coreParticles[index];
      glow.alpha = glowAlpha * share;
      glow.tint = glowColor;
      core.alpha = coreAlpha * share;
      core.tint = coreColor;
    }
    this.#cloud.alpha = clampUnit(finiteOr(settings.cloudGlowOpacity, 0.35)) * level;
    this.#cloud.tint = glowColor;
  }

  #hide() {
    if (!this.#shown) return false;
    this.#shown = false;
    this.#layer.visible = false;
    for (let index = 0; index < BRANCHING_BOLT_MAX_SEGMENTS; index += 1) {
      this.#glowParticles[index].alpha = 0;
      this.#coreParticles[index].alpha = 0;
    }
    this.#cloud.alpha = 0;
    return true;
  }

  // A fixed pool of the largest bolt, additive; made once.
  #pool(texture, particles) {
    const container = new this.#pixi.ParticleContainer({ texture, dynamicProperties: STATIC });
    container.blendMode = "add";
    for (let index = 0; index < BRANCHING_BOLT_MAX_SEGMENTS; index += 1) {
      const particle = new this.#pixi.Particle({ texture, anchorX: 0.5, anchorY: 0.5, alpha: 0 });
      particles.push(particle);
      container.addParticle(particle);
    }
    container.update();
    return container;
  }

  // A segment as a round texture stretched along it: centred on its middle, its length plus its width (the ends overlap
  // the neighbours' so the joints melt), its width across.
  static #place(particle, ax, ay, bx, by, rotation, segment, width) {
    particle.x = (ax + bx) / 2;
    particle.y = (ay + by) / 2;
    particle.rotation = rotation;
    particle.scaleX = (segment + width) / TEXTURE;
    particle.scaleY = width / TEXTURE;
  }

  // A round spot, white; falloff: the alpha's exponent from the centre (2 — a soft glow, below 1 — a firmer core).
  static #drawRound(documentTarget, falloff) {
    const canvas = documentTarget.createElement("canvas");
    canvas.width = TEXTURE;
    canvas.height = TEXTURE;
    const context = canvas.getContext("2d");
    const image = context.createImageData(TEXTURE, TEXTURE);
    const data = image.data;
    for (let y = 0; y < TEXTURE; y += 1) {
      for (let x = 0; x < TEXTURE; x += 1) {
        const distance = Math.hypot(x + 0.5 - TEXTURE / 2, y + 0.5 - TEXTURE / 2) / (TEXTURE / 2);
        const offset = (y * TEXTURE + x) * 4;
        data[offset] = 255; data[offset + 1] = 255; data[offset + 2] = 255;
        data[offset + 3] = Math.round(255 * Math.max(0, 1 - distance) ** falloff);
      }
    }
    context.putImageData(image, 0, 0);
    return canvas;
  }
}
