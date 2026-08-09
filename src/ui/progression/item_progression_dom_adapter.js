class ItemProgressionDomAdapter {
  static #properties = Object.freeze([
    "--item-power-percent",
    "--item-power-color",
    "--item-capacity-percent",
    "--item-capacity-color",
    "--item-quality-color",
    "--item-quality-sections",
  ]);

  #visualResolver;

  constructor({ visualResolver } = {}) {
    if (!visualResolver || typeof visualResolver.resolve !== "function") {
      throw new TypeError(
        "ItemProgressionDomAdapter requires visualResolver",
      );
    }
    this.#visualResolver = visualResolver;
  }

  resolveVisual(progression) {
    if (!progression?.available) return null;
    return this.#visualResolver.resolve(progression);
  }

  apply(element, progression, visual = null, options = {}) {
    this.clear(element);
    if (!element?.style || !progression?.available) return null;
    const resolvedVisual = visual || this.#visualResolver.resolve(progression);
    if (!resolvedVisual.available) return resolvedVisual;
    this.#applyVariables(element, progression, resolvedVisual);
    element.classList?.add("has-item-progression");

    const documentRef = element.ownerDocument || globalThis.document;
    if (!documentRef?.createElement) return resolvedVisual;
    if (progression.level?.available && options.renderLevelBadge !== false) {
      element.appendChild(this.#createLevelBadge(
        documentRef,
        progression.level,
      ));
    }
    if (
      progression.capacity?.available &&
      options.renderCapacityBar !== false
    ) {
      element.appendChild(this.#createSlotCapacityBar(
        documentRef,
        progression.capacity,
      ));
    }
    return resolvedVisual;
  }

  updateCapacity(element, progression, visual = null) {
    if (!element?.style || !progression?.capacity?.available) return null;
    const resolvedVisual = visual || this.#visualResolver.resolve(progression);
    element.style.setProperty(
      "--item-capacity-percent",
      `${Number(progression.capacity.percent) || 0}%`,
    );
    element.style.setProperty(
      "--item-capacity-color",
      resolvedVisual.capacity?.cssColor || "transparent",
    );
    for (const node of element.querySelectorAll?.(
      "[data-capacity-percent]",
    ) || []) {
      node.textContent = `${this.#format(progression.capacity.percent)}%`;
    }
    for (const node of element.querySelectorAll?.(
      "[data-capacity-current]",
    ) || []) {
      node.textContent = ` ${this.#format(progression.capacity.current)}/${this.#format(
        progression.capacity.maximum,
      )} ${progression.capacity.metricSuffix}`;
    }
    for (const node of element.querySelectorAll?.(
      "[data-capacity-used]",
    ) || []) {
      node.textContent = ` ${this.#withSuffix(
        this.#format(progression.capacity.used),
        progression.capacity.metricSuffix,
      )}`;
    }
    return resolvedVisual;
  }

  appendTooltip(container, progression, visual = null) {
    if (!container || !progression?.available) return null;
    const resolvedVisual = visual || this.#visualResolver.resolve(progression);
    this.#applyVariables(container, progression, resolvedVisual);
    const documentRef = container.ownerDocument || globalThis.document;
    if (!documentRef?.createElement) return resolvedVisual;

    const section = documentRef.createElement("div");
    section.className = "inv-tooltip-section inv-tooltip-progression";
    const title = documentRef.createElement("div");
    title.className = "inv-tooltip-section-title";
    title.textContent = "Прогресія предмета";
    section.appendChild(title);

    if (progression.level?.available) {
      this.#appendTooltipRow(
        documentRef,
        section,
        "Рівень предмета",
        `${progression.level.current}/${progression.level.maximum}`,
      );
    }
    if (progression.capacity?.available) {
      section.appendChild(this.#createTooltipCapacityScale(
        documentRef,
        progression.capacity,
      ));
      this.#appendTooltipRow(
        documentRef,
        section,
        progression.capacity.detailLabel || "Залишок ліски",
        `${this.#format(progression.capacity.current)}/${this.#format(
          progression.capacity.maximum,
        )}${progression.capacity.metricSuffix
          ? ` ${progression.capacity.metricSuffix}`
          : ""}`,
        "capacityCurrent",
      );
      this.#appendTooltipRow(
        documentRef,
        section,
        "Використано",
        this.#withSuffix(
          this.#format(progression.capacity.used),
          progression.capacity.metricSuffix,
        ),
        "capacityUsed",
      );
    } else if (progression.power?.available) {
      section.appendChild(this.#createTooltipPowerScale(
        documentRef,
        progression.power,
      ));
      this.#appendTooltipRow(
        documentRef,
        section,
        progression.power.metricLabel || "Основний параметр",
        this.#withSuffix(
          this.#format(progression.power.rawValue),
          progression.power.metricSuffix,
        ),
      );
      this.#appendTooltipRow(
        documentRef,
        section,
        "Діапазон групи",
        `${this.#format(progression.power.minimum)}–${this.#format(
          progression.power.maximum,
        )}${progression.power.metricSuffix
          ? ` ${progression.power.metricSuffix}`
          : ""}`,
      );
    }
    if (progression.quality?.available) {
      section.appendChild(this.#createTooltipQualityScale(
        documentRef,
        progression.quality,
      ));
    }
    container.appendChild(section);
    return resolvedVisual;
  }

  clear(element) {
    if (!element) return;
    element.classList?.remove("has-item-progression");
    for (const selector of [
      ".inv-slot__level-badge",
      ".inv-slot__quality-bar",
      ".inv-slot__power-bar",
      ".inv-slot__capacity-bar",
      ".inv-tooltip-progression",
    ]) {
      for (const node of element.querySelectorAll?.(selector) || []) {
        node.remove();
      }
    }
    if (!element.style) return;
    for (const property of ItemProgressionDomAdapter.#properties) {
      element.style.removeProperty(property);
    }
  }

  #applyVariables(element, progression, visual) {
    if (!element?.style) return;
    const percent = Number(progression.power?.percent) || 0;
    element.style.setProperty("--item-power-percent", `${percent}%`);
    element.style.setProperty(
      "--item-power-color",
      visual.power?.cssColor || "transparent",
    );
    const capacityPercent = Number(progression.capacity?.percent) || 0;
    element.style.setProperty(
      "--item-capacity-percent",
      `${capacityPercent}%`,
    );
    element.style.setProperty(
      "--item-capacity-color",
      visual.capacity?.cssColor || "transparent",
    );
    element.style.setProperty(
      "--item-quality-color",
      visual.quality?.cssColor || "transparent",
    );
    element.style.setProperty(
      "--item-quality-sections",
      String(progression.quality?.totalSections || 0),
    );
  }

  #createLevelBadge(documentRef, level) {
    const badge = documentRef.createElement("div");
    badge.className = "inv-slot__level-badge";
    badge.textContent = String(level.current);
    badge.setAttribute(
      "aria-label",
      `Рівень предмета ${level.current} з ${level.maximum}`,
    );
    return badge;
  }

  #createSlotCapacityBar(documentRef, capacity) {
    const bar = documentRef.createElement("div");
    bar.className = "inv-slot__capacity-bar";
    bar.setAttribute(
      "aria-label",
      `Ємність ${this.#format(capacity.percent)}%`,
    );
    const track = documentRef.createElement("span");
    track.className = "inv-slot__capacity-track";
    const fill = documentRef.createElement("span");
    fill.className = "inv-slot__capacity-fill";
    bar.append(track, fill);
    return bar;
  }

  #createTooltipPowerScale(documentRef, power) {
    const block = this.#createTooltipScaleBlock(
      documentRef,
      "Сила",
      `${this.#format(power.percent)}%`,
    );
    const scale = documentRef.createElement("div");
    scale.className = "inv-tooltip__power-scale";
    scale.setAttribute("role", "img");
    scale.setAttribute("aria-label", `Сила ${this.#format(power.percent)}%`);
    const track = documentRef.createElement("span");
    track.className = "inv-tooltip__power-track";
    const fill = documentRef.createElement("span");
    fill.className = "inv-tooltip__power-fill";
    scale.append(track, fill);
    block.appendChild(scale);
    return block;
  }

  #createTooltipCapacityScale(documentRef, capacity) {
    const block = this.#createTooltipScaleBlock(
      documentRef,
      capacity.metricLabel || "Ємність",
      `${this.#format(capacity.percent)}%`,
      "capacity",
    );
    const scale = documentRef.createElement("div");
    scale.className = "inv-tooltip__capacity-scale";
    scale.setAttribute("role", "img");
    scale.setAttribute(
      "aria-label",
      `Ємність ${this.#format(capacity.percent)}%`,
    );
    const track = documentRef.createElement("span");
    track.className = "inv-tooltip__capacity-track";
    const fill = documentRef.createElement("span");
    fill.className = "inv-tooltip__capacity-fill";
    scale.append(track, fill);
    block.appendChild(scale);
    return block;
  }

  #createTooltipQualityScale(documentRef, quality) {
    const block = this.#createTooltipScaleBlock(
      documentRef,
      "Якість",
      `${this.#format(quality.value)}/${quality.maximum}`,
    );
    const scale = documentRef.createElement("div");
    scale.className = "inv-tooltip__quality-scale";
    scale.setAttribute("role", "img");
    scale.setAttribute(
      "aria-label",
      `Якість ${quality.value} з ${quality.maximum}`,
    );
    const fragment = documentRef.createDocumentFragment();
    for (let index = 0; index < quality.totalSections; index += 1) {
      const segment = documentRef.createElement("span");
      segment.className = index < quality.filledSections
        ? "inv-tooltip__quality-segment is-filled"
        : "inv-tooltip__quality-segment";
      fragment.appendChild(segment);
    }
    scale.appendChild(fragment);
    block.appendChild(scale);
    return block;
  }

  #createTooltipScaleBlock(documentRef, label, value, modifier = null) {
    const block = documentRef.createElement("div");
    block.className = modifier
      ? `inv-tooltip__scale-block inv-tooltip__scale-block--${modifier}`
      : "inv-tooltip__scale-block";
    const header = documentRef.createElement("div");
    header.className = "inv-tooltip__scale-header";
    const labelNode = documentRef.createElement("b");
    labelNode.textContent = label;
    const valueNode = documentRef.createElement("span");
    valueNode.textContent = value;
    if (modifier === "capacity") valueNode.dataset.capacityPercent = "";
    header.append(labelNode, valueNode);
    block.appendChild(header);
    return block;
  }

  #appendTooltipRow(documentRef, section, label, value, valueRole = null) {
    const row = documentRef.createElement("div");
    row.className = "inv-tooltip-stat";
    const labelNode = documentRef.createElement("b");
    labelNode.textContent = `${label}:`;
    const valueNode = documentRef.createElement("span");
    valueNode.textContent = ` ${value}`;
    if (valueRole === "capacityCurrent") {
      valueNode.dataset.capacityCurrent = "";
    } else if (valueRole === "capacityUsed") {
      valueNode.dataset.capacityUsed = "";
    }
    row.append(labelNode, valueNode);
    section.appendChild(row);
  }

  #format(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "N/A";
    if (Number.isInteger(number)) return String(number);
    return number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  #withSuffix(value, suffix) {
    return suffix ? `${value} ${suffix}` : value;
  }
}
