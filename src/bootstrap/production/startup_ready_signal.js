import { STARTUP_STAGES } from "../../engine/diagnostics/startup_stages.js";

// Spec 157 R9, stage A: the game is ready once the started loop has drawn its first frame. The loop requested its
// animation frame before start() resolved, so the frame callback requested here runs after the loop's first frame
// in the same animation frame. Stage D of spec 157 moves "ready" to the preloader's minimal barrier.
export function markStartupReady({ marks, windowTarget }) {
  marks.mark(STARTUP_STAGES.loop);
  windowTarget.requestAnimationFrame(() => marks.markReady());
}
