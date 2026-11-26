import { stackTimedStatus, statusLevel, statusModifierShare } from "../../domain/status/status_effect_rules.js";

// Spec 181 D1 (stage A): the player's buffs and debuffs. Statuses are described in CONFIG.statusEffects (read live, so
// a DevTools edit reaches the next apply and the modifiers at once); this keeps the active ones.
// - apply(id, { source }): a timed status (a drunk vodka) starts, or stacks by its rule (status_effect_rules.js).
// - hold(id, on, { source }): a status without a timer that lasts while its source says so (the gas mask in its slot,
//   the location's radiation).
// - modifier(system, key): the share of a system's effect that stays (1: unchanged, 0: none), the product over the
//   active statuses; systems read only their own keys (EmissionExposure: emission.vignette, .blur, .blurRate).
// - list(): the active statuses in the order they started (one reused array; entries change only on events).
// - subscribe(listener): called on a status's start, update and end only, never per frame. The end comes from one
//   timer for the nearest end (scheduler), and reads drop an ended status too, so a throttled timer changes nothing.
// Time: the page's monotonic clock (Q1: real time); the statuses live with the session (Q7: a reload ends them).
export class PlayerStatusEffects {
  #now;
  #getDefinitions;
  #scheduler;
  #entries = new Map();
  #list = [];
  #listeners = new Set();
  #timer = null;
  #timerAtMs = Infinity;

  // now: () => milliseconds of a monotonic clock (performance.now); getDefinitions: () => CONFIG.statusEffects;
  // scheduler: { setTimeout, clearTimeout } (the window).
  constructor({ now, getDefinitions, scheduler }) {
    if (typeof now !== "function") throw new TypeError("PlayerStatusEffects requires now");
    if (typeof getDefinitions !== "function") throw new TypeError("PlayerStatusEffects requires getDefinitions");
    if (typeof scheduler?.setTimeout !== "function") throw new TypeError("PlayerStatusEffects requires scheduler");
    this.#now = now;
    this.#getDefinitions = getDefinitions;
    this.#scheduler = scheduler;
  }

  definition(id) {
    const definitions = this.#getDefinitions();
    return definitions && Object.hasOwn(definitions, id) ? definitions[id] : null;
  }

  // A timed status; true when it took effect (an unknown id or one without a duration does nothing).
  apply(id, { source = "" } = {}) {
    const definition = this.definition(id);
    if (!definition || !(Number(definition.durationSec) > 0)) return false;
    const now = this.#now();
    this.#expire(now);
    const current = this.#entries.get(id);
    if (current && current.held) return false;
    const entry = current ?? { id, kind: definition.kind, held: false, stacks: 0, startedAtMs: now, untilMs: now, source };
    stackTimedStatus(entry, definition, now, Boolean(current));
    entry.source = source;
    if (!current) this.#add(entry);
    this.#schedule();
    this.#emit(current ? "update" : "start", entry);
    return true;
  }

  // A status without a timer, on while its source holds it. Returns whether it changed. Spec 185 D4 (TK-382): modifiers —
  // the source's own modifiers ({ <system>: { <key>: share } }) instead of the description's; the source keeps the object
  // and may change its numbers in place (the gas mask's protection fading), read with every modifier() call.
  hold(id, on, { source = "", modifiers = null } = {}) {
    const current = this.#entries.get(id);
    if (!on) {
      if (!current?.held) return false;
      this.#delete(current);
      return true;
    }
    if (current?.held) return false;
    const definition = this.definition(id);
    if (!definition) return false;
    if (current) this.#delete(current);
    const now = this.#now();
    this.#add({ id, kind: definition.kind, held: true, stacks: 1, startedAtMs: now, untilMs: Infinity, source,
      sourceModifiers: modifiers ? { modifiers } : null });
    this.#emit("start", this.#entries.get(id));
    return true;
  }

  remove(id) {
    const entry = this.#entries.get(id);
    if (!entry) return false;
    this.#delete(entry);
    this.#schedule();
    return true;
  }

  // DEV «Зняти всі»: the timed statuses (of a kind, or all); held ones stay with their sources.
  clear(kind = null) {
    for (let index = this.#list.length - 1; index >= 0; index--) {
      const entry = this.#list[index];
      if (!entry.held && (!kind || entry.kind === kind)) this.#delete(entry);
    }
    this.#schedule();
  }

  has(id) {
    this.#expire(this.#now());
    return this.#entries.has(id);
  }

  list() {
    this.#expire(this.#now());
    return this.#list;
  }

  // TK-374: how many times an active status has stacked (the bottles drunk); 0 — not active. TK-378: the level in effect
  // now — the stacks worn off by the time left (statusLevel).
  stacks(id) {
    const now = this.#now();
    this.#expire(now);
    const entry = this.#entries.get(id);
    return entry ? statusLevel(entry, this.definition(id), now) : 0;
  }

  remainingSec(id) {
    const entry = this.#entries.get(id);
    if (!entry) return 0;
    if (entry.held) return Infinity;
    return Math.max(0, (entry.untilMs - this.#now()) / 1000);
  }

  modifier(system, key) {
    const now = this.#now();
    if (now >= this.#timerAtMs) this.#expire(now);
    let share = 1;
    const list = this.#list;
    for (let index = 0; index < list.length; index++) {
      const entry = list[index];
      if (!entry.held && entry.untilMs <= now) continue;
      const definition = this.definition(entry.id);
      share *= statusModifierShare(entry.sourceModifiers ?? definition, system, key, statusLevel(entry, definition, now));
    }
    return share;
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose() {
    if (this.#timer !== null) this.#scheduler.clearTimeout(this.#timer);
    this.#timer = null;
    // TK-358: no timer is pending any more, so the next apply schedules one again.
    this.#timerAtMs = Infinity;
    this.#listeners.clear();
  }

  #add(entry) {
    this.#entries.set(entry.id, entry);
    this.#list.push(entry);
  }

  #delete(entry) {
    this.#entries.delete(entry.id);
    const index = this.#list.indexOf(entry);
    if (index >= 0) this.#list.splice(index, 1);
    this.#emit("end", entry);
  }

  #expire(now) {
    for (let index = this.#list.length - 1; index >= 0; index--) {
      const entry = this.#list[index];
      if (!entry.held && entry.untilMs <= now) this.#delete(entry);
    }
    if (now >= this.#timerAtMs) this.#schedule();
  }

  // One timer for the nearest end.
  #schedule() {
    let next = Infinity;
    for (const entry of this.#list) if (!entry.held && entry.untilMs < next) next = entry.untilMs;
    if (next === this.#timerAtMs) return;
    if (this.#timer !== null) this.#scheduler.clearTimeout(this.#timer);
    this.#timer = null;
    this.#timerAtMs = next;
    if (next === Infinity) return;
    this.#timer = this.#scheduler.setTimeout(() => {
      this.#timer = null;
      this.#timerAtMs = Infinity;
      this.#expire(this.#now());
      this.#schedule();
    }, Math.max(0, next - this.#now()) + 1);
  }

  #emit(type, entry) {
    for (const listener of this.#listeners) listener({ type, id: entry.id, entry });
  }
}
