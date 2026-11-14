// TK-192 / TK-192.1: the float's depth before the player chooses one is half of the deepest depth the CURRENT tackle can
// be set to, on the depth track's 0.1 m grid (owner: at the shallowest depth nothing bites, and a player who forgets to
// set the depth would wait for a bite forever). Pure; never below one grid step.
const DEPTH_STEP_METERS = 0.1;

export function defaultHookDepthMeters(maxDepthMeters) {
  const max = Number(maxDepthMeters);
  if (!(max > 0)) return DEPTH_STEP_METERS;
  const steps = Math.max(1, Math.round((max * 0.5) / DEPTH_STEP_METERS));
  return Math.round(steps) / Math.round(1 / DEPTH_STEP_METERS);
}
