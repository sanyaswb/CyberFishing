// What the Spine rod shows this frame (spec 099 "Pose mapping"): pure, writes into a reused snapshot.
// Not fighting: the idle clip follows the wind (-1 left, 0 calm, +1 right; owner D4). Fighting: the fight ramps are
// sampled by the bend target (the tension bar's fill, or the rod's stress by config), the front ramp weighted
// 1 - |side| and the side ramp |side|; the
// side is the fish's screen offset from the rod base over sideRangeRatio of the canvas width. Critical (the tackle
// STRESS bar shows) adds the looping tremble clip of the fish's side over the bend.
export class RodAnimationStateResolver {
  createSnapshot() {
    return {
      fighting: false,
      idleClip: "",
      idleTimeScale: 1,
      frontClip: "",
      sideClip: "",
      side: 0,
      frontAlpha: 1,
      sideAlpha: 0,
      bendTarget: 0,
      critical: false,
      criticalClip: "",
    };
  }

  // input: { state, stressRatio, tensionRatio, fishScreenX, rodBaseX, canvasWidth, windDirection, rainMultiplier,
  // reducedMotion, critical }
  resolve(input, config, out) {
    const windClips = config.windClips;
    const fightClips = config.fightClips;
    const wind = Math.sign(Number(input.windDirection) || 0);
    out.fighting = input.state === "playing";
    out.idleClip = wind < 0 ? windClips.left : wind > 0 ? windClips.right : windClips.calm;
    const rain = Number(input.rainMultiplier);
    out.idleTimeScale = input.reducedMotion ? 0 : config.windRainTimeScale && rain > 0 ? rain : 1;
    const range = Math.max(1, (Number(input.canvasWidth) || 0) * (Number(config.sideRangeRatio) || 0));
    const offset = (Number(input.fishScreenX) || 0) - (Number(input.rodBaseX) || 0);
    const side = out.fighting ? Math.max(-1, Math.min(1, offset / range)) : 0;
    out.side = side;
    out.frontClip = fightClips.front;
    out.sideClip = side < 0 ? fightClips.left : fightClips.right;
    out.sideAlpha = Math.abs(side);
    out.frontAlpha = 1 - out.sideAlpha;
    // bendSource "tension" (owner 2026-10-17): a full tension bar is the full bend; "rodStress": the rod's own load.
    const load = Number(config.bendSource === "rodStress" ? input.stressRatio : input.tensionRatio);
    out.bendTarget = out.fighting && Number.isFinite(load) ? Math.max(0, Math.min(1, load)) : 0;
    out.critical = out.fighting && input.critical === true;
    out.criticalClip = side < 0 ? config.criticalClips.left : config.criticalClips.right;
    return out;
  }
}
