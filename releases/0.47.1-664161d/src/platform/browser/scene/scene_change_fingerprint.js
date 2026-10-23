// Visible change detection for scene kinds whose models are rebuilt every frame (spec 107 D3). A renderer feeds every
// value it draws; the fingerprint rounds lengths to 0.05 logical px and opacities to half an 8-bit step (spec 105 D3's
// visibility thresholds), so the scene presents a frame only when the picture changed. A collision is harmless: it
// skips one frame of an object that moves again the next.
const POSITION_STEPS = 20;
const ALPHA_STEPS = 510;

export class SceneChangeFingerprint {
  #hash = 0;
  #last = null;

  begin() {
    this.#hash = 17;
  }

  length(value) {
    this.#mix(Math.round((Number(value) || 0) * POSITION_STEPS));
  }

  alpha(value) {
    this.#mix(Math.round((Number(value) || 0) * ALPHA_STEPS));
  }

  flag(value) {
    this.#mix(value ? 1 : 2);
  }

  text(value) {
    const text = String(value ?? "");
    this.#mix(text.length);
    for (let index = 0; index < text.length; index += 1) this.#mix(text.charCodeAt(index));
  }

  // Whether the values fed since begin() differ from the last finished fingerprint.
  finish() {
    const changed = this.#hash !== this.#last;
    this.#last = this.#hash;
    return changed;
  }

  // The next finish() reports a change (the picture was hidden or its resources replaced).
  invalidate() {
    this.#last = null;
  }

  #mix(value) {
    this.#hash = (Math.imul(this.#hash, 31) + (value | 0)) | 0;
  }
}
