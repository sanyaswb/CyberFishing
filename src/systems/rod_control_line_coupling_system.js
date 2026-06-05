class RodControlLineCouplingSystem {
  resolve({
    rodControlActive = false,
    lineCanRelease = false,
    dragSlipping = false,
    config,
  } = {}) {
    const cfg = config || {};
    const active = !!rodControlActive;
    const slipMode = active && !!lineCanRelease && !!dragSlipping;
    const mode = !active
      ? "free"
      : slipMode
        ? "drag_slip"
        : "tight_line";

    return {
      mode,
      fishDrivesRodVisual:
        mode === "tight_line" &&
        cfg.tightLineUsesFishDrivenVisual !== false,
      inputDrivesRodVisual:
        mode === "drag_slip" &&
        cfg.dragSlipUsesInputDrivenVisual !== false,
      lineHasReserve: !!lineCanRelease,
      dragSlipping: !!dragSlipping,
    };
  }
}
