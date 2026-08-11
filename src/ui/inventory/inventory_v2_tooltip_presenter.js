class InventoryV2TooltipPresenter {
  #document;
  #tooltipNode;
  #rarityDomAdapter;
  #balanceParameterResolver;
  #context = {
    rodType: null,
    rodHasReel: null,
    availableCapabilities: [],
    equipment: {},
  };
  #anchor = null;
  #visibleInstanceId = null;

  constructor({
    documentRef = globalThis.document,
    rarityDomAdapter = null,
    balanceParameterResolver = null,
  } = {}) {
    if (!documentRef?.createElement || !documentRef.body?.appendChild) {
      throw new TypeError("InventoryV2TooltipPresenter requires a document");
    }
    this.#document = documentRef;
    this.#rarityDomAdapter = rarityDomAdapter;
    this.#balanceParameterResolver =
      balanceParameterResolver ||
      new globalThis.InventoryV2BalanceParameterResolver();
    this.#tooltipNode = this.#document.createElement("div");
    this.#tooltipNode.className =
      "inv-tooltip inventory-v2-tooltip inventory-v2-balance-tooltip";
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
      equipment:
        context.equipment && typeof context.equipment === "object"
          ? context.equipment
          : {},
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
    element.addEventListener(
      "wheel",
      (event) => this.#scrollTooltipFirst(event, item),
      { passive: false },
    );
  }

  show(anchor, item) {
    if (!anchor || !item) return;
    this.#anchor = anchor;
    this.#visibleInstanceId = String(item.instanceId || "");
    this.#tooltipNode.scrollTop = 0;
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
    this.#anchor = null;
    this.#visibleInstanceId = null;
  }

  dispose() {
    this.hide();
    this.#tooltipNode.remove();
  }

  #renderContent(item) {
    this.#rarityDomAdapter?.clear?.(this.#tooltipNode);
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

    const sections = this.#balanceParameterResolver.resolve(
      item,
      this.#context,
    );
    if (!sections.length) {
      const empty = this.#document.createElement("div");
      empty.className = "inventory-v2-balance-tooltip__empty";
      empty.textContent = "Балансні параметри не задані.";
      this.#tooltipNode.appendChild(empty);
    } else {
      sections.forEach((section) =>
        this.#tooltipNode.appendChild(this.#renderSection(section)),
      );
    }
    if (item.instanceId) {
      this.#tooltipNode.dataset.instanceId = String(item.instanceId);
    }
  }

  #renderSection(section) {
    const node = this.#document.createElement("section");
    node.className = "inv-tooltip-section inventory-v2-balance-tooltip__section";
    const title = this.#document.createElement("div");
    title.className = "inv-tooltip-section-title";
    title.textContent = section.title;
    node.appendChild(title);
    section.rows.forEach((row) =>
      node.appendChild(this.#renderRow(row, section.showTechnicalPaths === true))
    );
    return node;
  }

  #renderRow(row, showTechnicalPath = false) {
    const node = this.#document.createElement("div");
    node.className = "inventory-v2-balance-tooltip__row";

    const header = this.#document.createElement("div");
    header.className = "inventory-v2-balance-tooltip__row-header";
    const identity = this.#document.createElement("span");
    identity.className = "inventory-v2-balance-tooltip__identity";
    const label = this.#document.createElement("b");
    label.textContent = row.label;
    identity.appendChild(label);
    if (showTechnicalPath) {
      const technicalPath = this.#document.createElement("code");
      technicalPath.textContent = row.technicalPath;
      identity.appendChild(technicalPath);
    }

    const values = this.#document.createElement("span");
    values.className = "inventory-v2-balance-tooltip__values";
    const actual = this.#document.createElement("strong");
    actual.className = "inventory-v2-balance-tooltip__actual";
    actual.textContent = row.actual;
    values.appendChild(actual);
    if (row.delta) {
      const delta = this.#document.createElement("span");
      delta.className =
        `inventory-v2-balance-tooltip__delta is-${row.tone || "neutral"}`;
      delta.textContent = row.delta;
      values.appendChild(delta);
    }
    header.append(identity, values);
    node.appendChild(header);

    const baseline = this.#document.createElement("div");
    baseline.className = "inventory-v2-balance-tooltip__baseline";
    baseline.textContent = `${row.baselineLabel || "мінімум"}: ${row.baseline}`;
    node.appendChild(baseline);

    for (const impact of row.impacts || []) {
      const impactNode = this.#document.createElement("div");
      impactNode.className =
        `inventory-v2-balance-tooltip__impact is-${impact.tone || "neutral"}`;
      const impactLabel = this.#document.createElement("span");
      impactLabel.textContent = impact.label;
      const impactValue = this.#document.createElement("strong");
      impactValue.textContent = impact.value;
      impactNode.append(impactLabel, impactValue);
      node.appendChild(impactNode);
    }
    return node;
  }

  #position(anchor) {
    const rect = anchor.getBoundingClientRect?.() || { right: 0, top: 0 };
    const view = this.#document.defaultView || globalThis.window || {};
    const scrollX = Number(view.scrollX || 0);
    const scrollY = Number(view.scrollY || 0);
    const viewportWidth = Number(view.innerWidth || 0);
    const viewportHeight = Number(view.innerHeight || 0);
    const tooltipWidth = Number(this.#tooltipNode.offsetWidth || 0);
    const tooltipHeight = Number(this.#tooltipNode.offsetHeight || 0);
    const margin = 12;
    const preferredLeft = Number(rect.right || 0) + scrollX + 10;
    const fallbackLeft = Number(rect.left || 0) + scrollX - tooltipWidth - 10;
    const maxLeft = scrollX + Math.max(margin, viewportWidth - tooltipWidth - margin);
    const left = viewportWidth && tooltipWidth && preferredLeft > maxLeft
      ? Math.max(scrollX + margin, fallbackLeft)
      : preferredLeft;
    const maxTop = scrollY + Math.max(margin, viewportHeight - tooltipHeight - margin);
    const top = viewportHeight && tooltipHeight
      ? Math.min(Math.max(scrollY + margin, Number(rect.top || 0) + scrollY), maxTop)
      : Number(rect.top || 0) + scrollY;
    this.#tooltipNode.style.left = `${left}px`;
    this.#tooltipNode.style.top = `${top}px`;
  }

  #supportsHover() {
    const view = this.#document.defaultView || globalThis.window;
    return typeof view?.matchMedia !== "function" ||
      view.matchMedia("(hover: hover)").matches;
  }

  #scrollTooltipFirst(event, item) {
    if (
      this.#tooltipNode.style.display !== "block" ||
      String(item?.instanceId || "") !== this.#visibleInstanceId
    ) {
      return;
    }
    const viewportHeight = Number(this.#tooltipNode.clientHeight) || 0;
    const contentHeight = Number(this.#tooltipNode.scrollHeight) || 0;
    const maximum = Math.max(0, contentHeight - viewportHeight);
    if (maximum <= 0) return;

    const deltaMode = Number(event?.deltaMode) || 0;
    const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? viewportHeight : 1;
    const delta = (Number(event?.deltaY) || 0) * unit;
    if (!delta) return;
    const current = Math.max(
      0,
      Math.min(maximum, Number(this.#tooltipNode.scrollTop) || 0),
    );
    const next = Math.max(0, Math.min(maximum, current + delta));
    if (next === current) return;
    this.#tooltipNode.scrollTop = next;
    event.preventDefault?.();
    event.stopPropagation?.();
  }

  #textOrNull(value) {
    return typeof value === "string" && value.trim() ? value : null;
  }
}

globalThis.InventoryV2TooltipPresenter = InventoryV2TooltipPresenter;
