import { AquariumCareCalculator } from "../../domain/live_bait/aquarium_care_calculator.js";
import { FeedSlotPriorityPolicy } from "../../domain/live_bait/feed_slot_priority_policy.js";

export class LiveBaitCareService {
  #clock;
  #config;
  #calculator;
  #priority = new FeedSlotPriorityPolicy();
  constructor({ clock, config }) {
    this.#clock = clock;
    this.#config = config;
    this.#calculator = new AquariumCareCalculator(config);
  }
  settle(state) {
    const now = Math.max(state.lastAppliedAtMs, this.#clock.nowMs());
    if (now === state.lastAppliedAtMs) return false;
    let changed = false;
    while (state.lastAppliedAtMs < now) {
      this.#autoFill(state);
      const available = now - state.lastAppliedAtMs;
      let step = available;
      const groups = new Map();
      const fractionBefore = new Map();
      for (const fish of state.fish) if (fish.purpose === "live_bait" && fish.disposition === "aquarium") {
        groups.set(fish.speciesId, (groups.get(fish.speciesId) || 0) + 1);
      }
      for (const [speciesId, count] of groups) {
        const food = state.aquarium.feedBySpecies[speciesId] || 0;
        fractionBefore.set(speciesId, food);
        if (food > 0) step = Math.min(step, Math.max(0.001, this.#calculator.timeToEmpty(food, count)));
      }
      for (const fish of state.fish) {
        if (fish.purpose !== "live_bait" || !["keepnet", "hook", "aquarium"].includes(fish.disposition)) continue;
        if (fish.disposition === "aquarium" && (state.aquarium.feedBySpecies[fish.speciesId] || 0) > 0) continue;
        step = Math.min(step, Math.max(0.001, fish.remainingLifetimeMs));
      }
      for (const [speciesId, count] of groups) {
        const fraction = state.aquarium.feedBySpecies[speciesId] || 0;
        if (fraction > 0) state.aquarium.feedBySpecies[speciesId] = this.#calculator.after(fraction, count, step);
      }
      for (const fish of state.fish) {
        if (fish.purpose !== "live_bait" || !["keepnet", "hook", "aquarium"].includes(fish.disposition)) continue;
        if (fish.disposition === "aquarium" && fractionBefore.get(fish.speciesId) > 0) continue;
        fish.remainingLifetimeMs = Math.max(0, fish.remainingLifetimeMs - step);
        if (fish.remainingLifetimeMs <= 0) { fish.disposition = "dead"; if (state.selectedFishId === fish.id) state.selectedFishId = null; }
      }
      state.lastAppliedAtMs += step;
      changed = true;
      this.#removeEmptySlots(state);
      this.#autoFill(state);
    }
    return changed;
  }
  #autoFill(state) {
    if (!state.feedSupply.autoFeederOwned || !state.feedSupply.autoFeederEnabled) return;
    const counts = new Map();
    for (const fish of state.fish) if (fish.disposition === "aquarium") counts.set(fish.speciesId, (counts.get(fish.speciesId) || 0) + 1);
    while (state.feedSupply.portions > 0) {
      const candidates = [...counts].map(([speciesId, count]) => ({ speciesId, count,
        foodFraction: state.aquarium.feedBySpecies[speciesId] || 0 }))
        .filter((slot) => slot.foodFraction <= this.#config.autoFeedTriggerFraction);
      const slot = this.#priority.choose(candidates);
      if (!slot) return;
      state.aquarium.feedBySpecies[slot.speciesId] = 1;
      state.feedSupply.portions--;
    }
  }
  #removeEmptySlots(state) {
    const occupied = new Set(state.fish.filter((fish) => fish.disposition === "aquarium").map((fish) => fish.speciesId));
    for (const id of Object.keys(state.aquarium.feedBySpecies)) if (!occupied.has(id)) delete state.aquarium.feedBySpecies[id];
  }
}
