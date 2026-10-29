import {
  BOAT_ANIMATION_CLIPS,
  BOAT_ANIMATION_DURATIONS,
  BOAT_LIGHT_SLOTS,
  BOAT_BAIT_SLOTS,
  BOAT_SECTION_CLIPS,
} from "../../domain/chum/boat_animation_state.js";

// Animation controller for the bait boat Spine skeleton (spec 150).
// Controls immersion, start and forward movement loops, compartment door opening,
// night lights and bait attachment visibility.
export class BoatAnimationController {
  #loadBundle;
  #loadRuntime;
  #glSurface;
  #isReducedMotion;
  #descriptor = { skeleton: "", atlas: "", skin: "" };
  #generation = 0;
  #load = null;
  #bundle = null;
  #scene = null;
  #disposed = false;

  #currentClip = "";
  #clipTimer = 0;
  #lastBoat = null;
  #openedSections = new Set();
  #lightsActive = null;
  #spineEnabled = true;
  #disabledClips = new Set();
  #boneEdits = new Map();
  #reason = null;

  constructor({
    loadBundle,
    loadRuntime,
    glSurface,
    isReducedMotion = () => false,
  }) {
    if (typeof loadBundle !== "function") throw new TypeError("BoatAnimationController requires loadBundle");
    if (typeof loadRuntime !== "function") throw new TypeError("BoatAnimationController requires loadRuntime");
    if (typeof glSurface?.ensureContext !== "function") throw new TypeError("BoatAnimationController requires glSurface");
    this.#loadBundle = loadBundle;
    this.#loadRuntime = loadRuntime;
    this.#glSurface = glSurface;
    this.#isReducedMotion = isReducedMotion;
  }

  setDescriptor(animation) {
    if (this.#disposed) return;
    const skeleton = animation?.skeleton ?? "";
    const atlas = animation?.atlas ?? "";
    const skin = animation?.skin ?? "";
    const current = this.#descriptor;
    if (current.skeleton === skeleton && current.atlas === atlas && current.skin === skin) return;
    current.skeleton = skeleton;
    current.atlas = atlas;
    current.skin = skin;

    const generation = ++this.#generation;
    this.#load?.release();
    this.#load = null;
    this.#openedSections.clear();
    this.#boneEdits.clear();
    this.#reason = null;
    this.#currentClip = "";
    this.#clipTimer = 0;
    this.#lastBoat = null;

    if (!skeleton || !atlas) {
      this.#replaceScene(null);
      this.#bundle = null;
      return;
    }

    const load = this.#loadBundle({ skeleton, atlas, skin: skin || null });
    this.#load = load;
    load.result.then((outcome) => this.#onBundle(generation, outcome));
  }

  advance(boat, context = {}) {
    const scene = this.#scene;
    if (!scene || this.#disposed || !this.#spineEnabled || this.#glSurface.isContextLost()) {
      return null;
    }

    if (this.#lastBoat !== boat) {
      this.#lastBoat = boat;
      this.#currentClip = "";
      this.#clipTimer = 0;
      this.#lightsActive = null;
      for (let track = 0; track <= 3; track++) {
        scene.clearTrack?.(track, 0);
      }
    }

    const dtSec = Math.max(0, Number(context.dtSec) || 0);
    const isNight = context.isNight === true;
    const animationState = boat?.animationState || "idle";
    const sectionIndex = Number(boat?.openingSectionIndex) || 1;

    let targetClip = "";
    let isLoop = false;

    if (animationState === "immersion") {
      targetClip = BOAT_ANIMATION_CLIPS.IMMERSION;
      isLoop = false;
    } else if (animationState === "moving_start") {
      targetClip = BOAT_ANIMATION_CLIPS.MOVE_START;
      isLoop = false;
    } else if (animationState === "moving" || animationState === "returning") {
      targetClip = BOAT_ANIMATION_CLIPS.MOVE_LOOP;
      isLoop = true;
    } else if (animationState === "opening") {
      if (sectionIndex === 1) targetClip = BOAT_ANIMATION_CLIPS.OPEN_SECTION_1;
      else if (sectionIndex === 2) targetClip = BOAT_ANIMATION_CLIPS.OPEN_SECTION_2;
      else if (sectionIndex === 3) targetClip = BOAT_ANIMATION_CLIPS.OPEN_SECTION_3;
      isLoop = false;
    }

    if (targetClip) {
      if (this.#currentClip !== targetClip) {
        this.#currentClip = targetClip;
        this.#clipTimer = 0;
        if (!this.#disabledClips.has(targetClip)) {
          const mixSec = targetClip === BOAT_ANIMATION_CLIPS.IMMERSION ? 0 : 0.1;
          if (isLoop) {
            scene.setLoop(0, targetClip, mixSec);
          } else {
            scene.setAnimation?.(0, targetClip, false, mixSec) || scene.setLoop(0, targetClip, mixSec);
          }
        }
      }
      this.#clipTimer += dtSec;
    } else {
      if (this.#currentClip !== "") {
        this.#currentClip = "";
        this.#clipTimer = 0;
      }
    }

    // Spec 150: night lights are enabled during the night in all states EXCEPT immersion.
    const shouldLight = isNight && targetClip !== BOAT_ANIMATION_CLIPS.IMMERSION;
    if (this.#lightsActive !== shouldLight) {
      this.#lightsActive = shouldLight;
      for (const lightSlot of BOAT_LIGHT_SLOTS) {
        scene.setSlotVisible?.(lightSlot, shouldLight);
      }
    }

    // Spec 150 / TK-149: Wave slot 1 is visible during motion, hidden during immersion and idle.
    const isMoving = animationState === "moving_start" || animationState === "moving" || animationState === "returning";
    scene.setSlotVisible?.("boats-wave--1", isMoving);

    // Owner instruction (2026-10-29): boats-wave--2 and boats-wave--3 are disabled by default
    // until animations are authored for them.
    scene.setSlotVisible?.("boats-wave--2", false);
    scene.setSlotVisible?.("boats-wave--3", false);

    // Spec 150: bait attachments turn off once their corresponding section opens/drops.
    const droppedSections = boat?.droppedSections || [];
    for (const [sectionNum, baitSlot] of Object.entries(BOAT_BAIT_SLOTS)) {
      const isDropped = droppedSections.includes(Number(sectionNum));
      scene.setSlotVisible?.(baitSlot, !isDropped);
    }

    // Spec 150 (owner instruction 2026-10-29): keep dropped compartments open across subsequent moves.
    for (let sec = 1; sec <= 3; sec++) {
      const clip = BOAT_SECTION_CLIPS[sec];
      if (droppedSections.includes(sec)) {
        if (!this.#disabledClips.has(clip)) {
          scene.setSampled?.(sec, clip, 1.0, 1.0);
        }
      } else {
        scene.clearTrack?.(sec, 0);
      }
    }

    const scale = Number(context.scale) || 1;
    const originX = Number(context.screenX) || 0;
    const originY = Number(context.screenY) || 0;
    scene.setPlacement(originX, originY, scale);
    scene.update(dtSec);

    return {
      view: scene.getView?.() || null,
      clip: this.#currentClip,
      clipTimer: this.#clipTimer,
      duration: BOAT_ANIMATION_DURATIONS[this.#currentClip] || 0,
      isFinished: !isLoop && this.#clipTimer >= (BOAT_ANIMATION_DURATIONS[this.#currentClip] || 0),
    };
  }

  get scene() {
    return this.#scene;
  }

  // DEV port (spec 150, DevTools "SPINE" -> "SPINE_BOAT")
  setSpineEnabled(enabled) {
    this.#spineEnabled = enabled !== false;
  }

  isSpineEnabled() {
    return this.#spineEnabled;
  }

  getStatus() {
    return {
      mode: this.#scene && this.#spineEnabled && !this.#glSurface.isContextLost() ? "spine" : "fallback (emoji)",
      reason: this.#reason,
      missingClips: this.#scene?.getMissingClips?.() ?? [],
      mipmapped: this.#scene?.isMipmapped?.() ?? false,
      currentClip: this.#currentClip,
      lightsActive: this.#lightsActive === true,
    };
  }

  getClips() {
    return (this.#scene?.getClips?.() ?? []).map((clip) => ({
      ...clip,
      enabled: !this.#disabledClips.has(clip.name),
    }));
  }

  setClipEnabled(clipName, enabled) {
    if (enabled === false) this.#disabledClips.add(String(clipName));
    else this.#disabledClips.delete(String(clipName));
  }

  getBones() {
    return this.#scene?.getBones?.() ?? [];
  }

  setBoneSetup(boneName, values) {
    if (!this.#scene?.setBoneSetup?.(boneName, values)) return false;
    const bone = this.#scene.getBones().find((entry) => entry.name === boneName);
    if (bone) {
      this.#boneEdits.set(boneName, { x: bone.x, y: bone.y, rotation: bone.rotation, scaleX: bone.scaleX, scaleY: bone.scaleY });
    }
    return true;
  }

  getBoneEdits() {
    return Object.fromEntries(this.#boneEdits);
  }

  exportSkeleton() {
    if (!this.#bundle?.skeleton) return null;
    const path = this.#descriptor.skeleton;
    return {
      fileName: path ? path.slice(path.lastIndexOf("/") + 1) : "boat-lvl--3.json",
      text: JSON.stringify(this.#editedSkeleton(), null, 2),
    };
  }

  #editedSkeleton() {
    if (!this.#bundle?.skeleton) return null;
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

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#generation += 1;
    this.#load?.release();
    this.#load = null;
    this.#replaceScene(null);
    this.#bundle = null;
    this.#lastBoat = null;
  }

  async #onBundle(generation, outcome) {
    if (generation !== this.#generation) return;
    if (outcome.status !== "ready") {
      this.#reason = outcome.reason ?? outcome.status;
      this.#replaceScene(null);
      return;
    }
    const skeleton = this.#sanitizeSkeleton(outcome.bundle.skeleton);
    const bundle = { ...outcome.bundle, skeleton };
    this.#bundle = bundle;
    const capability = await this.#loadRuntime(bundle.version);
    if (generation !== this.#generation) return;
    if (!capability.available) {
      this.#reason = capability.reason ?? "runtime-not-available";
      this.#replaceScene(null);
      return;
    }
    const created = capability.runtime.createScene(bundle, this.#glSurface);
    if (generation !== this.#generation) {
      created.scene?.dispose();
      return;
    }
    this.#reason = created.reason ?? null;
    this.#replaceScene(created.scene);
  }

  #sanitizeSkeleton(raw) {
    if (!raw?.animations) return raw;
    const skeleton = JSON.parse(JSON.stringify(raw));
    const sectionClips = [
      BOAT_ANIMATION_CLIPS.OPEN_SECTION_1,
      BOAT_ANIMATION_CLIPS.OPEN_SECTION_2,
      BOAT_ANIMATION_CLIPS.OPEN_SECTION_3,
    ];
    for (const clipName of sectionClips) {
      const anim = skeleton.animations[clipName];
      if (anim?.slots?.["boats-wave--1"]) {
        delete anim.slots["boats-wave--1"];
      }
    }
    const waveSlot = skeleton.slots?.find((s) => s.name === "boats-wave--1");
    if (waveSlot) {
      waveSlot.color = "ffffff00";
    }
    return skeleton;
  }

  #replaceScene(scene) {
    if (this.#scene === scene) return;
    this.#scene?.dispose();
    this.#scene = scene;
  }
}
