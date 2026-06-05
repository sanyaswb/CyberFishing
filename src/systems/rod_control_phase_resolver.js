class RodControlPhaseResolver {
  resolve({
    rodControlActive = false,
    fishAligned = false,
    couplingMode = "free",
    rodControlCanApply = false,
    rodControlAtLimit = false,
    lateralReelHoldFrame,
  } = {}) {
    if (!rodControlActive) return "inactive";
    if (fishAligned) return "aligned";
    if (couplingMode === "drag_slip") return "drag_slip";
    if (!rodControlCanApply && !rodControlAtLimit) return "blocked";
    if (!rodControlAtLimit) return "rod_sweep";
    if (lateralReelHoldFrame?.active) return "lateral_reel_hold";
    return "blocked_at_limit";
  }
}
