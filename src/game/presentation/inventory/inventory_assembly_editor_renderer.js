// Item editor in every layout (spec 091 on phones, spec 094 on wide screens): the actions panel, the root item's
// preview and the tabs block (the item, its cells, nested items) joined to the active tab's parameters.
export class InventoryAssemblyEditorRenderer {
  #dom;
  #itemRenderer;
  #parametersRenderer;
  #rodRemovalRenderer;
  #tabsRenderer;

  constructor({
    domFactory,
    itemRenderer,
    parametersRenderer = null,
    rodRemovalRenderer,
    tabsRenderer,
  } = {}) {
    this.#dom = domFactory;
    this.#itemRenderer = itemRenderer;
    this.#parametersRenderer = parametersRenderer;
    this.#rodRemovalRenderer = rodRemovalRenderer;
    this.#tabsRenderer = tabsRenderer;
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
      onSocketLongPress = null,
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
    const visual = this.#renderRootVisual(model);
    workspace.appendChild(visual);
    editor.append(this.#renderActions(model, {
      onEquip,
      onUnequip,
      onDisassemble,
      onBack,
      onWarning,
    }), workspace);
    // The preview swipes the tabs too (spec 092).
    const tabs = this.#tabsRenderer.render(model, { onSocketActivate, onSocketLongPress, onWarning },
      { swipeSurfaces: [visual] });
    if (tabs) editor.appendChild(tabs);
    return editor;
  }

  // A newly opened editor shows its root item's parameters first (spec 091).
  resetView() {
    this.#tabsRenderer.resetView();
  }

  // Timer updates refresh every tab page's parameters in place (each cell's item, equal items included).
  updateDynamicVisuals(host, model) {
    for (const item of this.#tabsRenderer.items(model)) this.#parametersRenderer.update(host, item);
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
