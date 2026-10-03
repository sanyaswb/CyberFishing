export class InventoryV2UI {
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
  #inventoryRenderer;
  #tooltipPresenter;
  #mountNode;
  #backpackButtonNode;
  #rootNode;
  #headerHost;
  #warningNode;
  #leftHost;
  #rightHost;
  #unsubscribe = null;
  #warningTimer = null;
  #warningTimers;
  #isOpen = false;
  #isMounted = false;
  #lastViewModel = null;
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
    documentRef,
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
      throw new TypeError("InventoryV2UI requires a mountNode");
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
    this.#warningTimers = warningTimers;
    const presentation = createPresentation({
      documentRef,
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
    this.#mountNode.append(this.#backpackButtonNode, this.#rootNode);
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
    this.#rootNode.classList.add("is-open");
    this.#rootNode.removeAttribute("aria-hidden");
    this.#dispatch({ type: this.#actionTypes.OPEN });
    this.refresh();
  }

  close() {
    if (!this.#isOpen) return;
    this.#isOpen = false;
    this.#rootNode.classList.remove("is-open");
    this.#rootNode.setAttribute("aria-hidden", "true");
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
    this.#lastViewModel = viewModel;
    this.#updateDynamicVisuals(viewModel);
  }

  render(source) {
    const viewModel = this.#normalizer.normalize(source);
    this.#lastViewModel = viewModel;
    this.#longPressController.clear();
    this.#tooltipPresenter.hide();
    this.#tooltipPresenter.setContext(viewModel.tooltipContext);
    this.#renderHeader(viewModel);
    this.#renderLeftPanel(viewModel.panel);
    this.#renderInventory(viewModel.inventory);

    const visible = this.#isOpen && viewModel.isOpen;
    this.#rootNode.classList.toggle("is-open", visible);
    if (visible) this.#rootNode.removeAttribute("aria-hidden");
    else this.#rootNode.setAttribute("aria-hidden", "true");
  }

  #updateDynamicVisuals(viewModel) {
    const itemIndex = this.#createDynamicItemIndex(viewModel);
    const cards = this.#nodesByClass(
      this.#rootNode,
      "inventory-v2-item-card",
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
    }

    const loadValue = this.#firstNodeByClass(
      this.#headerHost,
      "inventory-v2-load__value",
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
    this.#warningNode.classList.add("is-visible");
    this.#warningNode.setAttribute("role", "alert");
    if (this.#warningTimer !== null) this.#warningTimers.clearTimeout(this.#warningTimer);
    this.#warningTimer = this.#warningTimers.setTimeout(() => {
      this.#warningNode.classList.remove("is-visible");
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
    this.#tooltipPresenter.dispose();
    this.#backpackButtonNode.remove();
    this.#rootNode.remove();
    this.#isMounted = false;
    this.#isOpen = false;
    this.#dynamicRefreshElapsedMs = 0;
  }

  #buildShell() {
    this.#backpackButtonNode = this.#dom.button(
      "inventory-v2-backpack-button",
      "🎒",
      { title: "Відкрити інвентар" },
    );
    this.#backpackButtonNode.setAttribute("aria-label", "Відкрити інвентар");
    this.#backpackButtonNode.addEventListener("click", () => this.toggle());

    this.#rootNode = this.#dom.element("div", "inventory-v2-modal");
    this.#rootNode.setAttribute("role", "dialog");
    this.#rootNode.setAttribute("aria-modal", "true");
    this.#rootNode.setAttribute("aria-label", "Інвентар");
    this.#rootNode.setAttribute("aria-hidden", "true");

    this.#headerHost = this.#dom.element(
      "div",
      "inventory-v2-modal__header-host",
    );
    this.#warningNode = this.#dom.element(
      "div",
      "inventory-v2-warning",
    );
    const main = this.#dom.element("main", "inventory-v2-main");
    this.#leftHost = this.#dom.element(
      "div",
      "inventory-v2-main__left",
    );
    this.#rightHost = this.#dom.element(
      "div",
      "inventory-v2-main__right",
    );
    main.append(this.#leftHost, this.#rightHost);
    this.#rootNode.append(this.#headerHost, this.#warningNode, main);
  }

  #renderHeader(viewModel) {
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
    if (panel.mode === "assembly") {
      const rootInstanceId = panel.assembly.rootInstanceId;
      const editor = this.#assemblyRenderer.render(panel.assembly, {
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
      this.#dom.replaceChildren(this.#leftHost, editor);
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
      onSaveLoadout: (name) =>
        this.#dispatch({
          type: this.#actionTypes.LOADOUT_SAVE,
          name,
        }),
    });
    this.#dom.replaceChildren(this.#leftHost, loadout);
  }

  #renderInventory(inventory) {
    if (inventory.mode === "saved-loadout") {
      const loadoutId = inventory.savedLoadout.loadoutId;
      const preview = this.#savedLoadoutRenderer.render(
        inventory.savedLoadout,
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
          onDisassemble: () =>
            this.#dispatch({
              type: this.#actionTypes.LOADOUT_DISASSEMBLE,
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
      this.#dom.replaceChildren(this.#rightHost, preview);
      return;
    }
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
    this.#dom.replaceChildren(this.#rightHost, grid);
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
