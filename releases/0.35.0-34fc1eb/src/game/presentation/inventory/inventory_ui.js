export class InventoryUI {
  #facade;
  #actionContract;
  #actionTypes;
  #actionDispatcher;
  #onWarning;
  #dom;
  #normalizer;
  #longPressController;
  #itemRenderer;
  #headerRenderer;
  #loadoutRenderer;
  #assemblyRenderer;
  #savedLoadoutRenderer;
  #inventoryRenderSignature = null;
  #inventoryRenderer;
  #tooltipPresenter;
  #mountNode;
  #buttonMountNode;
  #backpackButtonNode;
  #rootNode;
  #headerHost;
  #warningNode;
  #leftHost;
  #rightHost;
  #sectionTabsRenderer;
  #sectionTabsNode;
  #backpackSummaryRenderer;
  #backpackSummaryNode;
  // Section hosts (spec 067): each section keeps its DOM while hidden; InventoryUiState owns the active section.
  #sectionHosts = new Map();
  #equipmentHost;
  #itemsHost;
  #keepnetSection = null;
  #sections;
  #activeSectionId = null;
  #unsubscribe = null;
  #warningTimer = null;
  #warningTimers;
  #isOpen = false;
  #isMounted = false;
  #dynamicRefreshElapsedMs = 0;

  constructor({
    facade,
    facadeContract,
    actionContract,
    actionTypes,
    createPresentation,
    warningTimers,
    onAction = null,
    onWarning = null,
    mountNode,
    buttonMountNode = mountNode,
    documentRef,
    uiSurface = null,
    rarityDomAdapter = null,
    rarityVisualResolver = null,
    progressionDomAdapter = null,
    conditionDomAdapter = null,
    normalizer = null,
    longPressController = null,
    headerRenderer = null,
    loadoutRenderer = null,
    assemblyRenderer = null,
    savedLoadoutRenderer = null,
    inventoryRenderer = null,
    tooltipPresenter = null,
    balanceParameterResolver = null,
    resourceMeterResolver = null,
    resourceMeterRenderer = null,
    degradationColorResolver = null,
  } = {}) {
    facadeContract.assert(facade, {
      actionDispatcher: onAction,
    });
    if (!mountNode?.appendChild) {
      throw new TypeError("InventoryUI requires a mountNode");
    }

    this.#facade = facade;
    this.#actionContract = actionContract;
    this.#actionTypes = actionTypes;
    this.#actionDispatcher =
      typeof onAction === "function"
        ? onAction
        : (action) => this.#facade.dispatch(action);
    this.#onWarning = onWarning;
    this.#mountNode = mountNode;
    this.#buttonMountNode = buttonMountNode;
    this.#warningTimers = warningTimers;
    const presentation = createPresentation({
      documentRef,
      uiSurface,
      rarityDomAdapter,
      rarityVisualResolver,
      progressionDomAdapter,
      conditionDomAdapter,
      normalizer,
      longPressController,
      headerRenderer,
      loadoutRenderer,
      assemblyRenderer,
      savedLoadoutRenderer,
      inventoryRenderer,
      tooltipPresenter,
      balanceParameterResolver,
      resourceMeterResolver,
      resourceMeterRenderer,
      degradationColorResolver,
    });
    this.#dom = presentation.dom;
    this.#normalizer = presentation.resolvedNormalizer;
    this.#longPressController = presentation.resolvedLongPressController;
    this.#tooltipPresenter = presentation.resolvedTooltipPresenter;
    this.#itemRenderer = presentation.resolvedItemRenderer;
    this.#headerRenderer = presentation.resolvedHeaderRenderer;
    this.#loadoutRenderer = presentation.resolvedLoadoutRenderer;
    this.#assemblyRenderer = presentation.resolvedAssemblyRenderer;
    this.#savedLoadoutRenderer = presentation.resolvedSavedLoadoutRenderer;
    this.#inventoryRenderer = presentation.resolvedInventoryRenderer;
    this.#sectionTabsRenderer = presentation.sectionTabsRenderer;
    this.#backpackSummaryRenderer = presentation.backpackSummaryRenderer;
    this.#sections = presentation.sections;
    this.#buildShell();
  }

  get isOpen() {
    return this.#isOpen;
  }

  get rootNode() {
    return this.#rootNode;
  }

  mount() {
    if (this.#isMounted) return this;
    this.#buttonMountNode.appendChild(this.#backpackButtonNode);
    this.#mountNode.appendChild(this.#rootNode);
    this.#isMounted = true;
    if (typeof this.#facade.subscribe === "function") {
      const unsubscribe = this.#facade.subscribe((notification) =>
        this.#handleFacadeNotification(notification),
      );
      if (typeof unsubscribe === "function") this.#unsubscribe = unsubscribe;
    }
    this.refresh();
    return this;
  }

  open() {
    if (!this.#isMounted) this.mount();
    this.#isOpen = true;
    this.#rootNode.classList.add("inventory-modal--open");
    this.#rootNode.removeAttribute("aria-hidden");
    this.#dispatch({ type: this.#actionTypes.OPEN });
    this.refresh();
  }

  // The keepnet section view is composed after the inventory (it opens the inventory at its own section).
  attachKeepnetSection(view) {
    this.#keepnetSection = view;
    this.#sectionHosts.get("keepnet").left.appendChild(view.summaryNode);
    this.#sectionHosts.get("keepnet").right.appendChild(view.contentNode);
    view.setVisible(this.#isOpen && this.#activeSectionId === "keepnet");
  }

  openSection(sectionId) {
    if (!this.#isOpen) this.open();
    this.#dispatch({ type: this.#actionTypes.SECTION_SELECT, sectionId });
  }

  toggleSection(sectionId) {
    if (this.#isOpen && this.#activeSectionId === sectionId) this.close();
    else this.openSection(sectionId);
  }

  close() {
    this.#inventoryRenderSignature = null;
    if (!this.#isOpen) return;
    this.#isOpen = false;
    this.#rootNode.classList.remove("inventory-modal--open");
    this.#rootNode.setAttribute("aria-hidden", "true");
    this.#keepnetSection?.setVisible(false);
    this.#longPressController.clear();
    this.#tooltipPresenter.hide();
    this.#dynamicRefreshElapsedMs = 0;
    this.#dispatch({ type: this.#actionTypes.CLOSE });
  }

  toggle() {
    if (this.#isOpen) this.close();
    else this.open();
  }

  refresh() {
    const source = this.#facade.getViewModel();
    this.render(source);
  }

  updateDynamicProgression(dt = 0) {
    if (!this.#isOpen) {
      this.#dynamicRefreshElapsedMs = 0;
      return;
    }
    this.#dynamicRefreshElapsedMs += Math.max(0, Number(dt) || 0);
    if (this.#dynamicRefreshElapsedMs < 250) return;
    if (this.#longPressController.hasActivePress) {
      this.#dynamicRefreshElapsedMs = 250;
      return;
    }
    this.#dynamicRefreshElapsedMs = 0;
    const viewModel = this.#normalizer.normalize(
      this.#facade.getViewModel(),
    );
    this.#updateDynamicVisuals(viewModel);
  }

  render(source) {
    const viewModel = this.#normalizer.normalize(source);
    this.#longPressController.clear(this.#leftHost);
    this.#tooltipPresenter.hide();
    this.#tooltipPresenter.setContext(viewModel.tooltipContext);
    this.#renderHeader(viewModel);
    this.#renderLeftPanel(viewModel.panel);
    this.#applySection(viewModel.sections);
    const signature = JSON.stringify({
      ...viewModel.inventory, savedLoadout: undefined, mode: undefined,
      items: viewModel.inventory.items.map((item) => ({
        instanceId: item.instanceId, itemId: item.itemId, itemType: item.itemType,
        name: item.name, icon: item.icon, iconUrl: item.iconUrl || item.imageUrl,
        quantity: item.quantity, rarity: item.rarity, attachments: item.attachments,
        ratingTier: item.progression?.ratingTier, rarityVisual: item.rarityVisual,
        assemblyCompletion: item.assemblyCompletion,
        loadoutMembership: item.loadoutMembership,
        compatibleWithHighlightedSlot: item.compatibleWithHighlightedSlot,
      })),
    });
    if (signature !== this.#inventoryRenderSignature) {
      this.#longPressController.clear(this.#rightHost);
      this.#renderInventory(viewModel.inventory);
      this.#inventoryRenderSignature = signature;
    } else this.#updateDynamicVisuals(viewModel);

    const visible = this.#isOpen && viewModel.isOpen;
    this.#rootNode.classList.toggle("inventory-modal--open", visible);
    if (visible) this.#rootNode.removeAttribute("aria-hidden");
    else this.#rootNode.setAttribute("aria-hidden", "true");
  }

  #updateDynamicVisuals(viewModel) {
    const itemIndex = this.#createDynamicItemIndex(viewModel);
    const cards = this.#nodesByClass(
      this.#rootNode,
      "inventory-item-card",
    );
    cards.forEach((card) => {
      const item = itemIndex.get(String(card.dataset.instanceId || ""));
      if (item) this.#itemRenderer.updateDynamicVisuals(card, item);
    });
    if (viewModel.panel.mode === "assembly") {
      this.#assemblyRenderer.updateDynamicVisuals(
        this.#leftHost,
        viewModel.panel.assembly,
      );
    } else if (viewModel.panel.mode === "saved-loadout") {
      this.#savedLoadoutRenderer.updateDynamicVisuals(this.#leftHost, viewModel.panel.savedLoadout);
    }

    const loadValue = this.#firstNodeByClass(
      this.#headerHost,
      "inventory-load__value",
    );
    if (loadValue) {
      const value = Number(viewModel.header.loadValue) || 0;
      const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
      loadValue.textContent = `${formatted} ${viewModel.header.loadUnit}`;
    }
  }

  #createDynamicItemIndex(viewModel) {
    const items = new Map();
    const append = (item) => {
      const instanceId = item?.instanceId;
      if (typeof instanceId === "string" && instanceId) {
        items.set(instanceId, item);
      }
    };
    viewModel.header.activeBaits.forEach(append);
    viewModel.header.activeChums.forEach(append);
    viewModel.panel.loadout.mainSlots.forEach((slot) => append(slot.item));
    viewModel.panel.loadout.auxiliarySlots.forEach((slot) => append(slot.item));
    append(viewModel.panel.assembly.root);
    viewModel.panel.assembly.sockets.forEach((slot) => append(slot.item));
    viewModel.inventory.savedLoadout.slots.forEach((slot) => append(slot.item));
    append(viewModel.panel.savedLoadout.card);
    viewModel.panel.savedLoadout.slots.forEach((slot) => append(slot.item));
    viewModel.inventory.items.forEach(append);
    return items;
  }

  #nodesByClass(root, className) {
    if (typeof root?.querySelectorAll === "function") {
      return Array.from(root.querySelectorAll(`.${className}`));
    }
    const matches = [];
    const pending = root ? [root] : [];
    while (pending.length) {
      const node = pending.pop();
      if (node.classList?.contains(className)) matches.push(node);
      const children = Array.from(node.children || []);
      for (let index = children.length - 1; index >= 0; index -= 1) {
        pending.push(children[index]);
      }
    }
    return matches;
  }

  #firstNodeByClass(root, className) {
    return this.#nodesByClass(root, className)[0] || null;
  }

  showWarning(message) {
    const text = typeof message === "string" ? message.trim() : "";
    if (!text) return;
    this.#warningNode.textContent = text;
    this.#warningNode.classList.add("inventory-warning--visible");
    this.#warningNode.setAttribute("role", "alert");
    if (this.#warningTimer !== null) this.#warningTimers.clearTimeout(this.#warningTimer);
    this.#warningTimer = this.#warningTimers.setTimeout(() => {
      this.#warningNode.classList.remove("inventory-warning--visible");
      this.#warningTimer = null;
    }, 5000);
    this.#onWarning?.(text);
  }

  dispose() {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    if (this.#warningTimer !== null) {
      this.#warningTimers.clearTimeout(this.#warningTimer);
      this.#warningTimer = null;
    }
    this.#longPressController.dispose();
    this.#headerRenderer.dispose?.();
    this.#tooltipPresenter.dispose();
    this.#backpackButtonNode.remove();
    this.#rootNode.remove();
    this.#isMounted = false;
    this.#isOpen = false;
    this.#dynamicRefreshElapsedMs = 0;
  }

  #buildShell() {
    this.#backpackButtonNode = this.#dom.button(
      "inventory-backpack-button game-toolbar-button game-toolbar-button--inventory",
      "🎒",
      { title: "Відкрити інвентар" },
    );
    this.#backpackButtonNode.setAttribute("aria-label", "Відкрити інвентар");
    this.#backpackButtonNode.addEventListener("click", () => this.toggle());

    this.#rootNode = this.#dom.element("div", "inventory-modal");
    this.#rootNode.setAttribute("role", "dialog");
    this.#rootNode.setAttribute("aria-modal", "true");
    this.#rootNode.setAttribute("aria-label", "Інвентар");
    this.#rootNode.setAttribute("aria-hidden", "true");

    this.#headerHost = this.#dom.element(
      "div",
      "inventory-modal__header-host",
    );
    this.#warningNode = this.#dom.element(
      "div",
      "inventory-warning",
    );
    const main = this.#dom.element("main", "inventory-main");
    this.#leftHost = this.#dom.element(
      "div",
      "inventory-main__left",
    );
    this.#rightHost = this.#dom.element(
      "div",
      "inventory-main__right",
    );
    this.#sectionTabsNode = this.#sectionTabsRenderer.create({ activeId: null,
      onSelect: (sectionId) => this.#dispatch({ type: this.#actionTypes.SECTION_SELECT, sectionId }) });
    this.#sectionTabsNode.classList.add("inventory-main__tabs");
    main.append(this.#leftHost, this.#sectionTabsNode, this.#rightHost);
    const hostClass = (sectionId) => this.#sections.items.find((section) => section.id === sectionId).hostClass;
    this.#equipmentHost = this.#section("equipment", "left", hostClass("equipment"));
    this.#backpackSummaryNode = this.#backpackSummaryRenderer.create();
    this.#section("backpack", "left", hostClass("backpack")).appendChild(this.#backpackSummaryNode);
    this.#section("keepnet", "left", hostClass("keepnet"));
    this.#itemsHost = this.#section("items", "right", "inventory-main__section--items");
    this.#section("keepnet", "right", hostClass("keepnet"));
    this.#rootNode.append(this.#headerHost, this.#warningNode, main);
  }

  // One host per section and side; hidden hosts keep their DOM, scroll and the item-list render signature.
  #section(sectionId, side, className) {
    const host = this.#dom.element("div", `inventory-main__section ${className}`);
    host.hidden = true;
    (side === "left" ? this.#leftHost : this.#rightHost).appendChild(host);
    const hosts = this.#sectionHosts.get(sectionId) || {};
    hosts[side] = host;
    this.#sectionHosts.set(sectionId, hosts);
    return host;
  }

  #applySection(sections) {
    this.#backpackSummaryRenderer.update(this.#backpackSummaryNode, sections.backpackItemCount);
    const sectionId = sections.activeId;
    if (sectionId !== this.#activeSectionId) {
      this.#activeSectionId = sectionId;
      const visible = new Set([this.#sectionHosts.get(sectionId).left,
        sectionId === "keepnet" ? this.#sectionHosts.get("keepnet").right : this.#itemsHost]);
      for (const hosts of this.#sectionHosts.values())
        for (const host of [hosts.left, hosts.right]) if (host) host.hidden = !visible.has(host);
      this.#sectionTabsRenderer.update(this.#sectionTabsNode, sectionId);
      for (const section of this.#sections.items)
        this.#rootNode.classList.toggle(section.modifier, section.id === sectionId);
    }
    this.#keepnetSection?.setVisible(this.#isOpen && sectionId === "keepnet");
  }

  #renderHeader(viewModel) {
    this.#headerRenderer.dispose?.();
    const header = this.#headerRenderer.render(
      viewModel.header,
      viewModel.settings,
      {
        onClose: () => this.close(),
        onAutoBaitChange: (enabled) =>
          this.#dispatch({
            type: this.#actionTypes.AUTO_BAIT_CHANGE,
            enabled,
          }),
        onAutoChumChange: (enabled) =>
          this.#dispatch({
            type: this.#actionTypes.AUTO_CHUM_CHANGE,
            enabled,
          }),
      },
    );
    this.#dom.replaceChildren(this.#headerHost, header);
  }

  #renderLeftPanel(panel) {
    if (panel.mode === "saved-loadout") {
      this.#renderSavedLoadout(this.#equipmentHost, panel.savedLoadout);
      return;
    }
    if (panel.mode === "assembly") {
      const rootInstanceId = panel.assembly.rootInstanceId;
      const editor = this.#assemblyRenderer.render(panel.assembly, {
        onRodRemovalChoice: (choice) => this.#dispatch({ type: this.#actionTypes.ROD_REMOVAL_CHOICE, choice }),
        onRodRemovalSave: (name) => this.#dispatch({ type: this.#actionTypes.LOADOUT_SAVE, name }),
        onSocketActivate: (socket) =>
          this.#dispatch({
            type: this.#actionTypes.ASSEMBLY_SOCKET_ACTIVATE,
            rootInstanceId,
            socketId: socket.socketId,
            slotId: socket.slotId,
            slotIndex: socket.slotIndex,
            parentInstanceId: socket.parentInstanceId,
          }),
        onEquip: () =>
          this.#dispatch({
            type: this.#actionTypes.ASSEMBLY_EQUIP,
            rootInstanceId,
          }),
        onUnequip: () =>
          this.#dispatch({
            type: this.#actionTypes.ASSEMBLY_UNEQUIP,
            rootInstanceId,
          }),
        onDisassemble: () =>
          this.#dispatch({
            type: this.#actionTypes.ASSEMBLY_DISASSEMBLE,
            rootInstanceId,
          }),
        onBack: () =>
          this.#dispatch({
            type: this.#actionTypes.ASSEMBLY_BACK,
            rootInstanceId,
          }),
        onWarning: (message) => this.showWarning(message),
      });
      this.#dom.replaceChildren(this.#equipmentHost, editor);
      return;
    }

    const loadout = this.#loadoutRenderer.render(panel.loadout, {
      onSlotActivate: (slot) =>
        this.#dispatch({
          type: this.#actionTypes.EQUIPMENT_SLOT_ACTIVATE,
          slotId: slot.slotId,
          instanceId: slot.item?.instanceId || null,
        }),
      onSlotLongPress: (slot) =>
        this.#dispatch({
          type: this.#actionTypes.EQUIPMENT_SLOT_LONG_PRESS,
          slotId: slot.slotId,
          instanceId: slot.item?.instanceId || null,
        }),
      onWarning: (message) => this.showWarning(message),
    });
    this.#dom.replaceChildren(this.#equipmentHost, loadout);
  }

  #renderSavedLoadout(host, model) {
      const loadoutId = model.loadoutId;
      const preview = this.#savedLoadoutRenderer.render(
        model,
        {
          onSlotEquip: (slot) =>
            this.#dispatch({
              type:
                this.#actionTypes.LOADOUT_PREVIEW_SLOT_EQUIP,
              loadoutId,
              slotId: slot.slotId,
            }),
          onEquipAll: () =>
            this.#dispatch({
              type: this.#actionTypes.LOADOUT_EQUIP_ALL,
              loadoutId,
            }),
          onBack: () =>
            this.#dispatch({
              type: this.#actionTypes.LOADOUT_PREVIEW_BACK,
              loadoutId,
            }),
          onWarning: (message) => this.showWarning(message),
        },
      );
      this.#dom.replaceChildren(host, preview);
  }

  #renderInventory(inventory) {
    const grid = this.#inventoryRenderer.render(inventory, {
      onCategorySelect: (categoryId) =>
        this.#dispatch({
          type: this.#actionTypes.CATEGORY_SELECT,
          categoryId,
        }),
      onSubfilterToggle: (filterId, enabled) =>
        this.#dispatch({
          type: this.#actionTypes.SUBFILTER_TOGGLE,
          filterId,
          enabled,
        }),
      onSortCriterionSelect: (criterionId) =>
        this.#dispatch({
          type: this.#actionTypes.SORT_CRITERION_SELECT,
          criterionId,
        }),
      onSortDirectionSelect: (directionId) =>
        this.#dispatch({
          type: this.#actionTypes.SORT_DIRECTION_SELECT,
          directionId,
        }),
      onRarityFilterToggle: (rarityId, enabled) =>
        this.#dispatch({
          type: this.#actionTypes.RARITY_FILTER_TOGGLE,
          rarityId,
          enabled,
        }),
      onItemActivate: (item) =>
        this.#dispatch({
          type: this.#actionTypes.INVENTORY_ITEM_ACTIVATE,
          instanceId: item.instanceId,
        }),
      onItemLongPress: (item) =>
        this.#dispatch({
          type: this.#actionTypes.INVENTORY_ITEM_LONG_PRESS,
          instanceId: item.instanceId,
        }),
    });
    this.#dom.replaceChildren(this.#itemsHost, grid);
  }

  #dispatch(action) {
    let result;
    try {
      this.#actionContract.assert(action);
      result = this.#actionDispatcher(action);
    } catch (error) {
      this.showWarning(error?.message || "Не вдалося виконати дію");
      return;
    }

    if (result && typeof result.then === "function") {
      result
        .then((value) => this.#handleActionResult(value))
        .catch((error) =>
          this.showWarning(error?.message || "Не вдалося виконати дію"),
        );
      return;
    }
    this.#handleActionResult(result);
  }

  #handleActionResult(result) {
    if (result?.warning || result?.reason) {
      this.showWarning(result.warning || result.reason);
    }
    if (result?.viewModel) {
      this.render(result.viewModel);
      return;
    }
    if (result?.refresh === false || !this.#isMounted) return;
    this.refresh();
  }

  #handleFacadeNotification(notification) {
    if (!notification || typeof notification !== "object") {
      this.refresh();
      return;
    }
    const isEnvelope =
      Object.prototype.hasOwnProperty.call(notification, "viewModel") ||
      Object.prototype.hasOwnProperty.call(notification, "warning");
    if (!isEnvelope) {
      this.render(notification);
      return;
    }
    if (notification.warning) {
      if (!this.#isOpen) this.open();
      this.showWarning(notification.warning);
    }
    if (notification.viewModel && typeof notification.viewModel === "object") {
      this.render(notification.viewModel);
      return;
    }
    if (notification.warning) return;
    this.refresh();
  }
}
