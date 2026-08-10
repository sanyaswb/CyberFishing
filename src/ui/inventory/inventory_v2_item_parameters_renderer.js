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
    const parameters = this.#resolver.resolve(item);
    if (!parameters.length) return null;
    const panel = this.#dom.element(
      "section",
      "inventory-v2-item-parameters",
    );
    panel.dataset.instanceId = String(item?.instanceId || "");
    this.#populate(panel, parameters);
    return panel;
  }

  update(host, item) {
    const panel = this.#findPanel(host, item?.instanceId);
    if (!panel) return null;
    const parameters = this.#resolver.resolve(item);
    if (!parameters.length) {
      panel.remove();
      return null;
    }
    panel.dataset.instanceId = String(item?.instanceId || "");
    panel.replaceChildren();
    this.#populate(panel, parameters);
    return panel;
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

  #findPanel(host, instanceId) {
    const panels = [
      ...(host?.classList?.contains("inventory-v2-item-parameters")
        ? [host]
        : []),
      ...Array.from(
        host?.querySelectorAll?.(".inventory-v2-item-parameters") || [],
      ),
    ];
    return panels.find(
      (panel) => String(panel.dataset?.instanceId || "") === String(instanceId || ""),
    ) || null;
  }
}

globalThis.InventoryV2ItemParametersRenderer =
  InventoryV2ItemParametersRenderer;
