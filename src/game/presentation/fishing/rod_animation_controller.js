import { ScalarSmoother } from "../../../engine/animation/scalar_smoother.js";

const RECTANGLE_HEIGHT_PX = 200;
const SURFACE_PADDING_PX = 2;
const BEND_CLEAR_EPSILON = 0.001;

// The equipped rod's picture for one session (spec 099). Mode "rectangle" (no animated skin, or its art is missing:
// today's 3 x 200 px bar), "static" (the skin's setup-pose picture, owner D9) or "spine" (the live skeleton). Modes
// only move forward, rectangle -> static -> spine, except a lost GL context, which shows the static picture until it
// returns. advance() runs once per frame while the fishing scene is built and leaves the RodAnchorFrame that the rod
// renderers and the line read, so the line hangs from the pose that is drawn. No allocation per frame.
export class RodAnimationController {
  #loadBundle;
  #loadRuntime;
  #glSurface;
  #resolver;
  #getConfig;
  #isReducedMotion;
  #forceStatic;
  #snapshot;
  #bend = new ScalarSmoother({ timeConstantSec: 0.12 });
  #descriptor = { skeleton: "", atlas: "", skin: "", linePoint: "" };
  #generation = 0;
  #load = null;
  #bundle = null;
  #scene = null;
  #reason = null;
  #wasFighting = false;
  #side = 0;
  #sideClip = "";
  #localBounds = { x: 0, y: 0, width: 0, height: 0 };
  #point = { x: 0, y: 0 };
  #resolveInput = {
    state: "", stressRatio: 0, fishScreenX: 0, rodBaseX: 0, canvasWidth: 0, windDirection: 0, rainMultiplier: 1,
    reducedMotion: false,
  };
  #anchor = {
    mode: "rectangle", baseX: 0, baseY: 0, tipX: 0, tipY: 0, scale: 1, destX: 0, destY: 0,
    image: null, region: null, bounds: null,
  };
  #disposed = false;

  constructor({
    loadBundle, loadRuntime, glSurface, resolver, getConfig, isReducedMotion = () => false, forceStatic = () => false,
  }) {
    const functions = { loadBundle, loadRuntime, getConfig, isReducedMotion, forceStatic };
    for (const [name, value] of Object.entries(functions)) {
      if (typeof value !== "function") throw new TypeError(`RodAnimationController requires ${name}`);
    }
    if (typeof resolver?.resolve !== "function") throw new TypeError("RodAnimationController requires resolver");
    if (typeof glSurface?.ensureContext !== "function") throw new TypeError("RodAnimationController requires glSurface");
    this.#loadBundle = loadBundle;
    this.#loadRuntime = loadRuntime;
    this.#glSurface = glSurface;
    this.#resolver = resolver;
    this.#getConfig = getConfig;
    this.#isReducedMotion = isReducedMotion;
    this.#forceStatic = forceStatic;
    this.#snapshot = resolver.createSnapshot();
  }

  // animation: the equipped rod skin's { skeleton, atlas, skin, linePoint } or null. Called every frame; a change
  // starts a new load and keeps the current picture until the new one is ready.
  setSkin(animation) {
    if (this.#disposed) return;
    const skeleton = animation?.skeleton ?? "";
    const atlas = animation?.atlas ?? "";
    const skin = animation?.skin ?? "";
    const linePoint = animation?.linePoint ?? "";
    const current = this.#descriptor;
    if (current.skeleton === skeleton && current.atlas === atlas && current.skin === skin &&
      current.linePoint === linePoint) return;
    current.skeleton = skeleton;
    current.atlas = atlas;
    current.skin = skin;
    current.linePoint = linePoint;
    const generation = ++this.#generation;
    this.#load?.release();
    this.#load = null;
    this.#reason = null;
    if (!skeleton || !atlas) {
      this.#replaceScene(null);
      this.#bundle = null;
      return;
    }
    const load = this.#loadBundle({ skeleton, atlas, skin: skin || null, linePoint: linePoint || null });
    this.#load = load;
    load.result.then((outcome) => this.#onBundle(generation, outcome));
  }

  // context: { dtSec, state, stressRatio, fishScreenX, baseX, baseY, canvasWidth, canvasHeight, windDirection,
  // rainMultiplier }. Returns the RodAnchorFrame.
  advance(context) {
    const anchor = this.#anchor;
    anchor.baseX = context.baseX;
    anchor.baseY = context.baseY;
    const config = this.#getConfig();
    const pose = this.#bundle?.staticPose ?? null;
    const image = pose?.region ? this.#bundle.pages.get(pose.region.pageName) ?? null : null;
    if (!pose || !image || !(pose.bounds.height > 0)) {
      this.#rectangle(anchor);
      return anchor;
    }
    anchor.scale = (context.canvasHeight * config.heightRatio) / pose.bounds.height;
    anchor.image = image;
    anchor.region = pose.region;
    anchor.bounds = pose.bounds;
    const scene = this.#scene;
    if (scene && !this.#forceStatic() && !this.#glSurface.isContextLost()) {
      this.#advanceScene(scene, context, config, anchor);
      return anchor;
    }
    anchor.mode = "static";
    const tipX = pose.linePoint ? pose.linePoint.x : pose.bounds.x + pose.bounds.width / 2;
    const tipY = pose.linePoint ? pose.linePoint.y : pose.bounds.y + pose.bounds.height;
    anchor.tipX = context.baseX + tipX * anchor.scale;
    anchor.tipY = context.baseY - tipY * anchor.scale;
    return anchor;
  }

  getAnchor() {
    return this.#anchor;
  }

  // Draws the scene into the GL surface for this frame; the caller then copies glSurface.canvas. False if no scene.
  renderScene() {
    return this.#anchor.mode === "spine" && this.#scene ? this.#scene.render() : false;
  }

  get glSurface() {
    return this.#glSurface;
  }

  // DEV status: mode, the last unavailability reason and clips the export lacks.
  getStatus() {
    return {
      mode: this.#anchor.mode,
      reason: this.#reason,
      missingClips: this.#scene?.getMissingClips() ?? [],
      bend: this.#bend.value,
      side: this.#side,
    };
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#generation += 1;
    this.#load?.release();
    this.#load = null;
    this.#replaceScene(null);
    this.#bundle = null;
  }

  #advanceScene(scene, context, config, anchor) {
    anchor.mode = "spine";
    const input = this.#resolveInput;
    input.state = context.state;
    input.stressRatio = context.stressRatio;
    input.fishScreenX = context.fishScreenX;
    input.rodBaseX = context.baseX;
    input.canvasWidth = context.canvasWidth;
    input.windDirection = context.windDirection;
    input.rainMultiplier = context.rainMultiplier;
    input.reducedMotion = this.#isReducedMotion();
    const snapshot = this.#resolver.resolve(input, config, this.#snapshot);
    this.#bend.setTimeConstant(config.bendSmoothingSec);
    const bend = this.#bend.step(snapshot.bendTarget, context.dtSec);
    if (snapshot.fighting) {
      this.#side = snapshot.side;
      this.#sideClip = snapshot.sideClip;
      if (!this.#wasFighting) scene.clearTrack(0, config.idleToFightSec);
    } else {
      scene.setLoop(0, snapshot.idleClip, this.#wasFighting ? config.fightToIdleSec : config.windMixSec);
      scene.setTrackTimeScale(0, snapshot.idleTimeScale);
    }
    this.#wasFighting = snapshot.fighting;
    // After a fight the bend relaxes on the last side, so the rod springs back instead of jumping to the front.
    if (snapshot.fighting || bend > BEND_CLEAR_EPSILON) {
      const sideAlpha = Math.abs(this.#side);
      scene.setSampled(1, snapshot.frontClip, bend, 1 - sideAlpha);
      scene.setSampled(2, this.#sideClip || snapshot.sideClip, bend, sideAlpha);
    } else {
      scene.clearTrack(1, 0);
      scene.clearTrack(2, 0);
      this.#side = 0;
    }
    const bounds = scene.getLocalBounds(this.#localBounds);
    const surface = this.#glSurface;
    surface.resize(bounds.width * anchor.scale + 2 * SURFACE_PADDING_PX,
      bounds.height * anchor.scale + 2 * SURFACE_PADDING_PX);
    const originX = -bounds.x * anchor.scale + SURFACE_PADDING_PX;
    const originY = surface.height - (-bounds.y * anchor.scale + SURFACE_PADDING_PX);
    scene.setPlacement(originX, originY, anchor.scale);
    scene.update(context.dtSec);
    anchor.destX = context.baseX - originX;
    anchor.destY = context.baseY - originY;
    const point = this.#point;
    if (scene.getPoint(this.#descriptor.linePoint || "line-tip", point)) {
      anchor.tipX = anchor.destX + point.x;
      anchor.tipY = anchor.destY + point.y;
    } else {
      anchor.tipX = context.baseX;
      anchor.tipY = context.baseY - (anchor.bounds.y + anchor.bounds.height) * anchor.scale;
    }
  }

  #rectangle(anchor) {
    anchor.mode = "rectangle";
    anchor.scale = 1;
    anchor.image = null;
    anchor.region = null;
    anchor.bounds = null;
    anchor.tipX = anchor.baseX;
    anchor.tipY = anchor.baseY - RECTANGLE_HEIGHT_PX;
  }

  async #onBundle(generation, outcome) {
    if (generation !== this.#generation) return;
    if (outcome.status !== "ready") {
      this.#reason = outcome.reason ?? outcome.status;
      return;
    }
    // The new skin's static picture replaces the previous skin's scene until its own scene is ready.
    this.#replaceScene(null);
    this.#bundle = outcome.bundle;
    const capability = await this.#loadRuntime(outcome.bundle.version);
    if (generation !== this.#generation) return;
    if (!capability.available) {
      this.#reason = capability.reason;
      this.#replaceScene(null);
      return;
    }
    const created = capability.runtime.createScene(outcome.bundle, this.#glSurface);
    if (generation !== this.#generation) {
      created.scene?.dispose();
      return;
    }
    this.#reason = created.reason;
    this.#replaceScene(created.scene);
  }

  #replaceScene(scene) {
    if (this.#scene === scene) return;
    this.#scene?.dispose();
    this.#scene = scene;
    this.#wasFighting = false;
    this.#side = 0;
    this.#sideClip = "";
    this.#bend.reset(0);
  }
}
