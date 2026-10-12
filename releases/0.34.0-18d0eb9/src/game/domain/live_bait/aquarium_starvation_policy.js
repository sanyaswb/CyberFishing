import { SeededRng } from "../../../engine/random/seeded_rng.js";

export class AquariumStarvationPolicy {
  deadline(episode, fishId, nowMs) {
    const end = episode.startedAtMs + episode.windowMs;
    const start = Math.max(episode.startedAtMs, nowMs);
    const roll = new SeededRng(`${episode.seed}:${fishId}`).next();
    return Math.min(end, start + Math.max(1, Math.ceil(roll * (end - start))));
  }
  nextSeed(seed) { return (Math.imul(seed, 1664525) + 1013904223) >>> 0; }
}
