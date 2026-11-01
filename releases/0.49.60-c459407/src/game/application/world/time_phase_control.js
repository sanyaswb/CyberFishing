import { backgroundTimeBlend } from "../../domain/time/background_time_blend.js";

// Changes the shared calendar anchor, never elapsed simulation time or real-time care timers.
export class TimePhaseControl {
  #clock;
  #hours;
  #blend = { evening: 0, night: 0 };
  constructor({ clock, phaseHours }) { this.#clock = clock; this.#hours = phaseHours; }
  advance() {
    backgroundTimeBlend(this.#clock.getHours(), this.#blend);
    // A dusk transition already contains some night artwork; it is still the evening phase.
    const hours = this.#blend.night >= 1 ? this.#hours.day : this.#blend.evening > 0 ? this.#hours.night : this.#hours.evening;
    this.#clock.setHours(hours);
  }
}
