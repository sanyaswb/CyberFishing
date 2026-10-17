export class InventoryItemParametersRenderer {
  #dom;
  #resolver;
  #resourceMeterRenderer;

  constructor({
    domFactory,
    resolver = null,
    resourceMeterRenderer = null,
  } = {}) {
    this.#dom = domFactory;
    this.#resolver = resolver;
    this.#resourceMeterRenderer = resourceMeterRenderer;
  }

  hasParameters(item) {
    return this.#resolver.resolve(item).length > 0;
  }

  render(item) {
    return this.renderSections(
      [{ item, title: item?.name || "Предмет", slotLabel: "", count: 1 }],
      { showHeaders: false },
    );
  }

  renderSections(sections = [], { showHeaders = true } = {}) {
    const panel = this.#dom.element(
      "section",
      "inventory-item-parameters",
    );
    const source = [...(sections || [])];
    panel.dataset.instanceId = String(source[0]?.item?.instanceId || "");
    for (const section of source) {
      const parameters = this.#resolver.resolve(section?.item);
      if (!parameters.length) continue;
      panel.appendChild(
        this.#renderSection(section, parameters, showHeaders),
      );
    }
    this.#syncSectionLayout(panel);
    return panel.children.length ? panel : null;
  }

  // Every section of the item is updated: the phone editor shows it on its tab page beside the wide layout's stack
  // (spec 091).
  update(host, item) {
    let updated = null;
    for (const section of this.#findSections(host, item?.instanceId)) updated = this.#updateSection(section, item) || updated;
    return updated;
  }

  #updateSection(section, item) {
    const parameters = this.#resolver.resolve(item);
    if (!parameters.length) {
      const panel = section.parentNode;
      section.remove();
      this.#syncSectionLayout(panel);
      return null;
    }
    const instanceId = String(item?.instanceId || "");
    if (section.dataset.instanceId !== instanceId) section.dataset.instanceId = instanceId;
    const list = this.#findParameterList(section) ||
      this.#dom.element("ul", "inventory-parameters-list");
    // The timer refresh (every 250 ms) keeps the rows: rebuilding them each time made the list flash in DevTools and
    // dropped hover, tooltips and selection. Only a changed set of parameters rebuilds the list.
    const rows = list.children;
    const sameRows = rows.length === parameters.length &&
      parameters.every((parameter, index) => rows[index].dataset?.parameterKey === this.#rowKey(parameter));
    if (sameRows) parameters.forEach((parameter, index) => this.#patchRow(rows[index], parameter));
    else list.replaceChildren(...parameters.map((parameter) => this.#renderRow(parameter)));
    if (!list.parentNode) section.appendChild(list);
    return section;
  }

  // A row keeps its nodes while its kind, label, help text and shape stay the same.
  #rowKey(parameter) {
    const hasValue = parameter.value !== undefined && parameter.value !== null;
    const shape = parameter.kind === "effectiveness" ? (parameter.entries || []).length
      : parameter.kind === "segments" ? parameter.totalSections || 10
        : parameter.kind === "resource" ? parameter.resource?.id || "" : "";
    return [parameter.kind || "", parameter.label || "", parameter.description || "", hasValue ? "v" : "", shape].join("|");
  }

  // Writes only what changed, so an unchanged reading causes no DOM mutation.
  #patchRow(li, parameter) {
    const color = parameter.color || "";
    if (li.style.getPropertyValue("--inventory-parameter-color") !== color) {
      if (color) li.style.setProperty("--inventory-parameter-color", color);
      else li.style.removeProperty("--inventory-parameter-color");
    }
    const value = li.querySelector?.(".inventory-parameter__value");
    if (value) this.#setText(value, String(parameter.value));
    if (parameter.kind === "resource" && parameter.resource) {
      const meter = li.querySelector?.(".inventory-resource-meter");
      if (meter) this.#resourceMeterRenderer.updateReading(meter, parameter.resource);
    } else if (parameter.kind === "effectiveness") {
      const rows = li.querySelectorAll?.(".inventory-bait-effectiveness__row") || [];
      (parameter.entries || []).forEach((entry, index) => this.#patchEffectiveness(rows[index], entry));
    } else if (parameter.kind === "bar" && parameter.percent !== undefined) {
      const fill = li.querySelector?.(".inventory-parameter__bar-fill");
      const width = `${Math.max(0, Math.min(100, Number(parameter.percent)))}%`;
      if (fill && fill.style.width !== width) fill.style.width = width;
    } else if (parameter.kind === "segments") {
      const filled = parameter.filledSections || 0;
      Array.from(li.querySelectorAll?.(".inventory-parameter__segment") || []).forEach((segment, index) => {
        this.#toggle(segment, "inventory-parameter__segment--filled", index < filled);
        this.#toggle(segment, "inventory-parameter__segment--colored", index < filled && Boolean(parameter.color));
      });
    }
  }

  #patchEffectiveness(row, entry) {
    if (!row) return;
    const fish = row.querySelector?.(".inventory-bait-effectiveness__fish");
    if (fish) this.#setText(fish, String(entry.fishName || entry.fishId));
    const value = row.querySelector?.(".inventory-bait-effectiveness__value");
    if (!value) return;
    this.#setText(value, this.#effectivenessText(entry));
    const title = this.#effectivenessTitle(entry);
    if (title === null) {
      if (value.hasAttribute?.("title")) value.removeAttribute("title");
    } else if (value.getAttribute("title") !== title) value.setAttribute("title", title);
  }

  #setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  #toggle(node, className, enabled) {
    if (node.classList.contains(className) !== enabled) node.classList.toggle(className, enabled);
  }

  #syncSectionLayout(panel) {
    if (!panel?.classList?.contains("inventory-item-parameters")) return;
    const count = panel.children.length;
    panel.classList.toggle("inventory-item-parameters--single", count === 1);
    for (let index = 0; index < count; index++) {
      panel.children[index].classList.toggle("inventory-item-parameter-section--centered",
        count > 1 && count % 2 === 1 && index === count - 1);
    }
  }

  updateSections(host, sections = []) {
    for (const section of sections || []) {
      if (section?.item) this.update(host, section.item);
    }
  }

  #renderSection(section, parameters, showHeader) {
    const article = this.#dom.element(
      "article",
      "inventory-item-parameter-section",
    );
    article.dataset.instanceId = String(section?.item?.instanceId || "");
    if (showHeader) {
      article.appendChild(this.#renderSectionHeader(section));
    }
    this.#populate(article, parameters);
    return article;
  }

  #renderSectionHeader(section) {
    const header = this.#dom.element(
      "header",
      "inventory-item-parameter-section__header",
    );
    const identity = this.#dom.element(
      "span",
      "inventory-item-parameter-section__identity",
    );
    const icon = section?.item?.icon || section?.item?.emoji;
    if (icon) {
      identity.appendChild(this.#dom.glyph(icon, "inventory-item-parameter-section__icon"));
    }
    const count = Math.max(1, Math.floor(Number(section?.count) || 1));
    const title = [
      section?.title || section?.item?.name || "Предмет",
      count > 1 ? `×${count}` : "",
    ].filter(Boolean).join(" ");
    identity.appendChild(this.#dom.element(
      "strong",
      "inventory-item-parameter-section__title",
      title,
    ));
    header.appendChild(identity);
    const meta = String(section?.slotLabel || "").trim();
    if (meta) {
      header.appendChild(this.#dom.element(
        "span",
        "inventory-item-parameter-section__meta",
        meta,
      ));
    }
    return header;
  }

  #populate(panel, parameters) {
    if (!parameters || parameters.length === 0) return;

    const list = this.#dom.element("ul", "inventory-parameters-list");

    parameters.forEach((parameter) => {
      list.appendChild(this.#renderRow(parameter));
    });

    panel.appendChild(list);
  }

  #renderRow(parameter) {
    const li = this.#dom.element("li", "inventory-parameter");
    li.dataset.parameterKey = this.#rowKey(parameter);
    if (parameter.color) {
      li.style.setProperty("--inventory-parameter-color", parameter.color);
    }

    const header = this.#dom.element("div", "inventory-parameter__header");

    const labelSpan = this.#dom.element("span", "inventory-parameter__label");
    labelSpan.textContent = parameter.label;

    if (parameter.description) {
      const helpIcon = this.#dom.element("span", "inventory-parameter__help", "?");
      helpIcon.setAttribute("title", parameter.description);

      const spacer = this.#dom.element("span", "inventory-parameter__help-spacer", " ");
      labelSpan.append(spacer, helpIcon);
    }

    header.appendChild(labelSpan);

    if (parameter.value !== undefined && parameter.value !== null) {
      const valueSpan = this.#dom.element("span", "inventory-parameter__value", String(parameter.value));
      header.appendChild(valueSpan);
    }

    li.appendChild(header);

    if (parameter.kind === "resource" && parameter.resource) {
      li.appendChild(
        this.#resourceMeterRenderer.create(parameter.resource, {
          variant: "parameter",
          showIcon: false,
        }),
      );
    } else if (parameter.kind === "effectiveness") {
      li.appendChild(this.#renderEffectiveness(parameter.entries));
    } else if (parameter.kind === "bar" && parameter.percent !== undefined) {
      const barContainer = this.#dom.element("div", "inventory-parameter__bar");
      const barTrack = this.#dom.element("div", "inventory-parameter__bar-track");
      const barFill = this.#dom.element("div", "inventory-parameter__bar-fill");

      barFill.style.width = `${Math.max(0, Math.min(100, Number(parameter.percent)))}%`;

      barTrack.appendChild(barFill);
      barContainer.appendChild(barTrack);
      li.appendChild(barContainer);
    } else if (parameter.kind === "segments") {
      const segmentsContainer = this.#dom.element("div", "inventory-parameter__segments");
      const total = parameter.totalSections || 10;
      const filled = parameter.filledSections || 0;
      for (let i = 0; i < total; i++) {
        const seg = this.#dom.element("div", "inventory-parameter__segment");
        if (i < filled) {
          seg.classList.add("inventory-parameter__segment--filled");
          if (parameter.color) {
            seg.classList.add("inventory-parameter__segment--colored");
          }
        }
        segmentsContainer.appendChild(seg);
      }
      li.appendChild(segmentsContainer);
    }

    return li;
  }

  #renderEffectiveness(entries = []) {
    const list = this.#dom.element(
      "div",
      "inventory-bait-effectiveness",
    );
    for (const entry of entries) {
      const row = this.#dom.element(
        "div",
        "inventory-bait-effectiveness__row",
      );
      row.appendChild(this.#dom.element(
        "span",
        "inventory-bait-effectiveness__fish",
        entry.fishName || entry.fishId,
      ));
      const value = this.#dom.element(
        "span",
        "inventory-bait-effectiveness__value",
        this.#effectivenessText(entry),
      );
      const title = this.#effectivenessTitle(entry);
      if (title !== null) value.setAttribute("title", title);
      row.appendChild(value);
      list.appendChild(row);
    }
    return list;
  }

  #effectivenessTitle(entry) {
    if (!entry.discovered || !Number.isFinite(Number(entry.multiplier))) return null;
    const lines = [
      `Базовий множник клювання ×${this.#formatMultiplier(entry.multiplier)}`,
    ];
    if (Number.isFinite(Number(entry.freshnessPercent))) {
      lines.push(`Свіжість ${Math.round(Number(entry.freshnessPercent))}%`);
    }
    if (Number.isFinite(Number(entry.freshnessMultiplier))) {
      lines.push(`Модифікатор свіжості ×${this.#formatMultiplier(entry.freshnessMultiplier)}`);
    }
    if (Number.isFinite(Number(entry.effectiveMultiplier))) {
      lines.push(`Поточний множник ×${this.#formatMultiplier(entry.effectiveMultiplier)}`);
    }
    return lines.join("\n");
  }

  #effectivenessText(entry) {
    if (!entry?.discovered) return "Невідомо";
    if (!entry.compatible) return "Не підходить";
    const maximum = Math.max(1, Math.floor(Number(entry.maximumStars) || 5));
    const filled = Math.max(
      0,
      Math.min(maximum, Math.floor(Number(entry.stars) || 0)),
    );
    return `${"★".repeat(filled)}${"☆".repeat(maximum - filled)}`;
  }

  #formatMultiplier(value) {
    const multiplier = Number(value);
    if (!Number.isFinite(multiplier)) return "0";
    return multiplier.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  #findSections(host, instanceId) {
    const sections = [
      ...(host?.classList?.contains("inventory-item-parameter-section")
        ? [host]
        : []),
      ...Array.from(
        host?.querySelectorAll?.(".inventory-item-parameter-section") || [],
      ),
    ];
    return sections.filter(
      (section) =>
        String(section.dataset?.instanceId || "") === String(instanceId || ""),
    );
  }

  #findParameterList(section) {
    return Array.from(
      section?.querySelectorAll?.(".inventory-parameters-list") || [],
    )[0] || null;
  }
}
