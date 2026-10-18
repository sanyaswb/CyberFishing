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
  #readSetupPose;
  #spineEnabled = true;
  #disabledClips = new Set();
  #boneEdits = new Map();
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
    state: "", stressRatio: 0, tensionRatio: 0, fishScreenX: 0, rodBaseX: 0, canvasWidth: 0, windDirection: 0,
    rainMultiplier: 1, reducedMotion: false, critical: false,
  };
  #anchor = {
    mode: "rectangle", baseX: 0, baseY: 0, tipX: 0, tipY: 0, scale: 1, destX: 0, destY: 0, destWidth: 0, destHeight: 0,
    image: null, region: null, bounds: null,
  };
  #pixelRatio = 1;
  #disposed = false;

  // readSetupPose(skeletonJson, atlas, descriptor) recomputes the static picture after a DEV bone edit.
  constructor({
    loadBundle, loadRuntime, glSurface, resolver, getConfig, isReducedMotion = () => false, readSetupPose = null,
  }) {
    const functions = { loadBundle, loadRuntime, getConfig, isReducedMotion };
    for (const [name, value] of Object.entries(functions)) {
      if (typeof value !== "function") throw new TypeError(`RodAnimationController requires ${name}`);
    }
    if (readSetupPose !== null && typeof readSetupPose !== "function") {
      throw new TypeError("RodAnimationController requires readSetupPose to be a function");
    }
    if (typeof resolver?.resolve !== "function") throw new TypeError("RodAnimationController requires resolver");
    if (typeof glSurface?.ensureContext !== "function") throw new TypeError("RodAnimationController requires glSurface");
    this.#loadBundle = loadBundle;
    this.#loadRuntime = loadRuntime;
    this.#glSurface = glSurface;
    this.#resolver = resolver;
    this.#getConfig = getConfig;
    this.#isReducedMotion = isReducedMotion;
    this.#readSetupPose = readSetupPose;
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
    this.#boneEdits.clear();
    if (!skeleton || !atlas) {
      this.#replaceScene(null);
      this.#bundle = null;
      return;
    }
    const load = this.#loadBundle({ skeleton, atlas, skin: skin || null, linePoint: linePoint || null });
    this.#load = load;
    load.result.then((outcome) => this.#onBundle(generation, outcome));
  }

  // context: { dtSec, state, stressRatio, tensionRatio, fishScreenX, baseX, baseY, canvasWidth, canvasHeight,
  // pixelRatio, windDirection, rainMultiplier, critical } (logical pixels; pixelRatio: device pixels per logical one).
  // Returns the RodAnchorFrame.
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
    if (scene && this.#spineEnabled && !this.#glSurface.isContextLost()) {
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
      mipmapped: this.#scene?.isMipmapped() ?? false,
      pixelRatio: this.#pixelRatio,
      bend: this.#bend.value,
      side: this.#side,
    };
  }

  // DEV port (spec 099 Phase 4, DevTools "SPINE ВУДКА"); production never calls it.
  setSpineEnabled(enabled) {
    this.#spineEnabled = enabled !== false;
  }

  isSpineEnabled() {
    return this.#spineEnabled;
  }

  // Clips of the loaded skeleton: [{ name, duration, enabled }]; empty until the scene exists.
  getClips() {
    return (this.#scene?.getClips() ?? []).map((clip) => ({ ...clip, enabled: !this.#disabledClips.has(clip.name) }));
  }

  // A disabled clip is not played: its track stays empty, so the setup pose shows there.
  setClipEnabled(clipName, enabled) {
    if (enabled === false) this.#disabledClips.add(String(clipName));
    else this.#disabledClips.delete(String(clipName));
  }

  // Bones with setup values and their position on the game canvas (Spine mode, last frame); empty without a scene.
  getBones() {
    const anchor = this.#anchor;
    const ratio = this.#pixelRatio;
    return (this.#scene?.getBones() ?? []).map((bone) => ({
      ...bone, canvasX: anchor.destX + bone.worldX / ratio, canvasY: anchor.destY + bone.worldY / ratio,
    }));
  }

  // Live setup edit of one bone (x, y, rotation, scaleX, scaleY), remembered for the export; the static picture's
  // line point follows when readSetupPose is composed.
  setBoneSetup(boneName, values) {
    if (!this.#scene?.setBoneSetup(boneName, values)) return false;
    const bone = this.#scene.getBones().find((entry) => entry.name === boneName);
    this.#boneEdits.set(boneName, { x: bone.x, y: bone.y, rotation: bone.rotation, scaleX: bone.scaleX, scaleY: bone.scaleY });
    if (this.#readSetupPose && this.#bundle) {
      const descriptor = { skin: this.#descriptor.skin || null, linePoint: this.#descriptor.linePoint || null };
      this.#bundle = { ...this.#bundle, staticPose: this.#readSetupPose(this.#editedSkeleton(), this.#bundle.atlas, descriptor) };
    }
    return true;
  }

  getBoneEdits() {
    return Object.fromEntries(this.#boneEdits);
  }

  // The whole skeleton JSON of the loaded file with the bone edits written in, for Import Data in the Spine editor:
  // { fileName, text } or null without a bundle. Default values are omitted, as Spine writes them.
  exportSkeleton() {
    if (!this.#bundle) return null;
    const path = this.#descriptor.skeleton;
    return { fileName: path.slice(path.lastIndexOf("/") + 1), text: JSON.stringify(this.#editedSkeleton()) };
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
    input.tensionRatio = context.tensionRatio;
    input.fishScreenX = context.fishScreenX;
    input.rodBaseX = context.baseX;
    input.canvasWidth = context.canvasWidth;
    input.windDirection = context.windDirection;
    input.rainMultiplier = context.rainMultiplier;
    input.reducedMotion = this.#isReducedMotion();
    input.critical = context.critical === true;
    const snapshot = this.#resolver.resolve(input, config, this.#snapshot);
    this.#bend.setTimeConstant(config.bendSmoothingSec);
    const bend = this.#bend.step(snapshot.bendTarget, context.dtSec);
    if (snapshot.fighting) {
      this.#side = snapshot.side;
      this.#sideClip = snapshot.sideClip;
      if (!this.#wasFighting) scene.clearTrack(0, config.idleToFightSec);
    } else if (this.#disabledClips.has(snapshot.idleClip)) {
      scene.clearTrack(0, config.windMixSec);
    } else {
      scene.setLoop(0, snapshot.idleClip, this.#wasFighting ? config.fightToIdleSec : config.windMixSec);
      scene.setTrackTimeScale(0, snapshot.idleTimeScale);
    }
    this.#wasFighting = snapshot.fighting;
    // After a fight the bend relaxes on the last side, so the rod springs back instead of jumping to the front.
    if (snapshot.fighting || bend > BEND_CLEAR_EPSILON) {
      const sideAlpha = Math.abs(this.#side);
      const sideClip = this.#sideClip || snapshot.sideClip;
      if (this.#disabledClips.has(snapshot.frontClip)) scene.clearTrack(1, 0);
      else scene.setSampled(1, snapshot.frontClip, bend, 1 - sideAlpha);
      if (this.#disabledClips.has(sideClip)) scene.clearTrack(2, 0);
      else scene.setSampled(2, sideClip, bend, sideAlpha);
    } else {
      scene.clearTrack(1, 0);
      scene.clearTrack(2, 0);
      this.#side = 0;
    }
    // Track 3: while the tackle STRESS bar shows, the critical clip's tremble (its change from its first frame) is
    // added to whatever bend the rod has, so the pose never jumps.
    if (snapshot.critical && !this.#disabledClips.has(snapshot.criticalClip)) {
      scene.setLoop(3, snapshot.criticalClip, config.criticalMixSec, true);
    } else {
      scene.clearTrack(3, config.criticalMixSec);
    }
    // The GL surface is in device pixels (spec 100 D3): placement and scale times the canvas pixel ratio, points and
    // the copy's destination back in logical pixels, so the copy into the 2D canvas is 1:1 in device pixels.
    const ratio = context.pixelRatio > 0 ? context.pixelRatio : 1;
    this.#pixelRatio = ratio;
    const deviceScale = anchor.scale * ratio;
    const padding = SURFACE_PADDING_PX * ratio;
    const bounds = scene.getLocalBounds(this.#localBounds);
    const surface = this.#glSurface;
    surface.resize(bounds.width * deviceScale + 2 * padding, bounds.height * deviceScale + 2 * padding);
    const originX = -bounds.x * deviceScale + padding;
    const originY = surface.height - (-bounds.y * deviceScale + padding);
    scene.setPlacement(originX, originY, deviceScale);
    scene.update(context.dtSec);
    anchor.destX = context.baseX - originX / ratio;
    anchor.destY = context.baseY - originY / ratio;
    anchor.destWidth = surface.width / ratio;
    anchor.destHeight = surface.height / ratio;
    const point = this.#point;
    if (scene.getPoint(this.#descriptor.linePoint || "line-tip", point)) {
      anchor.tipX = anchor.destX + point.x / ratio;
      anchor.tipY = anchor.destY + point.y / ratio;
    } else {
      anchor.tipX = context.baseX;
      anchor.tipY = context.baseY - (anchor.bounds.y + anchor.bounds.height) * anchor.scale;
    }
  }

  // A copy of the loaded skeleton JSON with the DEV bone edits in its bones entries.
  #editedSkeleton() {
    const json = JSON.parse(JSON.stringify(this.#bundle.skeleton));
    const defaults = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    for (const [boneName, values] of this.#boneEdits) {
      const bone = json.bones?.find((entry) => entry.name === boneName);
      if (!bone) continue;
      for (const [key, value] of Object.entries(values)) {
        if (value === defaults[key]) delete bone[key];
        else bone[key] = value;
      }
    }
    return json;
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
