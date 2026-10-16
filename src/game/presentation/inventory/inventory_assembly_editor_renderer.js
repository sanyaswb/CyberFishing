// Item editor: actions, the root item's preview, its cells and parameters. Wide layouts show the cell grid and every
// parameter section; portrait phones show the tabs block instead (spec 091), CSS decides which.
export class InventoryAssemblyEditorRenderer {
  #dom;
  #itemRenderer;
  #parametersRenderer;
  #parameterSectionResolver;
  #rodRemovalRenderer;
  #tabsRenderer;

  constructor({
    domFactory,
    itemRenderer,
    parametersRenderer = null,
    parameterSectionResolver = null,
    createParameterSectionResolver,
    rodRemovalRenderer,
    tabsRenderer,
  } = {}) {
    this.#dom = domFactory;
    this.#itemRenderer = itemRenderer;
    this.#parametersRenderer = parametersRenderer;
    this.#rodRemovalRenderer = rodRemovalRenderer;
    this.#tabsRenderer = tabsRenderer;
    this.#parameterSectionResolver =
      parameterSectionResolver ||
      createParameterSectionResolver();
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
      onRodRemovalChoice = null,
      onRodRemovalSave = null,
    } = {},
  ) {
    const editor = this.#dom.element(
      "section",
      "inventory-assembly-editor inventory-panel inventory-panel--full-height",
    );
    const workspace = this.#dom.element(
      "div",
      "inventory-assembly-editor__workspace",
    );
    if (model.rodRemovalStep) {
      editor.appendChild(this.#rodRemovalRenderer.render(model, {
        onChoice: onRodRemovalChoice, onSave: onRodRemovalSave,
      }));
      return editor;
    }
    workspace.appendChild(this.#renderRootVisual(model));
    if (model.sockets.length > 0) {
      const sockets = this.#dom.element(
        "div",
        "inventory-assembly-editor__sockets",
      );
      model.sockets.forEach((socket) => {
        sockets.appendChild(
          this.#itemRenderer.renderSlot(socket, {
            variant: "socket",
            onActivate: () => onSocketActivate?.(socket),
            onUnavailable: (warning) => onWarning?.(warning),
            showTooltip: !this.#parametersRenderer.hasParameters(socket.item),
          }),
        );
      });
      workspace.appendChild(sockets);
    }
    const parameterSections = this.#parameterSectionResolver.resolve(model);
    const parameters = this.#parametersRenderer.renderSections(
      parameterSections,
    );
    if (parameters) workspace.appendChild(parameters);
    editor.append(this.#renderActions(model, {
      onEquip,
      onUnequip,
      onDisassemble,
      onBack,
      onWarning,
    }), workspace);
    const tabs = this.#tabsRenderer.render(model, { onSocketActivate, onWarning });
    if (tabs) editor.appendChild(tabs);
    return editor;
  }

  // A newly opened editor shows its root item's parameters first (spec 091).
  resetView() {
    this.#tabsRenderer.resetView();
  }

  updateDynamicVisuals(host, model) {
    const sections = this.#parameterSectionResolver.resolve(model);
    return this.#parametersRenderer.updateSections(host, sections);
  }

  #renderRootVisual(model) {
    const visual = this.#dom.element(
      "div",
      "inventory-assembly-editor__visual",
    );
    if (!model.root) return visual;
    visual.appendChild(this.#itemRenderer.renderItem(model.root, {
      variant: "assembly-root",
      frameless: true,
      showAttachments: false,
      showMetadata: false,
      showResourceMeter: false,
      showTooltip: !this.#parametersRenderer.hasParameters(model.root),
    }));
    return visual;
  }

  #renderActions(
    model,
    { onEquip, onUnequip, onDisassemble, onBack, onWarning },
  ) {
    const actions = this.#dom.element(
      "div",
      "inventory-assembly-editor__actions",
    );
    actions.append(
      ...(model.showEquip ? [this.#actionButton(
        "Спорядити",
        "inventory-action--primary",
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
        "inventory-action--danger",
        model.canDisassemble,
        () => {
          if (!model.canDisassemble) {
            return onWarning?.(model.disassembleWarning);
          }
          onDisassemble?.();
        },
      )] : []),
      this.#actionButton("Назад", "inventory-action--muted", true, () => onBack?.()),
    );
    return actions;
  }

  #actionButton(label, modifier, enabled, action) {
    const classes = ["inventory-assembly-editor__button inventory-action", modifier]
      .filter(Boolean)
      .join(" ");
    const button = this.#dom.button(classes, label);
    button.classList.toggle("inventory-action--disabled", !enabled);
    button.setAttribute("aria-disabled", String(!enabled));
    button.addEventListener("click", action);
    return button;
  }
}
