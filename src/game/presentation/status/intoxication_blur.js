// Spec 179 stage L, TK-374.2 (owner): the drunk world's blur as a defocus that comes and goes — «це повинно виглядати як
// розфокусування зору на якийсь час». Five blur levels (levelsPx, px); a stage is the bottles drunk (1…5): its constant
// defocus is floorLevel (0 — sharp) and, now and then, an episode rises to peakLevel and clears again.
// - An episode: rises over riseSec, stays at its top for holdSec, clears over fallSec (smooth, each a random time within
//   its range), its top a random depth share of the way from the floor to the peak; the next starts after intervalSec.
// - By the stage (lists of 5, a list's last value goes on): 1 bottle sharp, rarely blurred (to level 1); 2 — more often
//   (to 2); 3 — always level 1, now and then 3; 4 — always 2, more often to 4; 5 — always 3, to 5. From 3 bottles the
//   episodes come more often and stay longer at the top (the starting values; DevTools «Конфіг» → canvas → intoxication →
//   blur).
// - Another bottle (another stage) eases the floor and the peak over stageBlendSec: no jump.
// Visual only: random is Math.random (never a gameplay stream). No allocations per frame.
import { clampUnit, finiteOr, listValue, pairBetween } from "../../../engine/math/number_normalization.js";
// An episode's phases in order.
const NEXT_PHASE = Object.freeze({ wait: "rise", rise: "hold", hold: "fall", fall: "wait" });
const smooth = (share) => share * share * (3 - 2 * share);
const lerp = (from, to, share) => from + (to - from) * share;

export class IntoxicationBlur {
  #random;
  #floorPx = 0;
  #peakPx = 0;
  #phase = "wait";
  #phaseSec = 0;
  #phaseLeft = null;
  #depth = 1;
  #share = 0;

  constructor({ random }) {
    if (typeof random !== "function") throw new TypeError("IntoxicationBlur requires random");
    this.#random = random;
  }

  // dt: seconds since the last frame; stage: the bottles drunk, 1…; settings: CONFIG.canvas.intoxication.blur.
  // Returns the blur in logical px (before the intoxication's fade).
  update(dt, stage, settings) {
    const index = Math.max(0, Math.floor(finiteOr(stage, 1)) - 1);
    const floorPx = this.#levelPx(settings, listValue(settings?.floorLevel, index, 0));
    const peakPx = Math.max(floorPx, this.#levelPx(settings, listValue(settings?.peakLevel, index, 1)));
    const ease = 1 - Math.exp(-dt * 3 / Math.max(0.05, finiteOr(settings?.stageBlendSec, 2)));
    this.#floorPx += (floorPx - this.#floorPx) * ease;
    this.#peakPx += (peakPx - this.#peakPx) * ease;
    this.#advance(dt, index, settings);
    return Math.max(0, this.#floorPx + this.#share * this.#depth * (this.#peakPx - this.#floorPx));
  }

  // Sober again: sharp, the next episode after a fresh wait.
  reset() {
    this.#floorPx = 0;
    this.#peakPx = 0;
    this.#phase = "wait";
    this.#phaseSec = 0;
    this.#phaseLeft = null;
    this.#share = 0;
  }

  #advance(dt, index, settings) {
    if (this.#phaseLeft === null) this.#enter("wait", index, settings);
    this.#phaseLeft -= dt;
    // A large dt (a hidden tab) may pass several phases; four steps close one episode.
    for (let step = 0; step < 4 && this.#phaseLeft <= 0; step++) {
      const carry = this.#phaseLeft;
      this.#enter(NEXT_PHASE[this.#phase], index, settings);
      this.#phaseLeft += carry;
    }
    const progress = clampUnit(1 - this.#phaseLeft / this.#phaseSec);
    if (this.#phase === "rise") this.#share = smooth(progress);
    else if (this.#phase === "hold") this.#share = 1;
    else if (this.#phase === "fall") this.#share = 1 - smooth(progress);
    else this.#share = 0;
  }

  #enter(phase, index, settings) {
    this.#phase = phase;
    let seconds;
    if (phase === "wait") {
      seconds = lerp(listValue(settings?.intervalMinSec, index, 10), listValue(settings?.intervalMaxSec, index, 20), this.#random());
    } else if (phase === "rise") {
      this.#depth = clampUnit(pairBetween(settings?.depth, 0.6, 1, this.#random()));
      seconds = pairBetween(settings?.riseSec, 1.2, 3, this.#random());
    } else if (phase === "hold") {
      seconds = lerp(listValue(settings?.holdMinSec, index, 1), listValue(settings?.holdMaxSec, index, 2), this.#random());
    } else {
      seconds = pairBetween(settings?.fallSec, 1.5, 4, this.#random());
    }
    this.#phaseSec = Math.max(0.05, seconds);
    this.#phaseLeft = this.#phaseSec;
  }

  // Level 0 — sharp; level N — levelsPx[N − 1].
  #levelPx(settings, level) {
    const index = Math.floor(finiteOr(level, 0));
    if (index <= 0) return 0;
    return Math.max(0, listValue(settings?.levelsPx, index - 1, 0));
  }
}
