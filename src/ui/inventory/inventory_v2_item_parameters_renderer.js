class InventoryV2ItemParametersRenderer {
  #dom;
  #resolver;
  #resourceMeterRenderer;

  constructor({
    domFactory,
    resolver = null,
    resourceMeterRenderer = null,
  } = {}) {
    this.#dom = domFactory || new globalThis.InventoryV2DomFactory();
    this.#resolver =
      resolver || new globalThis.InventoryV2ItemParametersResolver();
    this.#resourceMeterRenderer =
      resourceMeterRenderer ||
      new globalThis.InventoryV2ResourceMeterRenderer({ domFactory: this.#dom });
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
      "inventory-v2-item-parameters",
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
    return panel.children.length ? panel : null;
  }

  update(host, item) {
    const section = this.#findSection(host, item?.instanceId);
    if (!section) return null;
    const parameters = this.#resolver.resolve(item);
    if (!parameters.length) {
      section.remove();
      return null;
    }
    section.dataset.instanceId = String(item?.instanceId || "");
    const list = this.#findParameterList(section) ||
      this.#dom.element("ul", "inventory-v2-parameters-list");
    list.replaceChildren(
      ...parameters.map((parameter) => this.#renderRow(parameter)),
    );
    if (!list.parentNode) section.appendChild(list);
    return section;
  }

  updateSections(host, sections = []) {
    for (const section of sections || []) {
      if (section?.item) this.update(host, section.item);
    }
  }

  #renderSection(section, parameters, showHeader) {
    const article = this.#dom.element(
      "article",
      "inventory-v2-item-parameter-section",
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
      "inventory-v2-item-parameter-section__header",
    );
    const identity = this.#dom.element(
      "span",
      "inventory-v2-item-parameter-section__identity",
    );
    const icon = section?.item?.icon || section?.item?.emoji;
    if (icon) {
      identity.appendChild(this.#dom.element(
        "span",
        "inventory-v2-item-parameter-section__icon",
        icon,
      ));
    }
    const count = Math.max(1, Math.floor(Number(section?.count) || 1));
    const title = [
      section?.title || section?.item?.name || "Предмет",
      count > 1 ? `×${count}` : "",
    ].filter(Boolean).join(" ");
    identity.appendChild(this.#dom.element(
      "strong",
      "inventory-v2-item-parameter-section__title",
      title,
    ));
    header.appendChild(identity);
    const meta = String(section?.slotLabel || "").trim();
    if (meta) {
      header.appendChild(this.#dom.element(
        "span",
        "inventory-v2-item-parameter-section__meta",
        meta,
      ));
    }
    return header;
  }

  #populate(panel, parameters) {
    if (!parameters || parameters.length === 0) return;

    const list = this.#dom.element("ul", "inventory-v2-parameters-list");

    parameters.forEach((parameter) => {
      list.appendChild(this.#renderRow(parameter));
    });

    panel.appendChild(list);
  }

  #renderRow(parameter) {
    const li = this.#dom.element("li", "inventory-v2-parameter-row");
    
    const header = this.#dom.element("div", "inventory-v2-parameter-header");
    
    const labelSpan = this.#dom.element("span", "inventory-v2-parameter-label");
    labelSpan.textContent = parameter.label;
    
    if (parameter.description) {
      const helpIcon = this.#dom.element("span", "inventory-v2-parameter-help", "?");
      helpIcon.setAttribute("title", parameter.description);
      
      const spacer = this.#dom.element("span", "inventory-v2-parameter-help-spacer", " ");
      labelSpan.append(spacer, helpIcon);
    }
    
    header.appendChild(labelSpan);

    if (parameter.value !== undefined && parameter.value !== null) {
      const valueSpan = this.#dom.element("span", "inventory-v2-parameter-value", String(parameter.value));
      if (parameter.color) {
        valueSpan.style.color = parameter.color;
      }
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
    } else if (parameter.kind === "bar" && parameter.percent !== undefined) {
      const barContainer = this.#dom.element("div", "inventory-v2-parameter-bar");
      const barTrack = this.#dom.element("div", "inventory-v2-parameter-bar-track");
      const barFill = this.#dom.element("div", "inventory-v2-parameter-bar-fill");
      
      barFill.style.width = `${Math.max(0, Math.min(100, Number(parameter.percent)))}%`;
      if (parameter.color) {
        barFill.style.backgroundColor = parameter.color;
      }
      
      barTrack.appendChild(barFill);
      barContainer.appendChild(barTrack);
      li.appendChild(barContainer);
    } else if (parameter.kind === "segments") {
      const segmentsContainer = this.#dom.element("div", "inventory-v2-parameter-segments");
      const total = parameter.totalSections || 10;
      const filled = parameter.filledSections || 0;
      for (let i = 0; i < total; i++) {
        const seg = this.#dom.element("div", "inventory-v2-parameter-segment");
        if (i < filled) {
          seg.classList.add("is-filled");
          if (parameter.color) {
            seg.style.backgroundColor = parameter.color;
            seg.style.boxShadow = `0 0 6px ${parameter.color}`;
          }
        }
        segmentsContainer.appendChild(seg);
      }
      li.appendChild(segmentsContainer);
    }

    return li;
  }

  #findSection(host, instanceId) {
    const sections = [
      ...(host?.classList?.contains("inventory-v2-item-parameter-section")
        ? [host]
        : []),
      ...Array.from(
        host?.querySelectorAll?.(".inventory-v2-item-parameter-section") || [],
      ),
    ];
    return sections.find(
      (section) =>
        String(section.dataset?.instanceId || "") === String(instanceId || ""),
    ) || null;
  }

  #findParameterList(section) {
    return Array.from(
      section?.querySelectorAll?.(".inventory-v2-parameters-list") || [],
    )[0] || null;
  }
}

globalThis.InventoryV2ItemParametersRenderer =
  InventoryV2ItemParametersRenderer;
