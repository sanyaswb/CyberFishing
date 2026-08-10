class InventoryV2AssemblyEditorRenderer {
  #dom;
  #itemRenderer;
  #parametersRenderer;

  constructor({ domFactory, itemRenderer, parametersRenderer = null } = {}) {
    this.#dom = domFactory || new globalThis.InventoryV2DomFactory();
    this.#itemRenderer =
      itemRenderer ||
      new globalThis.InventoryV2ItemCardRenderer({ domFactory: this.#dom });
    this.#parametersRenderer =
      parametersRenderer ||
      new globalThis.InventoryV2ItemParametersRenderer({ domFactory: this.#dom });
  }

  render(
    model,
    {
      onSocketActivate = null,
      onEquip = null,
      onUnequip = null,
      onDisassemble = null,
      onBack = null,
      onWarning = null,
    } = {},
  ) {
    const editor = this.#dom.element(
      "section",
      "inventory-v2-assembly-editor",
    );
    const workspace = this.#dom.element(
      "div",
      "inventory-v2-assembly-editor__workspace",
    );
    workspace.appendChild(this.#renderRootVisual(model));
    const sockets = this.#dom.element(
      "div",
      "inventory-v2-assembly-editor__sockets",
    );
    model.sockets.forEach((socket) => {
      sockets.appendChild(
        this.#itemRenderer.renderSlot(socket, {
          variant: "socket",
          onActivate: () => onSocketActivate?.(socket),
          onUnavailable: (warning) => onWarning?.(warning),
        }),
      );
    });
    workspace.appendChild(sockets);
    const parameters = this.#parametersRenderer.render(model.root);
    if (parameters) workspace.appendChild(parameters);
    editor.append(workspace, this.#renderActions(model, {
      onEquip,
      onUnequip,
      onDisassemble,
      onBack,
      onWarning,
    }));
    return editor;
  }

  updateDynamicVisuals(host, item) {
    return this.#parametersRenderer.update(host, item);
  }

  #renderRootVisual(model) {
    const visual = this.#dom.element(
      "div",
      "inventory-v2-assembly-editor__visual",
    );
    if (!model.root) return visual;
    visual.appendChild(this.#itemRenderer.renderItem(model.root, {
      variant: "assembly-root",
      frameless: true,
      showAttachments: false,
      showMetadata: false,
      showResourceMeter: false,
    }));
    return visual;
  }

  #renderActions(
    model,
    { onEquip, onUnequip, onDisassemble, onBack, onWarning },
  ) {
    const actions = this.#dom.element(
      "div",
      "inventory-v2-assembly-editor__actions",
    );
    actions.append(
      ...(model.showEquip ? [this.#actionButton(
        "Спорядити",
        "is-primary",
        model.canEquip,
        () => {
          if (!model.canEquip) return onWarning?.(model.equipWarning);
          onEquip?.();
        },
      )] : []),
      ...(model.showUnequip ? [this.#actionButton("Зняти", "", model.equipped && model.canUnequip, () => {
        if (!model.equipped || !model.canUnequip) {
          return onWarning?.(
            model.unequipWarning || "Цей стек не споряджений",
          );
        }
        onUnequip?.();
      })] : []),
      ...(model.showDisassemble ? [this.#actionButton(
        "Розібрати",
        "is-danger",
        model.canDisassemble,
        () => {
          if (!model.canDisassemble) {
            return onWarning?.(model.disassembleWarning);
          }
          onDisassemble?.();
        },
      )] : []),
      this.#actionButton("Назад", "is-muted", true, () => onBack?.()),
    );
    return actions;
  }

  #actionButton(label, modifier, enabled, action) {
    const classes = ["inventory-v2-assembly-editor__button", modifier]
      .filter(Boolean)
      .join(" ");
    const button = this.#dom.button(classes, label);
    button.classList.toggle("is-disabled", !enabled);
    button.setAttribute("aria-disabled", String(!enabled));
    button.addEventListener("click", action);
    return button;
  }
}

globalThis.InventoryV2AssemblyEditorRenderer =
  InventoryV2AssemblyEditorRenderer;
