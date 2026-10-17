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
  // The inventory's own UI surface container (spec 098): the modal's breakpoints follow this box.
  #surfaceNode;
  #headerHost;
  #headerNode = null;
  #lastEquipmentFeedbackRevision = 0;
  #warningNode;
  #hintRegion;
  #leftHost;
  #rightHost;
  #sectionTabsRenderer;
  #sectionTabsNode;
  #backpackSummaryRenderer;
  #hintRenderer;
  #backpackSummaryNode;
  // The portrait pager's backpack page (spec 075): a second backpack view, moved into each re-rendered item list.
  #backpackPageNode;
  // Section hosts (spec 067): each section keeps its DOM while hidden; InventoryUiState owns the active section.
  #sectionHosts = new Map();
  #equipmentHost;
  #itemsHost;
  #keepnetSection = null;
  #sections;
  #activeSectionId = null;
  // Portrait swipes walk the sections in tab order (spec 087); -1 enters the backpack on its last page.
  #sectionSwipeController;
  #sectionEntryStep = 1;
  #editorRootInstanceId = null;
  #unsubscribe = null;
  #visibilityListeners = new Set();
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
    this.#hintRenderer = presentation.hintRenderer;
    this.#sections = presentation.sections;
    this.#sectionSwipeController = presentation.sectionSwipeController;
    this.#buildShell();
  }

  get isOpen() {
    return this.#isOpen;
  }

  get rootNode() {
    return this.#rootNode;
  }

  get surfaceNode() {
    return this.#surfaceNode;
  }

  // Open/close notifications for the page layout (the landscape split, spec 098); returns the unsubscribe.
  onVisibilityChange(listener) {
    this.#visibilityListeners.add(listener);
    return () => this.#visibilityListeners.delete(listener);
  }

  mount() {
    if (this.#isMounted) return this;
    this.#buttonMountNode.appendChild(this.#backpackButtonNode);
    this.#mountNode.appendChild(this.#surfaceNode);
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
    this.#notifyVisibility();
  }

  #notifyVisibility() {
    for (const listener of [...this.#visibilityListeners]) listener(this.#isOpen);
  }

  // The keepnet section view is composed after the inventory (it opens the inventory at its own section).
  attachKeepnetSection(view) {
    this.#keepnetSection = view;
    this.#sectionHosts.get("keepnet").left.appendChild(view.summaryNode);
    this.#sectionHosts.get("keepnet").right.appendChild(view.contentNode);
    // The keepnet help shares the inventory's hint region (spec 086).
    this.#hintRegion.appendChild(view.helpNode);
    view.setVisible(this.#isOpen && this.#activeSectionId === "keepnet");
  }

  openSection(sectionId) {
    if (!this.#isOpen) this.open();
    this.#selectSection(sectionId);
  }

  // A swipe moves one section in tab order and keeps its direction for the backpack's entry page (spec 087); section
  // pagers (backpack, keepnet) hand their edge swipes here.
  swipeSection(step) {
    const section = this.#sections.items[this.#sectionIndex() + step];
    if (section) this.#selectSection(section.id, step);
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
    this.#notifyVisibility();
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
    this.#showEquipmentFeedback(viewModel.equipmentFeedback);
    const signature = JSON.stringify({
      ...viewModel.inventory, savedLoadout: undefined, mode: undefined,
      items: viewModel.inventory.items.map((item) => ({
        instanceId: item.instanceId, itemId: item.itemId, itemType: item.itemType,
        name: item.name, icon: item.icon, iconUrl: item.iconUrl || item.imageUrl,
        quantity: item.quantity, rarity: item.rarity, attachments: item.attachments,
        ratingTier: item.progression?.ratingTier, rarityVisual: item.rarityVisual,
        assemblyCompletion: item.assemblyCompletion, equipmentCompletion: item.equipmentCompletion,
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

    this.#headerRenderer.updateLoad(this.#headerNode, viewModel.header);
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
    viewModel.panel.assembly.sockets.forEach((slot) => {
      append(slot.item);
      slot.compatibleItems.forEach(append);
    });
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
    this.#hintRenderer.show(this.#warningNode, text);
    this.#clearWarningTimer();
    this.#warningTimer = this.#warningTimers.setTimeout(() => {
      this.#hintRenderer.hide(this.#warningNode);
      this.#warningTimer = null;
    }, 5000);
    this.#onWarning?.(text);
  }

  #clearWarningTimer() {
    if (this.#warningTimer === null) return;
    this.#warningTimers.clearTimeout(this.#warningTimer);
    this.#warningTimer = null;
  }

  dispose() {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#visibilityListeners.clear();
    this.#clearWarningTimer();
    this.#hintRenderer.dispose(this.#warningNode);
    this.#longPressController.dispose();
    this.#headerRenderer.dispose?.();
    this.#headerNode = null;
    this.#tooltipPresenter.dispose();
    this.#backpackButtonNode.remove();
    this.#surfaceNode.remove();
    this.#isMounted = false;
    this.#isOpen = false;
    this.#dynamicRefreshElapsedMs = 0;
  }

  #buildShell() {
    this.#backpackButtonNode = this.#dom.button(
      "inventory-backpack-button game-toolbar-button game-toolbar-button--inventory",
      "",
      { title: "Відкрити інвентар" },
    );
    const backpackIcon = this.#dom.image(this.#sections.backpackImage, "");
    backpackIcon.className = "game-toolbar-button__image";
    backpackIcon.setAttribute("aria-hidden", "true");
    this.#backpackButtonNode.appendChild(backpackIcon);
    this.#backpackButtonNode.setAttribute("aria-label", "Відкрити інвентар");
    this.#backpackButtonNode.addEventListener("click", () => this.toggleSection("backpack"));

    this.#rootNode = this.#dom.element("div", "inventory-modal");
    this.#rootNode.setAttribute("role", "dialog");
    this.#rootNode.setAttribute("aria-modal", "true");
    this.#rootNode.setAttribute("aria-label", "Інвентар");
    this.#rootNode.setAttribute("aria-hidden", "true");

    this.#headerHost = this.#dom.element(
      "div",
      "inventory-modal__header-host",
    );
    // Hints have their own region at the top of the inventory (spec 086): it has no height while empty and pushes the
    // header and the sections down when a hint appears.
    this.#hintRegion = this.#dom.element("div", "inventory-modal__hints");
    this.#warningNode = this.#hintRenderer.create({ className: "inventory-warning", tone: "warning", role: "alert",
      closeLabel: "Закрити попередження", onClose: () => this.#clearWarningTimer() });
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
      onSelect: (sectionId) => this.#selectSection(sectionId) });
    this.#sectionTabsNode.classList.add("inventory-main__tabs");
    // One parent for the section content and the tab bar (spec 077): it owns the column's background and frame.
    const sidebar = this.#dom.element("div", "inventory-main__sidebar");
    sidebar.append(this.#leftHost, this.#sectionTabsNode);
    main.append(sidebar, this.#rightHost);
    // The backpack pager and the filter rows own their own horizontal gestures; the pager hands its edges back here.
    this.#sectionSwipeController.attach(main, { pageCount: this.#sections.items.length,
      getIndex: () => this.#sectionIndex(), onSelect: (index) => this.swipeSection(index - this.#sectionIndex()),
      ignoreSelector: ".inventory-pager__viewport, .inventory-horizontal-scroll" });
    const hostClass = (sectionId) => this.#sections.items.find((section) => section.id === sectionId).hostClass;
    this.#equipmentHost = this.#section("equipment", "left", hostClass("equipment"));
    this.#backpackSummaryNode = this.#backpackSummaryRenderer.create();
    this.#backpackPageNode = this.#backpackSummaryRenderer.create();
    this.#section("backpack", "left", hostClass("backpack")).appendChild(this.#backpackSummaryNode);
    this.#section("keepnet", "left", hostClass("keepnet"));
    this.#itemsHost = this.#section("items", "right", "inventory-main__section--items");
    this.#section("keepnet", "right", hostClass("keepnet"));
    this.#hintRegion.appendChild(this.#warningNode);
    this.#rootNode.append(this.#hintRegion, this.#headerHost, main);
    this.#surfaceNode = this.#dom.element("div", "inventory-surface");
    this.#surfaceNode.appendChild(this.#rootNode);
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
    this.#backpackSummaryRenderer.update(this.#backpackPageNode, sections.backpackItemCount);
    const sectionId = sections.activeId;
    if (sectionId !== this.#activeSectionId) {
      this.#activeSectionId = sectionId;
      if (sectionId === "backpack" && this.#sectionEntryStep < 0) this.#inventoryRenderer.showBackpackPage();
      else if (sectionId === "backpack") this.#inventoryRenderer.showItemsPage();
      this.#sectionEntryStep = 1;
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

  #selectSection(sectionId, entryStep = 1) {
    this.#sectionEntryStep = entryStep;
    this.#dispatch({ type: this.#actionTypes.SECTION_SELECT, sectionId });
  }

  #sectionIndex() {
    return this.#sections.items.findIndex((section) => section.id === this.#activeSectionId);
  }

  #renderHeader(viewModel) {
    if (this.#headerNode) {
      this.#headerRenderer.update(this.#headerNode, viewModel.header, viewModel.settings);
      return;
    }
    const header = this.#headerRenderer.render(
      viewModel.header,
      viewModel.settings,
      {
        onClose: () => this.close(),
        onConsumableActivate: (kind, slotIndex) => this.#dispatch({
          type: this.#actionTypes.CONSUMABLE_SLOT_ACTIVATE, kind, slotIndex, listVisible: this.#isItemListVisible(),
        }),
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
    this.#headerNode = header;
  }

  #showEquipmentFeedback(feedback) {
    if (!feedback || feedback.revision === this.#lastEquipmentFeedbackRevision) return;
    this.#lastEquipmentFeedbackRevision = feedback.revision;
    if (!this.#isOpen || this.#activeSectionId !== "equipment") return;
    const field = this.#nodesByClass(this.#equipmentHost, "inventory-field")
      .find((node) => node.dataset.slotId === feedback.slotId);
    const slot = this.#firstNodeByClass(field, "inventory-slot");
    slot?.classList.add("inventory-slot--equipped-flash");
  }

  #renderLeftPanel(panel) {
    // A socket pick refreshes the same editor. Keep its scroll position while replacing the view's DOM.
    const rootInstanceId = panel.mode === "assembly" ? panel.assembly.rootInstanceId : null;
    const sameEditor = rootInstanceId !== null && rootInstanceId === this.#editorRootInstanceId;
    const scrollTop = sameEditor ? this.#equipmentHost.children[0]?.scrollTop || 0 : 0;
    if (rootInstanceId !== null && !sameEditor) this.#assemblyRenderer.resetView();
    this.#editorRootInstanceId = rootInstanceId;
    if (panel.mode === "saved-loadout") {
      this.#renderSavedLoadout(this.#equipmentHost, panel.savedLoadout);
      return;
    }
    if (panel.mode === "assembly") {
      const editor = this.#assemblyRenderer.render(panel.assembly, {
        onRodRemovalChoice: (choice) => this.#dispatch({ type: this.#actionTypes.ROD_REMOVAL_CHOICE, choice }),
        onRodRemovalSave: (name) => this.#dispatch({ type: this.#actionTypes.LOADOUT_SAVE, name }),
        // Beside a visible item list (landscape, desktop) an empty cell starts the pick that highlights compatible
        // items there; portrait offers the inline choices instead (spec 096).
        inlineChoices: () => !this.#isItemListVisible(),
        onSocketActivate: (socket) => this.#dispatch({
          type: this.#actionTypes.ASSEMBLY_SOCKET_ACTIVATE, rootInstanceId, socketId: socket.socketId,
          slotId: socket.slotId, slotIndex: socket.slotIndex, parentInstanceId: socket.parentInstanceId,
          listVisible: this.#isItemListVisible(),
        }),
        onSocketItemActivate: (socket, item) => this.#dispatch({
          type: this.#actionTypes.ASSEMBLY_SOCKET_ITEM_ACTIVATE, rootInstanceId, instanceId: item.instanceId,
          socketId: socket.socketId, slotId: socket.slotId, slotIndex: socket.slotIndex,
          parentInstanceId: socket.parentInstanceId,
        }),
        // Phone editor tabs (spec 092): a long press removes a filled cell's item. A rod's cells are equipment slots;
        // an assembly's filled socket detaches its component through the socket command.
        onSocketLongPress: (socket) => this.#dispatch(panel.assembly.root?.itemType === "rod"
          ? { type: this.#actionTypes.EQUIPMENT_SLOT_LONG_PRESS, slotId: socket.slotId, instanceId: socket.item.instanceId }
          : { type: this.#actionTypes.ASSEMBLY_SOCKET_ACTIVATE, rootInstanceId, socketId: socket.socketId,
            slotId: socket.slotId, slotIndex: socket.slotIndex, parentInstanceId: socket.parentInstanceId,
            listVisible: this.#isItemListVisible() }),
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
      editor.scrollTop = scrollTop;
      return;
    }

    const loadout = this.#loadoutRenderer.render(panel.loadout, {
      onSlotActivate: (slot) =>
        this.#dispatch({
          type: this.#actionTypes.EQUIPMENT_SLOT_ACTIVATE,
          slotId: slot.slotId,
          instanceId: slot.item?.instanceId || null,
          listVisible: this.#isItemListVisible(),
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
      onPagerEdge: (step) => this.swipeSection(step),
      backpackView: this.#backpackPageNode,
    });
    this.#dom.replaceChildren(this.#itemsHost, grid);
  }

  // The item list is on screen when its host has a layout box; CSS stays the only owner of the breakpoints (spec 074).
  #isItemListVisible() {
    return !this.#itemsHost.hidden && this.#itemsHost.getClientRects().length > 0;
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
