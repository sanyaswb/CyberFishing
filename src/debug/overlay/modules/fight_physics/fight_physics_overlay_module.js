class FightPhysicsOverlayModule extends OverlayModule {
  #sections;

  constructor({
    settingsStore = typeof window !== "undefined" ? window.OverlaySettingsStore : null,
    htmlBuilder = new OverlayHtmlBuilder(),
    sections = null,
  } = {}) {
    super("fightPhysics", { settingsStore, htmlBuilder });
    this.#sections =
      sections ||
      [
        new FightFishSection({ settingsStore, htmlBuilder }),
        new FightRodHoldSection({ settingsStore, htmlBuilder }),
        new FightReelHoldSection({ settingsStore, htmlBuilder }),
        new FightDragSection({ settingsStore, htmlBuilder }),
        new FightLineSection({ settingsStore, htmlBuilder }),
        new FightRodStrokeSection({ settingsStore, htmlBuilder }),
        new FightAutoRecoverySection({ settingsStore, htmlBuilder }),
        new FightMovementSection({ settingsStore, htmlBuilder }),
        new FightTensionSection({ settingsStore, htmlBuilder }),
      ];
  }

  isActive(data) {
    return (
      this.shouldRender(data) &&
      (this.settingsStore?.isEnabled?.("fightPhysics") ||
        this.settingsStore?.anyEnabled?.(FIGHT_PHYSICS_SECTION_KEYS))
    );
  }

  shouldRender(data) {
    return data.gameState === "playing";
  }

  render(data) {
    const lineRemaining = Math.max(0, Number(data.lineRemainingMeters) || 0);
    const lineMaxRemaining = Math.max(
      0,
      Number(data.lineMaxRemainingMeters) || 0,
    );
    const rodStrokeUsed = Math.max(
      0,
      Number(data.rodStrokeUnrecoveredMeters) || 0,
    );
    const rodStrokeCapacity = Math.max(
      0,
      Number(data.rodStrokeCapacityMeters) || 0,
    );
    const normalized = {
      ...data,
      lineRemaining,
      lineMaxRemaining,
      rodStrokeUsed,
      rodStrokeCapacity,
    };

    let html = this.formatHeader("FIGHT PHYSICS", "#73c2fb");
    html += this.#sections.map((section) => section.render(normalized)).join("");
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }
}

window.FightPhysicsOverlayModule = FightPhysicsOverlayModule;
