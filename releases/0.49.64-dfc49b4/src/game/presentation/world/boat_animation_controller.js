import {
  BOAT_ANIMATION_CLIPS,
  BOAT_LIGHT_SLOTS,
  BOAT_BAIT_SLOTS,
  BOAT_SECTION_CLIPS,
} from "../../domain/chum/boat_animation_state.js";

// Animation controller for the bait boat Spine skeleton (spec 150).
// Controls immersion, start and forward movement loops, compartment door opening,
// night lights and bait attachment visibility. No clip keys the light, bait or extra wave slots, and the held doors
// stay sampled, so those are written only when they change (docs/rendering.md rule 22, TK-160).
export class BoatAnimationController {
  #loadBundle;
  #loadRuntime;
  #glSurface;
  #descriptor = { asset: "", skin: "" };
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
  #slotVisible = new Map();
  #heldSections = "";

  constructor({
    loadBundle,
    loadRuntime,
    glSurface,
  }) {
    if (typeof loadBundle !== "function") throw new TypeError("BoatAnimationController requires loadBundle");
    if (typeof loadRuntime !== "function") throw new TypeError("BoatAnimationController requires loadRuntime");
    if (typeof glSurface?.ensureContext !== "function") throw new TypeError("BoatAnimationController requires glSurface");
    this.#loadBundle = loadBundle;
    this.#loadRuntime = loadRuntime;
    this.#glSurface = glSurface;
  }

  setDescriptor(animation) {
    if (this.#disposed) return;
    const asset = animation?.asset ?? "";
    const skin = animation?.skin ?? "";
    const current = this.#descriptor;
    if (current.asset === asset && current.skin === skin) return;
    current.asset = asset;
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

    if (!asset) {
      this.#replaceScene(null);
      this.#bundle = null;
      return;
    }

    const load = this.#loadBundle({ asset, skin: skin || null });
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
      this.#slotVisible.clear();
      this.#heldSections = "";
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
    } else if (animationState === "moving") {
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

    // Spec 150: night lights burn at night in every state except immersion; TK-160: only while the battery powers them.
    const shouldLight = isNight && targetClip !== BOAT_ANIMATION_CLIPS.IMMERSION && Number(boat?.powerRatio) > 0;
    if (this.#lightsActive !== shouldLight) {
      this.#lightsActive = shouldLight;
      for (const lightSlot of BOAT_LIGHT_SLOTS) {
        scene.setSlotVisible?.(lightSlot, shouldLight);
      }
    }

    // Spec 155 (owner 2026-10-30): the procedural wake (BoatWakeEmitter) replaces the Spine wave; boats-wave--2 and
    // --3 were never animated (owner 2026-10-29).
    this.#setSlot(scene, "boats-wave--1", false);
    this.#setSlot(scene, "boats-wave--2", false);
    this.#setSlot(scene, "boats-wave--3", false);

    // Spec 150: bait attachments turn off once their corresponding section opens/drops.
    const droppedSections = boat?.droppedSections || [];
    for (const [sectionNum, baitSlot] of Object.entries(BOAT_BAIT_SLOTS)) {
      this.#setSlot(scene, baitSlot, !droppedSections.includes(Number(sectionNum)));
    }

    // Spec 150 (owner instruction 2026-10-29): keep dropped compartments open across subsequent moves.
    const heldSections = droppedSections.join(",");
    if (heldSections !== this.#heldSections) {
      this.#heldSections = heldSections;
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
    };
  }

  #setSlot(scene, slotName, visible) {
    if (this.#slotVisible.get(slotName) === visible) return;
    this.#slotVisible.set(slotName, visible);
    scene.setSlotVisible?.(slotName, visible);
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
    this.#heldSections = "";
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
    return {
      fileName: this.#bundle.skeletonFile,
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
    const bundle = outcome.bundle;
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

  #replaceScene(scene) {
    if (this.#scene === scene) return;
    this.#scene?.dispose();
    this.#scene = scene;
    this.#lastBoat = null;
  }
}
