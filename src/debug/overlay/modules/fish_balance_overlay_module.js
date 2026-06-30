class FishBalanceModule extends OverlayModule {
  #liveForceSection;
  #forcePreviewSection;

  constructor(options = {}) {
    super("fishBalance", options);
    this.#liveForceSection = new FishLiveForceSummarySection(options);
    this.#forcePreviewSection = new FishStateForcePreviewSection(options);
  }

  shouldRender(data) {
    return (
      data.gameState === "playing" &&
      (
        this.#liveForceSection.hasData(data) ||
        this.#forcePreviewSection.hasStates(data)
      )
    );
  }

  render(data) {
    let html = this.formatHeader("FISH BALANCE", "#ffaa00");
    html += this.#liveForceSection.render(data, this);
    if (this.#forcePreviewSection.hasStates(data)) {
      html += this.#forcePreviewSection.render(data, {
        includeHeader: true,
        headerTitle: "STATE FORCE PREVIEW",
      });
    }
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }
}

window.FishBalanceModule = FishBalanceModule;
