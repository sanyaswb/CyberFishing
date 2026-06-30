class FishStateForcePreviewSection {
  #viewStateStore;
  #configSource;
  #htmlBuilder;
  #previewCache = null;

  constructor({
    viewStateStore = null,
    configSource = () => CONFIG,
    htmlBuilder = new OverlayHtmlBuilder(),
  } = {}) {
    this.#viewStateStore = viewStateStore;
    this.#configSource = configSource;
    this.#htmlBuilder = htmlBuilder;
  }

  hasStates(data) {
    return Object.keys(this.selectBehaviorStates(data)).length > 0;
  }

  render(data, { includeHeader = true, headerTitle = "STATE FORCE PREVIEW" } = {}) {
    const mode = this.#resolveSelectedMode();
    const visibleDetails = this.#resolveVisibleDetails();
    const directionForceConfig = this.#resolveDirectionForceConfig();
    const preview = this.#resolvePreview({
      data,
      mode,
      directionForceConfig,
    });
    const modeLabel = this.resolveDirectionModeLabel(mode);

    let html = "";
    if (includeHeader) {
      html += `<div style="color: #00ccff; margin-bottom: 6px; font-weight: bold; text-transform: uppercase; font-size: 12px;">${this.#htmlBuilder.escapeHtml(headerTitle)} — ${this.#htmlBuilder.escapeHtml(modeLabel)}</div>`;
    }

    html += this.#renderDirectionTabs({ mode });
    html += this.#renderDetailToggles(visibleDetails);
    html += this.#metricRow(
      "Used direction multiplier",
      `x${preview.directionMultiplier.toFixed(2)}`,
      {
        metricKey: "fishStates.directionMultiplier",
        color: "#ffaa00",
      },
    );
    html += this.#metricRow("Passive force", `${preview.passiveForceKg.toFixed(3)} кг`, {
      metricKey: "fishPassiveKg",
      color: "#ffaa00",
    });

    for (const row of preview.rows) {
      html += this.renderStateRow({ row, visibleDetails });
    }

    return html;
  }

  renderStateRow({
    row,
    visibleDetails = {},
  }) {
    const details = [];

    if (visibleDetails.active) {
      details.push(`active <span style="color: ${row.color}; font-weight: bold;">${row.activeForceKg.toFixed(3)} кг</span>`);
    }
    if (visibleDetails.force) {
      details.push(`force <span style="color: ${row.color}; font-weight: bold;">x${row.forceMultiplier.toFixed(2)}</span>`);
    }
    if (visibleDetails.speed) {
      details.push(`speed <span style="color: ${row.color}; font-weight: bold;">x${row.speedMultiplier.toFixed(2)}</span>`);
    }
    if (visibleDetails.weight) {
      details.push(`weight <span style="color: ${row.color}; font-weight: bold;">${row.weight.toFixed(0)}</span>`);
    }

    const detailHtml = details.length > 0 ? ` · ${details.join(" · ")}` : "";

    return `<div style="margin-bottom: 3px; display: grid; grid-template-columns: 72px 1fr; gap: 8px; align-items: baseline; font-size: 12px;">
              <span style="color: ${row.color}; font-weight: bold;">${this.#htmlBuilder.escapeHtml(String(row.name).toUpperCase())}</span>
              <span style="color: #e6e6e6;">сила <span style="color: ${row.color}; font-weight: bold;">${row.finalForceKg.toFixed(3)} кг</span>${detailHtml}</span>
            </div>`;
  }

  calculateActiveStateForceKg({
    passiveForceKg,
    forceMultiplier,
    directionMultiplier,
  }) {
    return (
      this.#finiteNonNegative(passiveForceKg) *
      this.#finiteNonNegative(forceMultiplier, 1) *
      this.#finiteNonNegative(directionMultiplier, 1)
    );
  }

  selectBehaviorStates(data) {
    return (
      data.fishRuntimeBehaviorStates ||
      data.hookedFish?.physics?.behaviorProfile?.behaviors ||
      data.hookedFish?.physics?.behaviors ||
      {}
    );
  }

  resolveActualDirection(data) {
    return this.#normalizeDirection(
      data.fishDirectionState ||
        data.directionCategory ||
        data.fishDirectionCategory ||
        data.fishDirection ||
        "side",
    );
  }

  resolveDirectionModeLabel(mode) {
    return this.#formatDirection(mode);
  }

  resolveDirectionMultiplier({
    mode,
    directionForceConfig,
  }) {
    if (mode === "away") {
      return directionForceConfig.awayMultiplier;
    }
    if (mode === "side") {
      return directionForceConfig.sideMultiplier;
    }
    if (mode === "toward") {
      return directionForceConfig.towardPlayerMultiplier;
    }
    return directionForceConfig.sideMultiplier;
  }

  #resolvePreview({ data, mode, directionForceConfig }) {
    const cacheKey = this.#buildPreviewCacheKey({ data, mode });
    if (this.#previewCache?.key === cacheKey) {
      return this.#previewCache.preview;
    }

    const directionMultiplier = this.resolveDirectionMultiplier({
      mode,
      directionForceConfig,
    });
    const passiveForceKg = this.#finiteNonNegative(data.fishPassiveKg);
    const rows = Object.entries(this.selectBehaviorStates(data)).map(
      ([name, config]) => {
        const forceMultiplier = this.#finiteNonNegative(
          config?.forceMultiplier,
          1,
        );
        const speedMultiplier = this.#finiteNonNegative(
          config?.speedMultiplier,
          0,
        );
        const weight = this.#finiteNonNegative(config?.weight, 0);
        const activeForceKg = this.calculateActiveStateForceKg({
          passiveForceKg,
          forceMultiplier,
          directionMultiplier,
        });

        return Object.freeze({
          name,
          color: this.#htmlBuilder.getStateColor(name),
          forceMultiplier,
          speedMultiplier,
          weight,
          activeForceKg,
          finalForceKg: passiveForceKg + activeForceKg,
        });
      },
    );
    const preview = Object.freeze({
      directionMultiplier,
      passiveForceKg,
      rows: Object.freeze(rows),
    });

    this.#previewCache = { key: cacheKey, preview };
    return preview;
  }

  #buildPreviewCacheKey({ data, mode }) {
    const fish = data?.hookedFish || {};
    return [
      mode,
      fish.id || fish.name || "fish",
      fish.level ?? "",
      fish.weight ?? data?.fishWeightKg ?? "",
    ].join(":");
  }

  #renderDirectionTabs({ mode }) {
    const tabs = [
      { value: "away", label: "Away" },
      { value: "side", label: "Side" },
      { value: "toward", label: "Toward" },
    ];

    const buttons = tabs
      .map((tab) => this.#renderControlButton({
        control: "fish-state-direction",
        value: tab.value,
        label: tab.label,
        isActive: tab.value === mode,
      }))
      .join("");

    return `<div class="debug-overlay-tab-row" role="group" aria-label="Fish state force direction mode">${buttons}</div>`;
  }

  #renderDetailToggles(visibleDetails) {
    const toggles = [
      { value: "active", label: "Active" },
      { value: "force", label: "Force" },
      { value: "speed", label: "Speed" },
      { value: "weight", label: "Weight" },
    ];
    const buttons = toggles
      .map((toggle) => this.#renderControlButton({
        control: "fish-state-force-detail",
        value: toggle.value,
        label: toggle.label,
        isActive: !!visibleDetails[toggle.value],
      }))
      .join("");

    return `<div class="debug-overlay-tab-row debug-overlay-tab-row--compact" role="group" aria-label="Fish state force visible details">${buttons}</div>`;
  }

  #renderControlButton({ control, value, label, isActive }) {
    const activeClass = isActive ? " debug-overlay-tab--active" : "";
    const pressed = isActive ? "true" : "false";
    return `<button type="button" class="debug-overlay-tab${activeClass}" data-overlay-control="${this.#htmlBuilder.escapeAttr(control)}" data-overlay-value="${this.#htmlBuilder.escapeAttr(value)}" aria-pressed="${pressed}">${this.#htmlBuilder.escapeHtml(label)}</button>`;
  }

  #resolveSelectedMode() {
    const value = this.#viewStateStore?.get?.(
      "fishStatesDirectionMode",
      "away",
    );
    return ["away", "side", "toward"].includes(value)
      ? value
      : "away";
  }

  #resolveVisibleDetails() {
    const value = this.#viewStateStore?.get?.("fishStateForceDetails", {}) || {};
    return {
      active: !!value.active,
      force: !!value.force,
      speed: !!value.speed,
      weight: !!value.weight,
    };
  }

  #resolveDirectionForceConfig() {
    const raw = this.#configSource()?.physics?.fight?.directionForce || {};
    return {
      awayMultiplier: this.#finiteNonNegative(raw.awayMultiplier, 2.5),
      sideMultiplier: this.#finiteNonNegative(raw.sideMultiplier, 1),
      towardPlayerMultiplier: this.#finiteNonNegative(
        raw.towardPlayerMultiplier,
        0,
      ),
    };
  }

  #metricRow(label, value, options = {}) {
    return this.#htmlBuilder.metricRow(label, value, options);
  }

  #normalizeDirection(direction) {
    const value = String(direction || "side").toLowerCase();
    if (["away", "away_from_player", "from_player"].includes(value)) {
      return "away";
    }
    if (["toward", "toward_player", "to_player"].includes(value)) {
      return "toward";
    }
    return "side";
  }

  #formatDirection(direction) {
    const normalized = this.#normalizeDirection(direction);
    if (normalized === "toward") return "TOWARD";
    if (normalized === "away") return "AWAY";
    return "SIDE";
  }

  #finiteNonNegative(value, fallback = 0) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized >= 0
      ? normalized
      : fallback;
  }
}

window.FishStateForcePreviewSection = FishStateForcePreviewSection;
