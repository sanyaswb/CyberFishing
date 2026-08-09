class InventoryV2TooltipPresenter {
  static #internalKeys = new Set([
    "id",
    "itemId",
    "name",
    "icon",
    "emoji",
    "iconUrl",
    "imageUrl",
    "src",
    "type",
    "instanceId",
    "quantity",
    "buildId",
    "buildName",
    "loadoutId",
    "displayStats",
    "displayStatsSchema",
    "engineStats",
    "rarityProfile",
    "rarityVisual",
    "rarityColor",
    "rarity",
    "progressionProfile",
    "progression",
    "condition",
    "requiresTag",
    "level",
    "basePower",
    "compensation",
    "maxDistance",
    "durabilityMaxLoadLossPerPercent",
    "hasReel",
    "capabilities",
    "line",
    "location",
    "attachments",
    "assemblyCompletion",
    "equipped",
    "charge",
    "prepared",
    "status",
    "composite",
    "isAssembly",
    "longPressEnabled",
    "compatibleWithHighlightedSlot",
  ]);

  #document;
  #tooltipNode;
  #rarityDomAdapter;
  #progressionDomAdapter;
  #context = {
    rodType: null,
    rodHasReel: null,
    availableCapabilities: [],
  };
  #anchor = null;
  #visibleInstanceId = null;

  constructor({
    documentRef = globalThis.document,
    rarityDomAdapter = null,
    progressionDomAdapter = null,
  } = {}) {
    if (!documentRef?.createElement || !documentRef.body?.appendChild) {
      throw new TypeError("InventoryV2TooltipPresenter requires a document");
    }
    this.#document = documentRef;
    this.#rarityDomAdapter = rarityDomAdapter;
    this.#progressionDomAdapter = progressionDomAdapter;
    this.#tooltipNode = this.#document.createElement("div");
    this.#tooltipNode.className = "inv-tooltip inventory-v2-tooltip";
    this.#tooltipNode.setAttribute("role", "tooltip");
    this.#document.body.appendChild(this.#tooltipNode);
  }

  setContext(context = {}) {
    this.#context = {
      rodType: this.#textOrNull(context.rodType),
      rodHasReel:
        typeof context.rodHasReel === "boolean" ? context.rodHasReel : null,
      availableCapabilities: Array.isArray(context.availableCapabilities)
        ? [...new Set(context.availableCapabilities.filter((value) =>
            typeof value === "string" && value.trim(),
          ))]
        : [],
    };
  }

  bind(element, item) {
    if (!element?.addEventListener || !item) return;
    element.addEventListener("mouseenter", () => {
      if (!this.#supportsHover()) return;
      this.show(element, item);
    });
    element.addEventListener("mouseleave", () => this.hide());
    element.addEventListener("click", () => this.hide());
  }

  show(anchor, item) {
    if (!anchor || !item) return;
    this.#anchor = anchor;
    this.#visibleInstanceId = String(item.instanceId || "");
    this.#renderContent(item);
    this.#tooltipNode.style.display = "block";
    this.#position(anchor);
  }

  update(item) {
    if (
      !item ||
      this.#tooltipNode.style.display !== "block" ||
      String(item.instanceId || "") !== this.#visibleInstanceId
    ) {
      return;
    }
    this.#renderContent(item);
    if (this.#anchor) this.#position(this.#anchor);
  }

  hide() {
    this.#tooltipNode.style.display = "none";
    this.#tooltipNode.replaceChildren();
    delete this.#tooltipNode.dataset.instanceId;
    this.#rarityDomAdapter?.clear?.(this.#tooltipNode);
    this.#progressionDomAdapter?.clear?.(this.#tooltipNode);
    this.#anchor = null;
    this.#visibleInstanceId = null;
  }

  dispose() {
    this.hide();
    this.#tooltipNode.remove();
  }

  #renderContent(item) {
    this.#rarityDomAdapter?.clear?.(this.#tooltipNode);
    this.#progressionDomAdapter?.clear?.(this.#tooltipNode);
    this.#tooltipNode.replaceChildren();
    if (item.rarity) {
      this.#rarityDomAdapter?.apply?.(this.#tooltipNode, item.rarity);
    }

    const title = this.#document.createElement("div");
    title.className = "inv-tooltip-title";
    title.textContent = [item.icon || item.emoji, item.name]
      .filter(Boolean)
      .join(" ");
    this.#tooltipNode.appendChild(title);

    this.#progressionDomAdapter?.appendTooltip?.(
      this.#tooltipNode,
      item.progression,
    );
    this.#appendItemStats(item);
    this.#appendCompatibility(item);
    if (item.instanceId) {
      this.#tooltipNode.dataset.instanceId = String(item.instanceId);
    }
  }

  #appendItemStats(item) {
    const renderedLabels = new Set();
    for (const [label, value] of Object.entries(item.displayStats || {})) {
      if (value === undefined || value === null) continue;
      renderedLabels.add(label);
      this.#appendStat(this.#tooltipNode, label, value);
    }

    const internalKeys = new Set(InventoryV2TooltipPresenter.#internalKeys);
    for (const key of Object.keys(item.engineStats || {})) {
      internalKeys.add(key);
    }
    for (const [key, value] of Object.entries(item)) {
      if (internalKeys.has(key) || renderedLabels.has(key)) continue;
      if (typeof value === "object" || typeof value === "function") continue;
      if (value === undefined || value === null || value === "") continue;
      this.#appendStat(this.#tooltipNode, key, value);
    }
  }

  #appendCompatibility(item) {
    const requiredTag = this.#requiredTag(item);
    if (!requiredTag) return;
    const section = this.#document.createElement("div");
    section.className = "inv-tooltip-section";
    const title = this.#document.createElement("div");
    title.className = "inv-tooltip-section-title";
    title.textContent = "Сумісність";
    section.appendChild(title);
    this.#appendStat(section, "Для вудки", this.#requiredTagLabel(requiredTag));
    this.#appendStat(section, "Поточна", this.#rodLabel());

    const compatible = this.#isCompatible(requiredTag, item);
    const status = this.#document.createElement("div");
    status.className = compatible
      ? "inv-tooltip-compat compatible"
      : "inv-tooltip-compat incompatible";
    status.textContent = compatible ? "Сумісно" : "Не сумісно";
    section.appendChild(status);
    this.#tooltipNode.appendChild(section);
  }

  #appendStat(container, label, value) {
    const row = this.#document.createElement("div");
    row.className = "inv-tooltip-stat";
    const name = this.#document.createElement("b");
    name.textContent = `${label}:`;
    const content = this.#document.createElement("span");
    content.textContent = ` ${String(value)}`;
    row.append(name, content);
    container.appendChild(row);
  }

  #requiredTag(item) {
    if (["fishing_line", "leader_line"].includes(item?.type)) return "line";
    return this.#textOrNull(item?.requiresTag || item?.engineStats?.requiresTag);
  }

  #isCompatible(requiredTag, item) {
    if (!this.#context.rodType) return false;
    if (requiredTag === "line") {
      if (item?.type === "leader_line") return this.#context.rodHasReel === true;
      return this.#context.rodHasReel !== true ||
        this.#context.availableCapabilities.includes("reel");
    }
    return this.#context.availableCapabilities.includes(requiredTag);
  }

  #requiredTagLabel(tag) {
    const labels = {
      bait: "Гачок або фідерна оснастка",
      chum_mix: "Фідер / підгодовування",
      feeder_rig: "Фідер",
      float: "Поплавкова: болонська або махова",
      hook: "Поплавкова / фідерна",
      lure: "Спінінг",
      line: "Ліска потрібної довжини",
      reel: "Вудка з котушкою",
    };
    return labels[tag] || tag || "Не вказано";
  }

  #rodLabel() {
    const labels = {
      feeder: "Фідер",
      spinning: "Спінінг",
      match: "Матчова",
      bolognese: "Болонська",
    };
    if (["float", "pole"].includes(this.#context.rodType)) {
      return this.#context.rodHasReel ? "Болонська" : "Махова";
    }
    return labels[this.#context.rodType] || "Не споряджена";
  }

  #position(anchor) {
    const rect = anchor.getBoundingClientRect?.() || { right: 0, top: 0 };
    const view = this.#document.defaultView || globalThis.window || {};
    this.#tooltipNode.style.left = `${Number(rect.right || 0) +
      Number(view.scrollX || 0) + 10}px`;
    this.#tooltipNode.style.top = `${Number(rect.top || 0) +
      Number(view.scrollY || 0)}px`;
  }

  #supportsHover() {
    const view = this.#document.defaultView || globalThis.window;
    return typeof view?.matchMedia !== "function" ||
      view.matchMedia("(hover: hover)").matches;
  }

  #textOrNull(value) {
    return typeof value === "string" && value.trim() ? value : null;
  }
}

globalThis.InventoryV2TooltipPresenter = InventoryV2TooltipPresenter;
