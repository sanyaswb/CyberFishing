// The only module that drives the Spine API (spec 099, "Scene port"; Spine 4.3 bone poses). The runtime namespace
// and the graphics (GL textures, renderer, restore) are injected by spine_runtime_module.js, so checks build scenes
// in Node with fake textures. Placement and points are surface pixels with y down; the skeleton world is y up with
// its origin at the surface's bottom left, so a surface resize must happen before update().
const SAMPLES_PER_CLIP = 24;
const EMPTY_ANIMATION = "<empty>";

export class SpineScene {
  #spine;
  #surface;
  #graphics;
  #atlas;
  #data;
  #skeleton;
  #state;
  #renderer = null;
  #placement = { x: 0, y: 0, scale: 1 };
  #localBounds;
  #points = new Map();
  #missingClips = new Set();
  #unsubscribe;
  #disposed = false;

  // Returns { scene, reason: null } or { scene: null, reason, error } (reasons: version-mismatch, page-missing,
  // texture-too-large, skeleton-invalid, skin-missing).
  static create({ spine, bundle, surface, graphics, runtimeVersion }) {
    if (!SpineScene.#sameLine(runtimeVersion, bundle.version)) return SpineScene.#failure("version-mismatch");
    let atlas = null;
    try {
      atlas = new spine.TextureAtlas(bundle.atlasText);
      for (const page of atlas.pages) {
        const image = bundle.pages.get(page.name);
        if (!image) return SpineScene.#failure("page-missing", null, atlas);
        if (Math.max(page.width, page.height) > surface.maxTextureSize) {
          return SpineScene.#failure("texture-too-large", null, atlas);
        }
        page.setTexture(graphics.createTexture(image, page.pma));
      }
    } catch (error) {
      return SpineScene.#failure("skeleton-invalid", error, atlas);
    }
    let data;
    try {
      data = new spine.SkeletonJson(new spine.AtlasAttachmentLoader(atlas)).readSkeletonData(bundle.skeleton);
    } catch (error) {
      return SpineScene.#failure("skeleton-invalid", error, atlas);
    }
    const skin = bundle.skin ? data.findSkin(bundle.skin) : data.defaultSkin;
    if (bundle.skin && !skin) return SpineScene.#failure("skin-missing", null, atlas);
    return { scene: new SpineScene({ spine, surface, graphics, atlas, data, skin }), reason: null, error: null };
  }

  constructor({ spine, surface, graphics, atlas, data, skin }) {
    this.#spine = spine;
    this.#surface = surface;
    this.#graphics = graphics;
    this.#atlas = atlas;
    this.#data = data;
    this.#skeleton = new spine.Skeleton(data);
    if (skin) this.#skeleton.setSkin(skin);
    this.#skeleton.setupPose();
    this.#state = new spine.AnimationState(new spine.AnimationStateData(data));
    this.#localBounds = this.#measureBounds(skin);
    this.#unsubscribe = surface.onContextChange((lost) => {
      if (!lost) this.restoreContext();
    });
  }

  // x, y: the skeleton origin in surface pixels (y down); scale: surface pixels per skeleton unit.
  setPlacement(x, y, scale) {
    this.#placement.x = Number(x) || 0;
    this.#placement.y = Number(y) || 0;
    this.#placement.scale = Number(scale) > 0 ? Number(scale) : 1;
  }

  // Looping clip; the same clip keeps playing. From an empty track the clip fades in over mixSec.
  setLoop(track, clipName, mixSec = 0) {
    const animation = this.#animation(clipName);
    if (!animation) {
      this.clearTrack(track, mixSec);
      return false;
    }
    const current = this.#state.getTrack(track);
    if (current && current.animation === animation && current.loop) return true;
    let entry;
    if (!current && mixSec > 0) {
      this.#state.setEmptyAnimation(track, 0);
      entry = this.#state.addAnimation(track, animation, true, 0);
    } else {
      entry = this.#state.setAnimation(track, animation, true);
    }
    entry.mixDuration = Math.max(0, mixSec);
    return true;
  }

  // Clip held at ratio × duration (time scale 0) and blended with alpha: the fight bend sampled by load.
  setSampled(track, clipName, ratio, alpha) {
    const animation = this.#animation(clipName);
    if (!animation) {
      this.clearTrack(track, 0);
      return false;
    }
    let entry = this.#state.getTrack(track);
    if (!entry || entry.animation !== animation) {
      entry = this.#state.setAnimation(track, animation, false);
      entry.mixDuration = 0;
      entry.timeScale = 0;
    }
    entry.trackTime = SpineScene.#unit(ratio) * animation.duration;
    entry.alpha = SpineScene.#unit(alpha);
    return true;
  }

  clearTrack(track, mixSec = 0) {
    const current = this.#state.getTrack(track);
    if (!current || current.animation.name === EMPTY_ANIMATION) return;
    this.#state.setEmptyAnimation(track, Math.max(0, mixSec));
  }

  setTrackTimeScale(track, timeScale) {
    const current = this.#state.getTrack(track);
    if (current && current.animation.name !== EMPTY_ANIMATION) current.timeScale = Math.max(0, Number(timeScale) || 0);
  }

  update(dtSec) {
    const dt = Math.max(0, Number(dtSec) || 0);
    const skeleton = this.#skeleton;
    this.#state.update(dt);
    // Bones start from the setup pose every frame, so blended tracks never build on the previous frame.
    skeleton.setupPoseBones();
    skeleton.x = this.#placement.x;
    skeleton.y = this.#surface.height - this.#placement.y;
    skeleton.scaleX = this.#placement.scale;
    skeleton.scaleY = this.#placement.scale;
    this.#state.apply(skeleton);
    skeleton.update(dt);
    skeleton.updateWorldTransform(this.#spine.Physics.update);
  }

  // Clears the surface and draws the skeleton; false while the context is lost.
  render() {
    const surface = this.#surface;
    if (this.#disposed || surface.isContextLost()) return false;
    const renderer = this.#renderer ??= this.#graphics.createRenderer();
    const gl = surface.gl;
    const width = surface.width;
    const height = surface.height;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    renderer.camera.setViewport(width, height);
    renderer.camera.position.x = width / 2;
    renderer.camera.position.y = height / 2;
    renderer.begin();
    renderer.drawSkeleton(this.#skeleton);
    renderer.end();
    return true;
  }

  // A point attachment of that name, else a bone of that name, else the tip of the deepest bone; in surface pixels
  // (y down) for the last update(). Writes out.x / out.y.
  getPoint(name, out) {
    let point = this.#points.get(name);
    if (!point) {
      point = this.#resolvePoint(name);
      this.#points.set(name, point);
    }
    if (!point) return false;
    const pose = point.bone.appliedPose;
    out.x = pose.a * point.x + pose.b * point.y + pose.worldX;
    out.y = this.#surface.height - (pose.c * point.x + pose.d * point.y + pose.worldY);
    return true;
  }

  // Union of the setup pose and every clip's sampled poses, skeleton units (y up) at origin 0 and scale 1.
  getLocalBounds(out) {
    out.x = this.#localBounds.x;
    out.y = this.#localBounds.y;
    out.width = this.#localBounds.width;
    out.height = this.#localBounds.height;
    return out;
  }

  hasClip(clipName) {
    return Boolean(this.#data.findAnimation(clipName));
  }

  clipDuration(clipName) {
    return this.#data.findAnimation(clipName)?.duration ?? 0;
  }

  getMissingClips() {
    return [...this.#missingClips];
  }

  restoreContext() {
    if (!this.#disposed) this.#graphics.restore();
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#unsubscribe();
    this.#renderer?.dispose();
    this.#atlas.dispose();
    this.#graphics.dispose();
  }

  #animation(clipName) {
    const animation = this.#data.findAnimation(clipName);
    if (!animation) this.#missingClips.add(String(clipName));
    return animation;
  }

  #resolvePoint(name) {
    const skeleton = this.#skeleton;
    const skin = skeleton.skin ?? this.#data.defaultSkin;
    for (const entry of skin?.getAttachments() ?? []) {
      if ((entry.placeholder ?? entry.name) === name && entry.attachment instanceof this.#spine.PointAttachment) {
        const bone = skeleton.slots[entry.slotIndex].bone;
        return { bone, x: entry.attachment.x, y: entry.attachment.y };
      }
    }
    const named = skeleton.findBone(name);
    if (named) return { bone: named, x: 0, y: 0 };
    let deepest = null;
    let deepestDepth = -1;
    for (const bone of skeleton.bones) {
      let depth = 0;
      for (let parent = bone.parent; parent; parent = parent.parent) depth += 1;
      if (bone.data.length > 0 && depth > deepestDepth) {
        deepest = bone;
        deepestDepth = depth;
      }
    }
    return deepest ? { bone: deepest, x: deepest.data.length, y: 0 } : null;
  }

  #measureBounds(skin) {
    const spine = this.#spine;
    const skeleton = new spine.Skeleton(this.#data);
    if (skin) skeleton.setSkin(skin);
    const state = new spine.AnimationState(new spine.AnimationStateData(this.#data));
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const measure = () => {
      skeleton.updateWorldTransform(spine.Physics.update);
      const rect = skeleton.getBoundsRect();
      if (!(rect.width > 0 || rect.height > 0)) return;
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    };
    skeleton.setupPose();
    measure();
    for (const animation of this.#data.animations) {
      for (let sample = 0; sample <= SAMPLES_PER_CLIP; sample += 1) {
        skeleton.setupPose();
        state.clearTracks();
        const entry = state.setAnimation(0, animation, false);
        entry.trackTime = (animation.duration * sample) / SAMPLES_PER_CLIP;
        state.apply(skeleton);
        measure();
      }
    }
    if (!Number.isFinite(minX)) return Object.freeze({ x: 0, y: 0, width: 0, height: 0 });
    return Object.freeze({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
  }

  static #sameLine(runtimeVersion, exportVersion) {
    const line = (version) => String(version || "").split(".").slice(0, 2);
    const [runtimeMajor, runtimeMinor] = line(runtimeVersion);
    const [exportMajor, exportMinor] = line(exportVersion);
    return Boolean(exportMajor && exportMinor) && runtimeMajor === exportMajor && runtimeMinor === exportMinor;
  }

  static #unit(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
  }

  static #failure(reason, error = null, atlas = null) {
    atlas?.dispose();
    return { scene: null, reason, error };
  }
}
