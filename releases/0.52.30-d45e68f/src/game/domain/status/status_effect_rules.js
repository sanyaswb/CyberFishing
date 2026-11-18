// Spec 181 D1: the rules of a player's status (a buff or a debuff) — how a repeated apply stacks and how its modifiers
// combine. Pure functions over plain data; the application keeps the entries and the clock.
// A description (CONFIG.statusEffects.<id>): { kind: "buff" | "debuff", iconAsset, durationSec (0: no timer — a held
// status from the equipment or the environment), stacking: "renew" | "max" | "add", maxStacks, timeBase: "real",
// badge (shown in the HUD), modifiers: { <system>: { <key>: share that stays, 0…1 } } }.
import { finiteOr } from "../../../engine/math/number_normalization.js";
export const STATUS_KINDS = Object.freeze(["buff", "debuff"]);
export const STATUS_STACKING = Object.freeze(["renew", "max", "add"]);
// Spec 181 Q1: real time (the page's monotonic clock). "game" is reserved for a later status.
export const STATUS_TIME_BASES = Object.freeze(["real"]);

export function statusDurationMs(definition) {
  return Math.max(0, finiteOr(definition?.durationSec, 0)) * 1000;
}

// A timed apply onto entry ({ stacks, startedAtMs, untilMs }): a fresh entry starts; an active one stacks by its rule —
// renew: the time starts again; max: the longer of what is left and a full duration; add: one more stack (up to
// maxStacks) and the time starts again. Returns the entry.
export function stackTimedStatus(entry, definition, nowMs, active) {
  const durationMs = statusDurationMs(definition);
  if (!active) {
    entry.stacks = 1;
    entry.startedAtMs = nowMs;
    entry.untilMs = nowMs + durationMs;
    return entry;
  }
  const stacking = definition?.stacking;
  if (stacking === "max") {
    if (nowMs + durationMs > entry.untilMs) {
      entry.startedAtMs = nowMs;
      entry.untilMs = nowMs + durationMs;
    }
    return entry;
  }
  if (stacking === "add") entry.stacks = Math.min(Math.max(1, Math.floor(finiteOr(definition?.maxStacks, 1))), entry.stacks + 1);
  entry.startedAtMs = nowMs;
  entry.untilMs = nowMs + durationMs;
  return entry;
}

// The share of a system's effect that stays under one status: its modifier (missing: 1), once per stack; a list is the
// share by the number of stacks (spec 179 Q25, TK-374: the vodka 1 bottle 0.7, 2 — 0.55, 3 and more — 0.4; past its
// end the last value stays).
export function statusModifierShare(definition, system, key, stacks) {
  const raw = definition?.modifiers?.[system]?.[key];
  if (raw === undefined || raw === null) return 1;
  if (Array.isArray(raw)) {
    if (raw.length === 0) return 1;
    const index = Math.min(raw.length, Math.max(1, Math.floor(finiteOr(stacks, 1)))) - 1;
    return Math.min(1, Math.max(0, finiteOr(raw[index], 1)));
  }
  const share = Math.min(1, Math.max(0, finiteOr(raw, 1)));
  return stacks > 1 ? share ** stacks : share;
}
