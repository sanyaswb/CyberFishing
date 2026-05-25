class OverlayDevToolsLinkCatalog {
  constructor() {
    this.linksByLabel = new Map(Object.entries({
      "Вага риби": [
        "HOOKED_FISH.weight",
      ],
      "Базова сила": [
        "HOOKED_FISH.physics.forceProfile.basePower",
        "HOOKED_FISH.physics.forceProfile.levelBasePower",
        "HOOKED_FISH.physics.forceProfile.minPowerRatio",
      ],
      "Швидкість відн. води": [
        "CONFIG.physics.simulation.pixelsPerMeter",
        "CONFIG.physics.environment.water.currentInfluenceMultiplier",
      ],
      "Динамічне навантаження": [
        "CONFIG.physics.environment.water.fishMotionLoad.speedLoadKgPerKgPerMps",
        "CONFIG.physics.fight.fishForce.dynamicLoadFromMotion.enabled",
        "HOOKED_FISH.physics.resistanceProfile.speedForceMultiplier",
        "HOOKED_FISH.physics.resistanceProfile.waterResistanceMultiplier",
      ],
      "Множник напрямку": [
        "CONFIG.physics.fight.fishForce.dynamicLoadFromMotion.directionMultiplier.sameDirection",
        "CONFIG.physics.fight.fishForce.dynamicLoadFromMotion.directionMultiplier.sideDirection",
        "CONFIG.physics.fight.fishForce.dynamicLoadFromMotion.directionMultiplier.oppositeDirection",
      ],
      "Water motion load": [
        "CONFIG.physics.environment.water.fishMotionLoad.speedLoadKgPerKgPerMps",
      ],
      "Підсумкова сила риби": [
        "HOOKED_FISH.physics.forceProfile.basePower",
        "HOOKED_FISH.physics.forceProfile.minPowerRatio",
        "CONFIG.physics.environment.water.fishMotionLoad.speedLoadKgPerKgPerMps",
        "CONFIG.physics.fight.fishForce.dynamicLoadFromMotion.enabled",
      ],
      "Player pressure": [
        "CONFIG.physics.fight.rodPull.controlledPullLimitRatio",
        "CONFIG.physics.fight.fishRetrieve.playerPressureTransfer.referenceWeightKg",
        "CONFIG.physics.fight.fishRetrieve.playerPressureTransfer.minTransferRatio",
        "CONFIG.physics.fight.fishRetrieve.playerPressureTransfer.blockedTransferRatio",
      ],
      "Передача тиску": [
        "CONFIG.physics.fight.fishRetrieve.playerPressureTransfer.referenceWeightKg",
        "CONFIG.physics.fight.fishRetrieve.playerPressureTransfer.minTransferRatio",
        "CONFIG.physics.fight.fishRetrieve.playerPressureTransfer.blockedTransferRatio",
      ],
      "Пасивний опір тіла": [
        "CONFIG.physics.fight.fishRetrieve.passiveBodyResistance.tautBodyResistanceKgPerKg",
        "HOOKED_FISH.physics.retrieveProfile.passiveBodyResistanceMultiplier",
      ],
      "Активний опір від риби": [
        "CONFIG.physics.fight.fishRetrieve.activeFishResistance.activeAwayForceMultiplier",
        "HOOKED_FISH.physics.retrieveProfile.activeAwayMultiplier",
      ],
      "Сумарний опір риби": [
        "CONFIG.physics.fight.fishRetrieve.passiveBodyResistance.tautBodyResistanceKgPerKg",
        "CONFIG.physics.fight.fishRetrieve.activeFishResistance.activeAwayForceMultiplier",
        "HOOKED_FISH.physics.retrieveProfile.passiveBodyResistanceMultiplier",
        "HOOKED_FISH.physics.retrieveProfile.activeAwayMultiplier",
      ],
      "Надлишкова сила": [
        "CONFIG.physics.fight.rodPull.controlledPullLimitRatio",
        "CONFIG.physics.fight.fishRetrieve.passiveBodyResistance.tautBodyResistanceKgPerKg",
        "CONFIG.physics.fight.fishRetrieve.activeFishResistance.activeAwayForceMultiplier",
      ],
      "Контроль руху": [
        "CONFIG.physics.fight.rodPull.controlledPullLimitRatio",
        "CONFIG.physics.fight.fishRetrieve.playerPressureTransfer.blockedTransferRatio",
      ],
      "Drag capacity": [
        "CONFIG.physics.fight.fishRetrieve.waterDragWhilePulling.dragKgPerKgAtReferenceSpeed",
        "HOOKED_FISH.physics.retrieveProfile.waterDragMultiplier",
      ],
      "Drag на поточній швидкості": [
        "CONFIG.physics.fight.fishRetrieve.waterDragWhilePulling.dragKgPerKgAtReferenceSpeed",
        "CONFIG.physics.fight.fishRetrieve.waterDragWhilePulling.referencePullSpeedMetersPerSecond",
        "HOOKED_FISH.physics.retrieveProfile.waterDragMultiplier",
      ],
      "Drag per kg @ ref speed": [
        "CONFIG.physics.fight.fishRetrieve.waterDragWhilePulling.dragKgPerKgAtReferenceSpeed",
      ],
      "Retrieve speed": [
        "CONFIG.physics.fight.fishRetrieve.waterDragWhilePulling.referencePullSpeedMetersPerSecond",
        "CONFIG.physics.fight.fishRetrieve.waterDragWhilePulling.dragKgPerKgAtReferenceSpeed",
        "HOOKED_FISH.physics.retrieveProfile.referencePullSpeedMultiplier",
      ],
      "Desired move": [
        "CONFIG.physics.fight.fishRetrieve.waterDragWhilePulling.referencePullSpeedMetersPerSecond",
        "CONFIG.physics.fight.rodPull.minStrokeMeters",
      ],
      "Applied move": [
        "CONFIG.physics.fight.fishRetrieve.waterDragWhilePulling.referencePullSpeedMetersPerSecond",
        "CONFIG.physics.tackle.line.constraintTolerancePx",
      ],
      "Рух заблоковано": [
        "CONFIG.physics.tackle.line.constraintTolerancePx",
        "CONFIG.physics.fight.landing.catchZone.maxLoadWeightRatio",
      ],
      "Натяг": [
        "CONFIG.physics.tension.kgSmoothPerSecond",
        "CONFIG.physics.tension.powerRatioExponent",
        "CONFIG.physics.tension.sensitivityMultiplier",
      ],
      "Raw tension": [
        "CONFIG.physics.tension.powerRatioExponent",
        "CONFIG.physics.tension.sensitivityMultiplier",
      ],
      "Retrieve line tension": [
        "CONFIG.physics.retrieve.passive.passiveRetrievePowerRatio",
        "CONFIG.physics.retrieve.passive.multiplier",
        "CONFIG.physics.retrieve.passive.waterFriction",
      ],
      "Passive retrieve tension": [
        "CONFIG.physics.retrieve.passive.passiveRetrievePowerRatio",
        "CONFIG.physics.retrieve.passive.multiplier",
      ],
      "Фрикціон": [
        "CONFIG.physics.tackle.reelDrag.minRatio",
        "CONFIG.physics.tackle.reelDrag.maxRatio",
        "CONFIG.physics.tackle.reelDrag.tensionGrowthPower",
      ],
      "Tension mode": [
        "CONFIG.physics.tension.smoothApproach",
        "CONFIG.physics.tension.reelRecoveryMultiplier",
      ],
      "Фізична межа ліски": [
        "CONFIG.physics.tackle.line.fullExtensionTensionMultiplier",
        "CONFIG.physics.tackle.line.constraintTolerancePx",
      ],
      "Запас ліски": [
        "CONFIG.physics.tackle.line.rodLengthReserveMultiplier",
        "CONFIG.physics.tackle.line.noReelMinRodLengthMultiplier",
        "CONFIG.physics.tackle.line.noReelExtraLengthMeters",
      ],
      "Залишок ліски": [
        "CONFIG.physics.tackle.line.rodLengthReserveMultiplier",
        "CONFIG.physics.tackle.line.noReelExtraLengthMeters",
      ],
      "Випущено ліски": [
        "CONFIG.physics.tackle.line.rodLengthReserveMultiplier",
        "CONFIG.physics.tackle.line.noReelExtraLengthMeters",
      ],
      "Дистанція до риби": [
        "CONFIG.physics.simulation.pixelsPerMeter",
      ],
      "Хід вудки": [
        "CONFIG.physics.fight.rodPull.distanceMultiplierByRodLength",
        "CONFIG.physics.fight.rodPull.strokeChargePerSecond",
        "CONFIG.physics.fight.rodPull.minStrokeMeters",
      ],
      "Штраф кута": [
        "CONFIG.physics.fight.playerControl.rodAnglePenalty.enabled",
        "CONFIG.physics.fight.playerControl.rodAnglePenalty.noPenaltyAngleDeg",
        "CONFIG.physics.fight.playerControl.rodAnglePenalty.maxPenaltyAngleDeg",
        "CONFIG.physics.fight.playerControl.rodAnglePenalty.maxPenaltyMultiplier",
      ],
      "Підмотка hold": [
        "CONFIG.physics.tackle.reel.autoRecoverSlack",
        "CONFIG.physics.tackle.reel.holdRecoverAfterFullStrokeMs",
        "CONFIG.physics.tackle.reel.holdRecoverStrokeRatio",
      ],
      "Причина підмотки": [
        "CONFIG.physics.tackle.reel.autoRecoverSlack",
        "CONFIG.physics.tackle.reel.holdRecoverAfterFullStrokeMs",
      ],
      "Таймер підмотки": [
        "CONFIG.physics.tackle.reel.holdRecoverAfterFullStrokeMs",
      ],
      "Швидк. підмотки": [
        "CONFIG.physics.tackle.reel.autoRecoverSlack",
        "CONFIG.physics.tackle.reelDrag.yEscapeSpeedAtFullDrag",
      ],
      "До скручування": [
        "CONFIG.physics.fight.rodPull.distanceMultiplierByRodLength",
        "CONFIG.physics.tackle.reel.holdRecoverStrokeRatio",
      ],
    }));
  }

  getLinks(label) {
    const normalized = this.normalizeLabel(label);
    if (this.linksByLabel.has(normalized)) return this.linksByLabel.get(normalized);

    for (const [key, paths] of this.linksByLabel.entries()) {
      if (normalized.startsWith(key)) return paths;
    }
    return [];
  }

  normalizeLabel(label) {
    return String(label || "")
      .replace(/[：:]+$/u, "")
      .replace(/\s*\([^)]*\)\s*$/u, "")
      .trim();
  }
}

class DevToolsPathNavigator {
  constructor() {
    this.flashClassName = "devtools-path-focus-pulse";
  }

  async focusPath(path) {
    const normalizedPath = this.normalizePath(path);
    if (!normalizedPath) return false;

    await this.ensureDevToolsOpen();
    await this.nextFrame();

    const row = this.findRowForPath(normalizedPath);
    if (!row) {
      console.warn("[Overlay → DevTools] Parameter path not found:", normalizedPath);
      return false;
    }

    row.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    this.flashRow(row);
    return true;
  }

  normalizePath(path) {
    return String(path || "").trim().replace(/^CONFIG\./u, "CONFIG.");
  }

  async ensureDevToolsOpen() {
    const panel = document.querySelector(".devtools-panel");
    if (panel?.classList.contains("open")) return;

    const button = this.findDevToolsButton();
    if (button) button.click();
    await this.delay(80);
  }

  findDevToolsButton() {
    const buttons = [...document.querySelectorAll("button")];
    return buttons.find((button) => button.textContent.trim() === "⚙️") || null;
  }

  findRowForPath(path) {
    const parts = path.split(".").filter(Boolean);
    const root = parts.shift();
    if (!root) return null;

    if (root === "CONFIG") {
      const scope = this.expandConfigPath(parts);
      return this.findRowByLeaf(scope || document, parts[parts.length - 1]);
    }

    if (root === "HOOKED_FISH") {
      const activeScope = this.expandSectionByText(document, "ACTIVE FISH") || document;
      this.expandAllSections(activeScope);
      return this.findRowByLeaf(activeScope, parts[parts.length - 1]);
    }

    return this.findRowByLeaf(document, parts[parts.length - 1]);
  }

  expandConfigPath(parts) {
    let scope = this.expandSectionByText(document, "CONFIG");
    if (!scope) return null;

    const sectionParts = parts.slice(0, -1);
    for (const part of sectionParts) {
      const nextScope = this.expandDirectSection(scope, part);
      if (!nextScope) {
        this.expandAllSections(scope, 1);
        return scope;
      }
      scope = nextScope;
    }
    return scope;
  }

  expandSectionByText(root, text) {
    const normalizedText = this.normalizeSectionText(text);
    const sections = [...root.querySelectorAll(".devtools-section")];
    for (const section of sections) {
      const title = section.querySelector(".devtools-section-title");
      if (!title) continue;
      const label = this.normalizeSectionText(title.textContent);
      if (!label.includes(normalizedText)) continue;
      this.expandSection(section);
      return section.querySelector(".devtools-section-content");
    }
    return null;
  }

  expandDirectSection(scope, label) {
    const normalizedLabel = this.normalizeSectionText(label);
    const sections = [...scope.children].filter((child) =>
      child.classList?.contains("devtools-section"),
    );

    for (const section of sections) {
      const title = section.querySelector(".devtools-section-title");
      if (!title) continue;
      const sectionLabel = this.normalizeSectionText(title.textContent);
      if (sectionLabel !== normalizedLabel && !sectionLabel.endsWith(normalizedLabel)) continue;
      this.expandSection(section);
      return section.querySelector(".devtools-section-content");
    }
    return null;
  }

  expandAllSections(root, maxDepth = 8) {
    if (!root || maxDepth <= 0) return;
    const sections = [...root.querySelectorAll(".devtools-section")];
    for (const section of sections) this.expandSection(section);
  }

  expandSection(section) {
    const title = section.querySelector(".devtools-section-title");
    const content = section.querySelector(".devtools-section-content");
    if (!title || !content || content.style.display !== "none") return;
    title.click();
  }

  findRowByLeaf(scope, leafKey) {
    const normalizedLeaf = this.normalizeLabel(leafKey);
    const rows = [...scope.querySelectorAll(".devtools-row")];
    return rows.find((row) => {
      const label = row.querySelector(".devtools-label");
      if (!label) return false;
      const visible = this.normalizeLabel(label.textContent);
      const title = this.normalizeLabel(label.title);
      return (
        visible === normalizedLeaf ||
        title === normalizedLeaf ||
        title.includes(`${normalizedLeaf} =`) ||
        title.includes(`.${normalizedLeaf}`) ||
        visible.startsWith(normalizedLeaf.slice(0, 12))
      );
    }) || null;
  }

  flashRow(row) {
    row.classList.remove(this.flashClassName);
    void row.offsetWidth;
    row.classList.add(this.flashClassName);
    window.setTimeout(() => row.classList.remove(this.flashClassName), 1800);
  }

  normalizeSectionText(value) {
    return String(value || "")
      .replace(/[▶▼]/gu, "")
      .replace(/\s+/gu, " ")
      .trim();
  }

  normalizeLabel(value) {
    return String(value || "")
      .replace(/[：:]+$/u, "")
      .replace(/\s+/gu, " ")
      .trim();
  }

  delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  nextFrame() {
    return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
  }
}

class OverlayDevToolsLinkBridge {
  constructor({ catalog = new OverlayDevToolsLinkCatalog(), navigator = new DevToolsPathNavigator() } = {}) {
    this.catalog = catalog;
    this.navigator = navigator;
    this.cycleIndexByMetric = new Map();
    this.decorateQueued = false;
  }

  start() {
    this.installStyles();
    this.observeOverlayChanges();
    document.addEventListener("pointerdown", (event) => this.handlePointerDown(event), true);
    document.addEventListener("click", (event) => this.handleClick(event), true);
    this.queueDecorate();
  }

  observeOverlayChanges() {
    const observer = new MutationObserver(() => this.queueDecorate());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  queueDecorate() {
    if (this.decorateQueued) return;
    this.decorateQueued = true;
    window.requestAnimationFrame(() => {
      this.decorateQueued = false;
      this.decorateRows();
    });
  }

  decorateRows() {
    const rows = [...document.querySelectorAll("div[style*='justify-content:space-between']")];
    for (const row of rows) this.decorateRow(row);
  }

  decorateRow(row) {
    if (row.querySelector(".overlay-devtools-link-btn")) return;

    const labelElement = row.querySelector("span:first-child");
    if (!labelElement) return;

    const label = this.extractLabel(labelElement.textContent);
    const paths = this.catalog.getLinks(label);
    if (!paths.length) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "overlay-devtools-link-btn";
    button.textContent = "";
    button.dataset.metric = this.catalog.normalizeLabel(label);
    button.dataset.paths = JSON.stringify(paths);
    button.title = this.buildButtonTitle(label, paths);
    button.setAttribute("aria-label", `Відкрити DevTools для ${label}`);

    labelElement.classList.add("overlay-devtools-linked-label");
    labelElement.prepend(button);
  }

  extractLabel(text) {
    return String(text || "").replace(/[：:]+\s*$/u, "").trim();
  }

  buildButtonTitle(label, paths) {
    const suffix = paths.length > 1
      ? `\nПовторне натискання циклічно покаже наступний із ${paths.length} параметрів.`
      : "";
    return `DevTools: ${label}\n${paths.join("\n")}${suffix}`;
  }

  handlePointerDown(event) {
    const button = event.target.closest?.(".overlay-devtools-link-btn");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
  }

  handleClick(event) {
    const button = event.target.closest?.(".overlay-devtools-link-btn");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    this.focusNextPath(button);
  }

  async focusNextPath(button) {
    const paths = this.parsePaths(button.dataset.paths);
    if (!paths.length) return;

    const metric = button.dataset.metric || button.title || paths.join("|");
    const previousIndex = this.cycleIndexByMetric.has(metric)
      ? this.cycleIndexByMetric.get(metric)
      : -1;
    const nextIndex = (previousIndex + 1) % paths.length;
    this.cycleIndexByMetric.set(metric, nextIndex);

    button.classList.add("overlay-devtools-link-btn-active");
    const focused = await this.navigator.focusPath(paths[nextIndex]);
    window.setTimeout(() => button.classList.remove("overlay-devtools-link-btn-active"), 250);

    if (!focused && paths.length > 1) {
      console.info(
        `[Overlay → DevTools] ${metric}: path ${nextIndex + 1}/${paths.length}`,
        paths[nextIndex],
      );
    }
  }

  parsePaths(serialized) {
    try {
      const paths = JSON.parse(serialized || "[]");
      return Array.isArray(paths) ? paths.filter(Boolean) : [];
    } catch (_error) {
      return [];
    }
  }

  installStyles() {
    if (document.getElementById("overlay-devtools-link-styles")) return;
    const style = document.createElement("style");
    style.id = "overlay-devtools-link-styles";
    style.textContent = `
      .overlay-devtools-linked-label {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .overlay-devtools-link-btn {
        width: 12px;
        height: 12px;
        min-width: 12px;
        padding: 0;
        border-radius: 4px;
        border: 1px solid rgba(115, 194, 251, 0.9);
        background: rgba(115, 194, 251, 0.12);
        box-shadow: 0 0 5px rgba(115, 194, 251, 0.35);
        cursor: pointer;
        pointer-events: auto;
        touch-action: none;
      }
      .overlay-devtools-link-btn:hover,
      .overlay-devtools-link-btn-active {
        background: rgba(255, 255, 255, 0.85);
        border-color: #ffffff;
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.9);
      }
      .devtools-row.devtools-path-focus-pulse .devtools-label {
        animation: devtoolsPathFocusPulse 0.28s ease-in-out 0s 6 alternate;
      }
      .devtools-row.devtools-path-focus-pulse {
        outline: 1px solid rgba(255, 255, 255, 0.9);
        outline-offset: 2px;
        border-radius: 4px;
      }
      @keyframes devtoolsPathFocusPulse {
        from { color: inherit; text-shadow: none; }
        to { color: #ffffff; text-shadow: 0 0 8px #ffffff; }
      }
    `;
    document.head.appendChild(style);
  }
}

(function initOverlayDevToolsLinkBridge() {
  if (typeof document === "undefined") return;
  const start = () => {
    const bridge = new OverlayDevToolsLinkBridge();
    bridge.start();
    window.CYBER_FISHING_OVERLAY_DEVTOOLS_LINKS = bridge;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
