import { inventorySlotIconPath } from "./inventory_slot_icons.js";

// Item editor in every layout (spec 091 on phones, spec 094 on wide screens): the actions panel, the root item's
// preview and the tabs block (the item, its cells, nested items) joined to the active tab's parameters.
export class InventoryAssemblyEditorRenderer {
  #dom;
  #itemRenderer;
  #parametersRenderer;
  #rodRemovalRenderer;
  #tabsRenderer;
  #scrollbarEnabled;
  #deviceControlsRenderer;

  constructor({
    domFactory,
    itemRenderer,
    parametersRenderer = null,
    rodRemovalRenderer,
    tabsRenderer,
    scrollbarEnabled = false,
    deviceControlsRenderer = null,
  } = {}) {
    this.#dom = domFactory;
    this.#itemRenderer = itemRenderer;
    this.#parametersRenderer = parametersRenderer;
    this.#rodRemovalRenderer = rodRemovalRenderer;
    this.#tabsRenderer = tabsRenderer;
    this.#scrollbarEnabled = scrollbarEnabled;
    // A device's own controls under its preview (spec 142: the radio): { supports(item), render() }.
    this.#deviceControlsRenderer = deviceControlsRenderer;
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
      onPowerBlocked = null,
      onRodRemovalChoice = null,
      onRodRemovalSave = null,
      onSocketLongPress = null,
      onSocketItemActivate = null,
      inlineChoices = () => true,
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
    editor.classList.toggle("inventory-assembly-editor--scrollbar-hidden", !this.#scrollbarEnabled);
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
    if (this.#deviceControlsRenderer?.supports(model.root)) {
      editor.appendChild(this.#deviceControlsRenderer.render({
        onWarning,
        onPowerBlocked,
      }));
    }
    // The preview swipes the tabs too (spec 092).
    const tabs = this.#tabsRenderer.render(model,
      {
        onSocketActivate,
        onSocketLongPress,
        onSocketItemActivate,
        onWarning,
        inlineChoices,
        onTabSelect: (tab) => this.#updateVisual(visual, tab, model.root),
      },
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
    visual.appendChild(this.#renderVisualContent({ kind: "root", item: model.root }, model.root));
    return visual;
  }

  #updateVisual(visual, tab, rootItem) {
    const content = this.#renderVisualContent(tab, rootItem);
    if (this.#dom?.replaceChildren) {
      this.#dom.replaceChildren(visual, content);
    } else if (visual.replaceChildren) {
      visual.replaceChildren(content);
    } else {
      while (visual.firstChild) visual.removeChild(visual.firstChild);
      if (content) visual.appendChild(content);
    }
  }

  #renderVisualContent(tab, rootItem) {
    const item = tab?.item || (tab?.kind === "root" ? rootItem : null);
    if (item) {
      return this.#itemRenderer.renderItem(item, {
        variant: "assembly-root",
        frameless: true,
        wholeArt: true,
        showAttachments: false,
        showMetadata: false,
        showResourceMeter: false,
        showTooltip: !this.#parametersRenderer?.hasParameters(item),
      });
    }
    const empty = this.#dom.element("div", "inventory-assembly-editor__empty");
    const slotId = tab?.socket?.slotId || "";
    const iconPath = inventorySlotIconPath(slotId);
    if (iconPath) {
      const icon = this.#dom.image(iconPath, tab?.label || slotId);
      if (icon) {
        icon.className = "inventory-assembly-editor__empty-icon";
        icon.setAttribute("aria-hidden", "true");
        empty.appendChild(icon);
      }
    }
    return empty;
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
