import {
  BOAT_ANIMATION_CLIPS,
  BOAT_ANIMATION_DURATIONS,
  BOAT_LIGHT_SLOTS,
  BOAT_BAIT_SLOTS,
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
  #openedSections = new Set();
  #lightsActive = null;

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
    this.#currentClip = "";
    this.#clipTimer = 0;

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
    if (!scene || this.#disposed || this.#glSurface.isContextLost()) {
      return null;
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
        if (isLoop) {
          scene.setLoop(0, targetClip, 0.1);
        } else {
          scene.setAnimation?.(0, targetClip, false, 0.1) || scene.setLoop(0, targetClip, 0.1);
        }
      }
      this.#clipTimer += dtSec;
    }

    // Spec 150: night lights are enabled during the night in all states EXCEPT immersion.
    const shouldLight = isNight && targetClip !== BOAT_ANIMATION_CLIPS.IMMERSION;
    if (this.#lightsActive !== shouldLight) {
      this.#lightsActive = shouldLight;
      for (const lightSlot of BOAT_LIGHT_SLOTS) {
        scene.setSlotVisible?.(lightSlot, shouldLight);
      }
    }

    // Spec 150: bait attachments turn off once their corresponding section opens/drops.
    const droppedSections = boat?.droppedSections || [];
    for (const [sectionNum, baitSlot] of Object.entries(BOAT_BAIT_SLOTS)) {
      const isDropped = droppedSections.includes(Number(sectionNum));
      scene.setSlotVisible?.(baitSlot, !isDropped);
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

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#generation += 1;
    this.#load?.release();
    this.#load = null;
    this.#replaceScene(null);
    this.#bundle = null;
  }

  async #onBundle(generation, outcome) {
    if (generation !== this.#generation) return;
    if (outcome.status !== "ready") {
      this.#replaceScene(null);
      return;
    }
    this.#bundle = outcome.bundle;
    const runtimeOutcome = await this.#loadRuntime(outcome.bundle.version);
    if (generation !== this.#generation) return;
    if (runtimeOutcome.status !== "ready") {
      this.#replaceScene(null);
      return;
    }
    const { scene } = runtimeOutcome.createScene({
      bundle: outcome.bundle,
      surface: this.#glSurface,
    });
    this.#replaceScene(scene);
  }

  #replaceScene(scene) {
    if (this.#scene === scene) return;
    this.#scene?.dispose();
    this.#scene = scene;
  }
}
