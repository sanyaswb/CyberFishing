class FightPhysicsOverlayModule extends OverlayModule {
  #groups;

  constructor({
    settingsStore = typeof window !== "undefined" ? window.OverlaySettingsStore : null,
    htmlBuilder = new OverlayHtmlBuilder(),
    groups = null,
  } = {}) {
    super("fightPhysics", { settingsStore, htmlBuilder });
    const sectionOptions = { settingsStore, htmlBuilder };
    this.#groups =
      groups ||
      [
        {
          key: "fightCore",
          title: "CORE",
          sections: [
            new FightFishSection(sectionOptions),
            new FightMovementSection(sectionOptions),
          ],
        },
        {
          key: "fightPlayerForce",
          title: "PLAYER FORCE",
          sections: [
            new FightRodHoldSection(sectionOptions),
            new FightReelHoldSection(sectionOptions),
            new FightAutoRecoverySection(sectionOptions),
          ],
        },
        {
          key: "fightLineDrag",
          title: "LINE & DRAG",
          sections: [
            new FightLineSection(sectionOptions),
            new FightDragSection(sectionOptions),
          ],
        },
        {
          key: "fightRodControl",
          title: "ROD CONTROL",
          sections: [new FightRodControlSection(sectionOptions)],
        },
        {
          key: "fightStress",
          title: "STRESS",
          sections: [new FightTensionSection(sectionOptions)],
        },
        {
          key: "fightStroke",
          title: "STROKE",
          sections: [new FightRodStrokeSection(sectionOptions)],
        },
      ];
  }

  isActive(data) {
    return (
      this.shouldRender(data) &&
      (this.settingsStore?.isEnabled?.("fightPhysics") ||
        this.settingsStore?.anyEnabled?.(FIGHT_PHYSICS_RENDER_KEYS))
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
    html += this.#groups
      .map((group) => this.#renderGroup(group, normalized))
      .join("");
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }

  #renderGroup(group, data) {
    const forceDefaultSummary =
      group.key === "fightCore" &&
      this.settingsStore?.isEnabled?.("fightPhysics");
    const body = group.sections
      .map((section, index) =>
        section.render(data, { force: forceDefaultSummary && index === 0 }),
      )
      .join("");

    if (!body) return "";

    return `<div style="color:#8a9bac; font-weight:bold; margin:8px 0 5px; font-size:11px; letter-spacing:0; text-transform:uppercase;">${this.htmlBuilder.escapeHtml(group.title)}</div>${body}`;
  }
}

window.FightPhysicsOverlayModule = FightPhysicsOverlayModule;
