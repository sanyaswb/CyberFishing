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
  #descriptor = { asset: "", skin: "", linePoint: "" };
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
  // view / viewScale: the scene's display object of the skeleton (a runtime that draws inside the WebGL scene, spec
  // 107) and its surface-to-logical scale; null when the skeleton is not drawn.
  #anchor = {
    mode: "rectangle", baseX: 0, baseY: 0, tipX: 0, tipY: 0, scale: 1, destX: 0, destY: 0, destWidth: 0, destHeight: 0,
    image: null, region: null, bounds: null, view: null, viewScale: 1,
  };
  #pixelRatio = 1;
  #getStartImage;
  #startPicture = null;
  #startRegion = null;
  #startRegionImage = null;
  #probeSpine;
  #requestStatic;
  #pageRegion = null;
  #pageRegionImage = null;
  #disposed = false;

  // readSetupPose(skeletonJson, atlas, descriptor) recomputes the static picture after a DEV bone edit.
  // getStartImage(assetId): the loaded image of the skin's startPicture (TK-181), or null.
  // Spec 166: probeSpine() -> Promise<boolean>, whether Spine plays on this page (asked before any export file loads);
  // requestStatic(assetId) asks for the full start picture, which only a rod without Spine needs. loadBundle(descriptor)
  // returns { result, upgrade(), release() }: the export on its half-size pages where it has them, upgrade() the full pages.
  constructor({
    loadBundle, loadRuntime, glSurface, resolver, getConfig, isReducedMotion = () => false, readSetupPose = null,
    getStartImage = () => null, probeSpine = () => Promise.resolve(true), requestStatic = () => {},
  }) {
    const functions = { loadBundle, loadRuntime, getConfig, isReducedMotion, probeSpine, requestStatic };
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
    this.#getStartImage = getStartImage;
    this.#probeSpine = probeSpine;
    this.#requestStatic = requestStatic;
    this.#snapshot = resolver.createSnapshot();
  }

  // animation: the equipped rod skin's { asset, skin, linePoint, startPicture } (asset: the Spine export's id) or null.
  // Called every frame; a change starts a new load and keeps the current picture until the new one is ready.
  // startPicture { asset, bounds, linePoint }: an upright image of the export's setup pose, drawn until the export arrives.
  setSkin(animation) {
    if (this.#disposed) return;
    this.#startPicture = animation?.startPicture ?? null;
    const asset = animation?.asset ?? "";
    const skin = animation?.skin ?? "";
    const linePoint = animation?.linePoint ?? "";
    const current = this.#descriptor;
    if (current.asset === asset && current.skin === skin && current.linePoint === linePoint) return;
    current.asset = asset;
    current.skin = skin;
    current.linePoint = linePoint;
    const generation = ++this.#generation;
    this.#load?.release();
    this.#load = null;
    this.#reason = null;
    this.#boneEdits.clear();
    if (!asset) {
      this.#replaceScene(null);
      this.#bundle = null;
      return;
    }
    // Spec 166: Spine first decides what loads. With Spine: the export (its half-size pages, then the full ones);
    // without it: only the full start picture.
    const startAsset = this.#startPicture?.asset ?? "";
    this.#probeSpine().then((available) => {
      if (generation !== this.#generation || this.#disposed) return;
      if (available !== true) {
        this.#reason = "spine-unavailable";
        if (startAsset) this.#requestStatic(startAsset);
        return;
      }
      const load = this.#loadBundle({ asset, skin: skin || null, linePoint: linePoint || null });
      this.#load = load;
      load.result.then((outcome) => this.#onBundle(generation, outcome, load, startAsset));
    });
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
      const start = this.#startPicture;
      const startImage = start ? this.#getStartImage(start.asset) : null;
      if (startImage) this.#placeStatic(anchor, context, config, start, startImage, this.#startRegionOf(startImage));
      else this.#rectangle(anchor);
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
    this.#placeStatic(anchor, context, config, pose, image, this.#regionOnPage(pose.region, image));
    return anchor;
  }

  // The static picture over the pose's setup bounds: the export's atlas region, or the start picture before it.
  #placeStatic(anchor, context, config, pose, image, region) {
    anchor.scale = (context.canvasHeight * config.heightRatio) / pose.bounds.height;
    anchor.image = image;
    anchor.region = region;
    anchor.bounds = pose.bounds;
    anchor.mode = "static";
    anchor.view = null;
    const tipX = pose.linePoint ? pose.linePoint.x : pose.bounds.x + pose.bounds.width / 2;
    const tipY = pose.linePoint ? pose.linePoint.y : pose.bounds.y + pose.bounds.height;
    anchor.tipX = context.baseX + tipX * anchor.scale;
    anchor.tipY = context.baseY - tipY * anchor.scale;
  }

  // The whole start image as an unrotated region, one object per image (advance runs every frame).
  #startRegionOf(image) {
    if (this.#startRegionImage !== image) {
      this.#startRegionImage = image;
      this.#startRegion = Object.freeze({ x: 0, y: 0, width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height, rotate: 0 });
    }
    return this.#startRegion;
  }

  // The pose's region on the page image it is drawn from: the atlas's own numbers on the full page, the same region
  // scaled to a half-size copy (spec 166), one object per image (advance runs every frame).
  #regionOnPage(region, image) {
    const page = this.#bundle?.atlas?.pages?.find((entry) => entry.name === region.pageName);
    const width = image.naturalWidth || image.width;
    if (!page || !(page.width > 0) || width === page.width) return region;
    if (this.#pageRegionImage !== image) {
      this.#pageRegionImage = image;
      const sx = width / page.width;
      const sy = (image.naturalHeight || image.height) / page.height;
      const rotated = region.rotate === 90;
      this.#pageRegion = Object.freeze({ ...region, x: region.x * sx, y: region.y * sy,
        width: region.width * (rotated ? sy : sx), height: region.height * (rotated ? sx : sy) });
    }
    return this.#pageRegion;
  }

  getAnchor() {
    return this.#anchor;
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
    return { fileName: this.#bundle.skeletonFile, text: JSON.stringify(this.#editedSkeleton()) };
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
    // The skeleton's surface is in device pixels (spec 100 D3): placement and scale times the canvas pixel ratio, points
    // and the destination back in logical pixels; the scene's rod renderer draws the view at 1 / ratio.
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
    anchor.view = scene.getView?.() ?? null;
    anchor.viewScale = 1 / ratio;
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
    anchor.view = null;
    anchor.scale = 1;
    anchor.image = null;
    anchor.region = null;
    anchor.bounds = null;
    anchor.tipX = anchor.baseX;
    anchor.tipY = anchor.baseY - RECTANGLE_HEIGHT_PX;
  }

  async #onBundle(generation, outcome, load, startAsset) {
    if (generation !== this.#generation) return;
    if (outcome.status !== "ready") {
      this.#reason = outcome.reason ?? outcome.status;
      // Spec 166: an export that did not load leaves the start picture, now in full.
      if (outcome.reason !== "cancelled" && startAsset) this.#requestStatic(startAsset);
      return;
    }
    // The new skin's static picture replaces the previous skin's scene until its own scene is ready.
    this.#replaceScene(null);
    this.#bundle = outcome.bundle;
    // Spec 166: the full pages follow the half-size ones; the scene takes them into its textures, the static picture
    // reads them from the bundle.
    if (outcome.bundle.lowPages === true) {
      load.upgrade().then((upgraded) => {
        if (generation !== this.#generation || upgraded.status !== "ready") return;
        this.#bundle = { ...this.#bundle, pages: upgraded.pages, lowPages: false };
        this.#scene?.upgradePages(upgraded.pages);
      });
    }
    const capability = await this.#loadRuntime(outcome.bundle.version);
    if (generation !== this.#generation) return;
    if (!capability.available) {
      this.#reason = capability.reason;
      this.#replaceScene(null);
      return;
    }
    const created = capability.runtime.createScene(this.#bundle, this.#glSurface);
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
