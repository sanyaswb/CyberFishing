class FightRodControlVisualSection extends FightSectionBase {
  constructor(options = {}) {
    super("fightRodControlVisual", "ROD CONTROL / VISUAL", {
      ...options,
      categoryKey: "fightRodControl",
    });
  }

  rows(d) {
    const f = this.formatter;
    return [
      this.row("Rod visual offset X", `${f.num(d.rodVisualOffsetX, 1)}px`, "#00d4ff"),
      this.row("Rod visual target X", `${f.num(d.rodVisualTargetOffsetX, 1)}px`, "#73c2fb"),
      this.row("Rod visual delta X", `${f.num(d.rodVisualDeltaX, 1)}px`, "#73c2fb"),
      this.row("Rod visual max X", `${f.num(d.rodVisualMaxOffsetX, 1)}px`, "#73c2fb"),
      this.row("Rod visual stroke", f.percent(d.rodVisualStrokeRatio, 1), f.stressColor(d.rodVisualStrokeRatio)),
      this.row("Rod visual weight speed", f.percent(d.rodVisualWeightSpeedRatio, 1), "#73c2fb"),
      this.row("Rod aim speed", `${f.num(d.rodAimSpeedPxPerSecond, 1)}px/s`, "#73c2fb"),
      this.row(
        "Rod aim fish load",
        `${f.kg(d.rodAimEffectiveFishLoadKg, 3)} / ${f.kg(d.rodAimLoadLimitKg, 3)}`,
        "#73c2fb",
      ),
      this.row("Rod aim fish load ratio", f.percent(d.rodAimFishLoadRatio, 1), f.stressColor(d.rodAimFishLoadRatio)),
      this.row("Rod aim weight speed", f.percent(d.rodAimWeightSpeedRatio, 1), "#73c2fb"),
      this.row("Rod aim weight curve", f.num(d.rodAimWeightCurvePower, 2), "#73c2fb"),
      this.row("Rod aim line mode", d.rodAimLineMode || "n/a", "#00d4ff"),
      this.row("Rod aim line speed", f.percent(d.rodAimLineSpeedRatio, 1), "#73c2fb"),
      this.row("Rod aim direction mode", d.rodAimDirectionSpeedMode || "n/a", "#73c2fb"),
      this.row("Rod aim direction speed", f.percent(d.rodAimDirectionSpeedRatio, 1), "#73c2fb"),
      this.row(
        "Rod aim fish dir X",
        f.num(d.rodAimFishDirectionX, 0),
        Number(d.rodAimFishDirectionX) ? "#73c2fb" : "#8a9bac",
      ),
      this.row("Rod aim load speed", f.percent(d.rodAimLoadSpeedRatio, 1), "#73c2fb"),
      this.row("Visual mode", d.rodControlVisualMode || "n/a", "#00d4ff"),
      this.row(
        "Visual free-line mode",
        d.rodControlFreeLineVisualMode ? "yes" : "no",
        d.rodControlFreeLineVisualMode ? "#00ff80" : "#8a9bac",
      ),
      this.row(
        "Visual driven by input",
        d.rodControlVisualDrivenByInput ? "yes" : "no",
        d.rodControlVisualDrivenByInput ? "#00ff80" : "#8a9bac",
      ),
      this.row(
        "Rod visual at limit",
        d.rodVisualAtLimit ? "yes" : "no",
        d.rodVisualAtLimit ? "#ffaa00" : "#8a9bac",
      ),
      this.row(
        "Rod visual clamped",
        d.rodVisualClamped ? "yes" : "no",
        d.rodVisualClamped ? "#ffaa00" : "#8a9bac",
      ),
      this.row(
        "Pull inertia",
        `${f.num(d.playerPullMotionInertiaSeconds, 3)}s`,
        d.playerPullMotionEnabled ? "#00d4ff" : "#8a9bac",
      ),
      this.row("Smoothed move X", f.meters(d.playerPullActualMoveX, 3), "#00ff80"),
      this.row("Pull velocity X", `${f.num(d.playerPullVelocityX, 3)}m/s`, "#73c2fb"),
    ];
  }
}

window.FightRodControlVisualSection = FightRodControlVisualSection;
