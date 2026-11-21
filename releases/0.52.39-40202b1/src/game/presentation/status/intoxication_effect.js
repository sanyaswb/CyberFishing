// Spec 179 stage L (TK-374, owner): the vodka drunk without radiation makes the player drunk — «ефект розмиття та
// покачування … чим більше пляшок випито тим більше розмиття та прокачування максимум 5 пляшок. Якщо починається
// радіаційний вплив під час сп'яніння то похитування плавно закінчується і починає діяти як баф».
// - The strength by the bottles (stacks 1…maxStacks): the sway's amplitude from swayShare[0] to [1] of the screen's
//   width (owner Q24 starting values: 1 → 5 %); the world's blur is a defocus that comes and goes by the bottles
//   (IntoxicationBlur, TK-374.2; settings.blur); from four bottles the frame waves — a skew and an uneven stretch
//   (IntoxicationWarp, TK-374.3; settings.warp), faded with the rest.
// - The sway: a slow figure of eight (x: one swing, y: half as high and twice as fast), its period wandering between
//   swayPeriodSec[0] and [1] on a slower drift, so the rhythm never settles.
// - Under radiation (the «Радіація» status) the blur and the sway fade out over fadeSec — the vodka works as the buff
//   then (its emission modifiers); the radiation gone and the vodka still on, they fade back in.
// - Sobering (TK-378): the level the statuses give (stacks worn off by the time left) drops a level; the stage glides
//   down over soberSec, so the defocus, the waves and the sway pass between the levels; after the vodka ends the last
//   level fades over soberSec too.
// The blur's episodes draw from random (visual only); one record rewritten in place: { blurPx, x, y, marginX, marginY } in logical px (the margins — the sway's
// amplitude, for the scene's cover).
import { clampUnit, finiteOr, pairBetween } from "../../../engine/math/number_normalization.js";
import { IntoxicationBlur } from "./intoxication_blur.js";
import { IntoxicationWarp } from "./intoxication_warp.js";
const TWO_PI = Math.PI * 2;
// The sway's period drifts on a slower wave with this period (s).
const PERIOD_DRIFT_SEC = 29;
const smooth = (share) => share * share * (3 - 2 * share);

export class IntoxicationEffect {
  #level = 0;
  // TK-378: the stage shown, 1…maxStacks, fractional while sobering; it keeps the last bottles while the end fades.
  #stage = 0;
  #phase = 0;
  #driftPhase = 0;
  #blur;
  #warp;
  #record = { blurPx: 0, x: 0, y: 0, marginX: 0, marginY: 0, level: 0, skewX: 0, skewY: 0, stretchX: 0, stretchY: 0 };

  // random: () => 0…1 for the blur's episodes (Math.random: visual only).
  constructor({ random }) {
    this.#blur = new IntoxicationBlur({ random });
    this.#warp = new IntoxicationWarp({ random });
  }

  get record() {
    return this.#record;
  }

  // dtMs: real milliseconds since the last frame; stacks: the vodka's stacks now (0 — sober); maxStacks: its maximum;
  // underRadiation: the «Радіація» status is on; viewWidth: the logical screen's width; settings: CONFIG.canvas.intoxication.
  update(dtMs, stacks, maxStacks, underRadiation, viewWidth, settings) {
    const record = this.#record;
    const count = Math.max(0, Math.floor(finiteOr(stacks, 0)));
    const drunk = settings?.enabled === true && count > 0 && underRadiation !== true;
    const dt = Math.max(0, finiteOr(dtMs, 0)) / 1000;
    const top = Math.max(1, Math.floor(finiteOr(maxStacks, 1)));
    // TK-378: another bottle raises the stage at once (the blur and the waves ease into it themselves); sobering lowers it
    // over soberSec a level, so the defocus, the waves and the sway glide down between the levels.
    const soberSec = Math.max(0.1, finiteOr(settings?.soberSec, 30));
    if (count > 0) {
      const target = Math.min(count, top);
      this.#stage = target >= this.#stage ? target : Math.max(target, this.#stage - dt / soberSec);
    }
    // The vodka over: the last level fades over soberSec; under radiation (or switched off) over fadeSec.
    const fadeSec = Math.max(0.01, drunk || count > 0 ? finiteOr(settings?.fadeSec, 3) : soberSec);
    this.#level = clampUnit(this.#level + (drunk ? dt : -dt) / fadeSec);
    if (this.#level <= 0) return this.#rest();
    const stage = Math.max(1, this.#stage);
    const share = top > 1 ? clampUnit((stage - 1) / (top - 1)) : 1;
    const level = smooth(this.#level);
    record.level = level;
    record.blurPx = this.#blur.update(dt, stage, settings?.blur) * level;
    const amplitude = Math.max(0, pairBetween(settings?.swayShare, 0.01, 0.05, share)) * Math.max(0, finiteOr(viewWidth, 0)) * level;
    this.#driftPhase = (this.#driftPhase + dt * TWO_PI / PERIOD_DRIFT_SEC) % TWO_PI;
    const period = Math.max(0.5, pairBetween(settings?.swayPeriodSec, 6, 9, (Math.sin(this.#driftPhase) + 1) / 2));
    this.#phase = (this.#phase + dt * TWO_PI / period) % TWO_PI;
    record.x = amplitude * Math.sin(this.#phase);
    record.y = amplitude * 0.5 * Math.sin(this.#phase * 2);
    record.marginX = amplitude;
    record.marginY = amplitude * 0.5;
    const warp = this.#warp.update(dt, stage, level, settings?.warp);
    record.skewX = warp.skewX;
    record.skewY = warp.skewY;
    record.stretchX = warp.stretchX;
    record.stretchY = warp.stretchY;
    return record;
  }

  #rest() {
    const record = this.#record;
    this.#phase = 0;
    this.#stage = 0;
    this.#blur.reset();
    this.#warp.reset();
    record.skewX = 0;
    record.skewY = 0;
    record.stretchX = 0;
    record.stretchY = 0;
    record.level = 0;
    record.blurPx = 0;
    record.x = 0;
    record.y = 0;
    record.marginX = 0;
    record.marginY = 0;
    return record;
  }
}
