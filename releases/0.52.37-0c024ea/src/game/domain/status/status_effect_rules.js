// Spec 181 D1: the rules of a player's status (a buff or a debuff) — how a repeated apply stacks and how its modifiers
// combine. Pure functions over plain data; the application keeps the entries and the clock.
// A description (CONFIG.statusEffects.<id>): { kind: "buff" | "debuff", iconAsset, durationSec (0: no timer — a held
// status from the equipment or the environment), stacking: "renew" | "max" | "add", maxStacks, timeBase: "real",
// badge (shown in the HUD), levelSec (optional, TK-378: the time by the level, statusLevel), modifiers:
// { <system>: { <key>: share that stays, 0…1 } } }.
import { finiteOr, listValue } from "../../../engine/math/number_normalization.js";
export const STATUS_KINDS = Object.freeze(["buff", "debuff"]);
export const STATUS_STACKING = Object.freeze(["renew", "max", "add"]);
// Spec 181 Q1: real time (the page's monotonic clock). "game" is reserved for a later status.
export const STATUS_TIME_BASES = Object.freeze(["real"]);

// The time a status lasts from an apply at level (1…): TK-378 — levelSec[level − 1] when the status has the list (past
// its end the last value), else durationSec.
export function statusDurationMs(definition, level = 1) {
  const levels = definition?.levelSec;
  const seconds = Array.isArray(levels) && levels.length > 0
    ? listValue(levels, Math.floor(finiteOr(level, 1)) - 1, 0)
    : finiteOr(definition?.durationSec, 0);
  return Math.max(0, seconds) * 1000;
}

// A timed apply onto entry ({ stacks, startedAtMs, untilMs }): a fresh entry starts; an active one stacks by its rule —
// renew: the time starts again; max: the longer of what is left and a full duration; add: one more stack (up to
// maxStacks) and the time starts again (TK-378: the new level's time). Returns the entry.
export function stackTimedStatus(entry, definition, nowMs, active) {
  if (!active) {
    entry.stacks = 1;
    entry.startedAtMs = nowMs;
    entry.untilMs = nowMs + statusDurationMs(definition, 1);
    return entry;
  }
  const stacking = definition?.stacking;
  if (stacking === "max") {
    const durationMs = statusDurationMs(definition, 1);
    if (nowMs + durationMs > entry.untilMs) {
      entry.startedAtMs = nowMs;
      entry.untilMs = nowMs + durationMs;
    }
    return entry;
  }
  // TK-378: one more stack over the level in effect now (a worn-off level counts as it is, not as the stacks it had).
  if (stacking === "add") {
    entry.stacks = Math.min(Math.max(1, Math.floor(finiteOr(definition?.maxStacks, 1))), statusLevel(entry, definition, nowMs) + 1);
  }
  entry.startedAtMs = nowMs;
  entry.untilMs = nowMs + statusDurationMs(definition, stacking === "add" ? entry.stacks : 1);
  return entry;
}

// TK-378 (owner): a timed status with levelSec wears off by steps — an apply at level N lasts levelSec[N − 1], and
// level N holds while more than levelSec[N − 2] seconds are left (the vodka [60, 180, 300, 420, 600]: 5 bottles — 10 min,
// 10 → 7 min left level 5, 7 → 5 — 4, 5 → 3 — 3, 3 → 1 — 2, the last minute — 1; 1 bottle — 1 min at level 1; 2 — 3 min,
// the last of them at level 1). The level is never above the stacks. No list, or a held status: the stacks.
export function statusLevel(entry, definition, nowMs) {
  const stacks = Math.max(0, Math.floor(finiteOr(entry?.stacks, 0)));
  const levels = definition?.levelSec;
  if (!Array.isArray(levels) || levels.length === 0 || entry.held) return stacks;
  const leftSec = (finiteOr(entry.untilMs, 0) - finiteOr(nowMs, 0)) / 1000;
  if (!(leftSec > 0)) return 0;
  let level = 1;
  while (level < stacks && leftSec > listValue(levels, level - 1, 0)) level++;
  return level;
}

// The share of a system's effect that stays under one status: its modifier (missing: 1), once per stack; a list is the
// share by the number of stacks (spec 179 Q25, TK-374: the vodka 1 bottle 0.7, 2 — 0.55, 3 and more — 0.4; past its
// end the last value stays).
export function statusModifierShare(definition, system, key, stacks) {
  const raw = definition?.modifiers?.[system]?.[key];
  if (raw === undefined || raw === null) return 1;
  if (Array.isArray(raw)) {
    return Math.min(1, Math.max(0, listValue(raw, Math.floor(finiteOr(stacks, 1)) - 1, 1)));
  }
  const share = Math.min(1, Math.max(0, finiteOr(raw, 1)));
  return stacks > 1 ? share ** stacks : share;
}
