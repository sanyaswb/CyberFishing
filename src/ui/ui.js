class InventoryUI {
  #inventoryManager;
  #slotConfig;
  #inventoryCategories;
  #subfilterMapping;
  #equipTargetPolicy;
  #rarityDomAdapter;
  #progressionDomAdapter;
  #conditionDomAdapter;
  #isOpen = false;
  #warningTimeout;

  #activeCategory = "all";
  #activeSubFilters = new Set();
  #isFunnelOpen = false;
  #viewingBuildId = null; // Для перегляду вмісту конкретного ящика

  #containerNode;
  #powerValueNode;
  #warningBoxNode;
  #leftPanelNode;
  #saveBuildContainerNode;
  #categoryContainerNode;
  #subFilterContainerNode;
  #inventoryGridNode;
  #tooltipNode;
  #selectedInstanceId = null;
  #dynamicCapacityElapsedMs = 0;
  #dynamicCapacitySignature = null;
  #backpackButtonNode = null;
  #onInventoryChanged = () => {
    if (this.#isOpen) this.refreshUI();
  };
  #onProgressionUpdated = () => {
    if (this.#isOpen) this.refreshUI();
  };

  #saveInputNode;
  #saveBtnNode;

  #highlightedSlotId = null;

  constructor(
    inventoryManager,
    {
      rarityDomAdapter = null,
      progressionDomAdapter = null,
      conditionDomAdapter = null,
      slotConfig = {},
      inventoryCategories = [],
      subfilterMapping = {},
    } = {},
  ) {
    this.#inventoryManager = inventoryManager;
    this.#rarityDomAdapter = rarityDomAdapter;
    this.#progressionDomAdapter = progressionDomAdapter;
    this.#conditionDomAdapter = conditionDomAdapter;
    this.#slotConfig = slotConfig;
    this.#inventoryCategories = inventoryCategories;
    this.#subfilterMapping = subfilterMapping;
    this.#equipTargetPolicy = new InventoryEquipTargetSelectionPolicy(
      this.#slotConfig,
    );
    this.#initBackpackButton();
    this.#initModal();
    this.#setupEventListeners();
  }

  #enableHorizontalDrag(element) {
    new HorizontalScrollController().attach(element);
  }

  #initBackpackButton() {
    const btn = document.createElement("button");
    btn.innerHTML = "🎒";
    btn.className = "inv-backpack-btn";
    if (typeof UIUtils !== "undefined") {
      UIUtils.makeSolid(btn);
    }
    btn.addEventListener("click", () => this.toggle());
    document.body.appendChild(btn);
    this.#backpackButtonNode = btn;
  }

  #initModal() {
    this.#containerNode = document.createElement("div");
    this.#containerNode.className = "inv-modal";

    const topBar = document.createElement("div");
    topBar.className = "inv-top-bar";

    const powerLabelWrapper = document.createElement("div");
    powerLabelWrapper.innerHTML = `🧱 Макс. навантаження снасті: <span style="color: #00ff80;">0.0</span> кг`;
    this.#powerValueNode = powerLabelWrapper.querySelector("span");

    const closeBtn = document.createElement("button");
    closeBtn.innerText = "❌ Закрити";
    closeBtn.className = "inv-close-btn";
    closeBtn.onclick = () => this.toggle();

    topBar.append(powerLabelWrapper, closeBtn);

    this.#warningBoxNode = document.createElement("div");
    this.#warningBoxNode.style.cssText =
      "color: #ff4444; background: rgba(255, 0, 0, 0.1); border: 1px solid #ff4444; border-radius: 5px; padding: 10px; margin-bottom: 15px; text-align: center; font-weight: bold; display: none;";

    const mainArea = document.createElement("div");
    mainArea.className = "inv-main-area";

    // Обгортка для лівої панелі + кнопки збереження
    const leftWrapper = document.createElement("div");
    leftWrapper.style.cssText =
      "display: flex; flex-direction: column; flex: 1; gap: 10px;";

    this.#saveBuildContainerNode = document.createElement("div");
    this.#saveBuildContainerNode.style.cssText =
      "display: flex; gap: 5px; margin-bottom: 10px;";

    this.#saveInputNode = document.createElement("input");
    this.#saveInputNode.type = "text";
    this.#saveInputNode.maxLength = 10;
    this.#saveInputNode.placeholder = "Назва збірки...";
    this.#saveInputNode.style.cssText =
      "flex: 1; background: #0b1520; color: #00ff80; border: 1px solid #4a5b6c; border-radius: 4px; padding: 5px; font-family: monospace;";

    this.#saveBtnNode = document.createElement("button");
    this.#saveBtnNode.innerText = "💾 Зберегти";
    this.#saveBtnNode.style.cssText =
      "background: #00ff80; color: #000; border: none; border-radius: 4px; padding: 5px 10px; cursor: pointer; font-weight: bold;";

    this.#saveBuildContainerNode.append(this.#saveInputNode, this.#saveBtnNode);

    this.#leftPanelNode = document.createElement("div");
    this.#leftPanelNode.className = "inv-left-panel";
    this.#leftPanelNode.style.cssText =
      "display: flex; flex-direction: column; gap: 15px; flex: 1; overflow-y: auto;";

    leftWrapper.append(this.#saveBuildContainerNode, this.#leftPanelNode);

    const rightWrapperNode = document.createElement("div");
    rightWrapperNode.className = "inv-right-panel";

    this.#categoryContainerNode = document.createElement("div");
    this.#categoryContainerNode.className = "inv-categories";
    this.#enableHorizontalDrag(this.#categoryContainerNode);

    this.#subFilterContainerNode = document.createElement("div");
    this.#subFilterContainerNode.className = "inv-subfilters";
    this.#enableHorizontalDrag(this.#subFilterContainerNode);

    this.#inventoryGridNode = document.createElement("div");
    this.#inventoryGridNode.className = "inv-grid";

    rightWrapperNode.append(
      this.#categoryContainerNode,
      this.#subFilterContainerNode,
      this.#inventoryGridNode,
    );
    mainArea.append(leftWrapper, rightWrapperNode);
    this.#containerNode.append(topBar, this.#warningBoxNode, mainArea);
    document.body.appendChild(this.#containerNode);

    this.#tooltipNode = document.createElement("div");
    this.#tooltipNode.className = "inv-tooltip";
    document.body.appendChild(this.#tooltipNode);
  }

  #setupEventListeners() {
    document.addEventListener(
      "inventory-changed",
      this.#onInventoryChanged,
    );
    document.addEventListener(
      "item-progression-updated",
      this.#onProgressionUpdated,
    );
  }

  toggle() {
    this.#isOpen = !this.#isOpen;
    this.#containerNode.classList.toggle("active", this.#isOpen);
    if (this.#isOpen) {
      this.#viewingBuildId = null;
      this.#highlightedSlotId = null; // <-- ДОДАНО
      this.refreshUI();
    }
  }

  open() {
    if (!this.#isOpen) this.toggle();
  }

  showWarning(message) {
    this.#warningBoxNode.innerText = message;
    this.#warningBoxNode.style.display = "block";
    if (this.#warningTimeout) clearTimeout(this.#warningTimeout);
    this.#warningTimeout = setTimeout(() => {
      this.#warningBoxNode.style.display = "none";
    }, 5000);
  }

  #hideTooltip() {
    if (!this.#tooltipNode) return;
    this.#tooltipNode.style.display = "none";
    this.#tooltipNode.innerHTML = "";
    delete this.#tooltipNode.dataset.instanceId;
    this.#rarityDomAdapter?.clear(this.#tooltipNode);
    this.#progressionDomAdapter?.clear(this.#tooltipNode);
  }

  updateDynamicProgression(dt = 0) {
    if (!this.#isOpen || !this.#progressionDomAdapter) {
      this.#dynamicCapacityElapsedMs = 0;
      return;
    }
    this.#dynamicCapacityElapsedMs += Math.max(0, Number(dt) || 0);
    if (this.#dynamicCapacityElapsedMs < 100) return;
    this.#dynamicCapacityElapsedMs = 0;

    const equippedLine = this.#inventoryManager.getEquipped()?.line;
    if (!equippedLine?.instanceId) return;
    const currentLine = this.#inventoryManager.hydrateInstance(
      equippedLine.instanceId,
    );
    const capacity = currentLine?.progression?.capacity;
    if (!capacity?.available) return;
    const signature = [
      equippedLine.instanceId,
      capacity.current,
      capacity.maximum,
      capacity.source,
    ].join(":");
    if (signature === this.#dynamicCapacitySignature) return;
    this.#dynamicCapacitySignature = signature;

    for (const slot of this.#containerNode.querySelectorAll(
      ".inv-slot[data-instance-id]",
    )) {
      if (slot.dataset.instanceId !== equippedLine.instanceId) continue;
      this.#progressionDomAdapter.updateCapacity(
        slot,
        currentLine.progression,
      );
    }
    if (this.#tooltipNode.dataset.instanceId === equippedLine.instanceId) {
      this.#progressionDomAdapter.updateCapacity(
        this.#tooltipNode,
        currentLine.progression,
      );
    }
  }

  refreshUI() {
    this.#hideTooltip();
    this.#dynamicCapacitySignature = null;
    this.#powerValueNode.innerText = this.#inventoryManager
      .getTotalPower()
      .toFixed(1);
    this.#renderEquipment();

    // --- ДОДАНО: Перевірка на конфлікт збірок для кнопки Зберегти ---
    const equippedItems = this.#inventoryManager.getEquipped();
    let conflictItem = null;

    const checkConflict = (item) => {
      if (item && item.buildId && !conflictItem) conflictItem = item;
    };

    checkConflict(equippedItems.rod);
    checkConflict(equippedItems.reel);
    checkConflict(equippedItems.line);
    checkConflict(equippedItems.float);
    checkConflict(equippedItems.feederRig);
    checkConflict(equippedItems.net);
    checkConflict(equippedItems.delivery);
    if (equippedItems.hooks) equippedItems.hooks.forEach(checkConflict);

    if (conflictItem) {
      // Якщо є конфлікт - кнопка стає неактивною
      const box = this.#inventoryManager._hydrateInstance(conflictItem.buildId);
      const boxName = box ? box.name : "Невідомий ящик";

      this.#saveBtnNode.style.opacity = "0.5";
      this.#saveBtnNode.style.background = "#8a9bac";
      this.#saveBtnNode.style.cursor = "not-allowed";
      this.#saveInputNode.disabled = true;
      this.#saveInputNode.placeholder = "Заблоковано";

      this.#saveBtnNode.onclick = () => {
        this.showWarning(
          `Річ "${conflictItem.name}" вже знаходиться в ящику "${boxName}"!`,
        );
      };
    } else {
      // Якщо все чисто - кнопка активна
      this.#saveBtnNode.style.opacity = "1";
      this.#saveBtnNode.style.background = "#00ff80";
      this.#saveBtnNode.style.cursor = "pointer";
      this.#saveInputNode.disabled = false;
      this.#saveInputNode.placeholder = "Назва збірки...";

      this.#saveBtnNode.onclick = () => {
        if (this.#inventoryManager.isLocked) {
          this.showWarning("Витягніть снасть з води, щоб зберегти збірку!");
          return;
        }
        const name = this.#saveInputNode.value.trim() || "Збірка";
        const res = this.#inventoryManager.saveBuild(name);
        if (res.success) {
          this.#saveInputNode.value = "";
          this.refreshUI();
        } else {
          this.showWarning(res.reason);
        }
      };
    }

    if (this.#viewingBuildId) {
      this.#renderBuildControls();
    } else {
      this.#renderCategories();
    }

    this.#renderInventory();
  }

  #getAvailableSlots(equipped) {
    const groups = [];

    const rodGroup = { groupName: "Вудлище", slots: [] };
    rodGroup.slots.push({ id: "rod", label: "Вудлище", type: "rod" });

    const rod = equipped.rod;
    if (rod) {
      const hasReelProp = rod.effectiveStats?.hasReel;
      const canHaveReel = hasReelProp ?? rod.variant !== "pole";
      if (canHaveReel)
        rodGroup.slots.push({ id: "reel", label: "Котушка", type: "reel" });
      const canHaveLine = !canHaveReel || !!equipped.reel;
      if (canHaveLine)
        rodGroup.slots.push({ id: "line", label: "Ліска", type: "line" });
    }
    groups.push(rodGroup);

    if (rod) {
      const rigGroup = { groupName: "Оснастка", slots: [] };
      if (rod.variant === "spinning") {
        rigGroup.slots.push({ id: "baits_0", label: "Приманка", type: "lure" });
      } else if (rod.variant === "float" || rod.variant === "pole") {
        rigGroup.slots.push({ id: "float", label: "Поплавок", type: "float" });
        const maxHooks = rod.effectiveStats?.maxHooks || 1;
        for (let i = 0; i < maxHooks; i++) {
          rigGroup.slots.push({
            id: `hooks_${i}`,
            label: `Гачок ${i + 1}`,
            type: "hook",
          });
          if (equipped.hooks && equipped.hooks[i]) {
            rigGroup.slots.push({
              id: `baits_${i}`,
              label: `Наживка ${i + 1}`,
              type: "bait",
            });
          }
        }
      } else if (rod.variant === "feeder") {
        rigGroup.slots.push({
          id: "feederRig",
          label: "Фідерна оснастка",
          type: "feeder_rig",
        });
        const feederRigCaps =
          equipped.feederRig?.capabilities ||
          [];
        const hasChumSlot =
          feederRigCaps.includes("chum_mix") ||
          equipped.feederRig?.effectiveStats?.hasChumSlot;
        if (hasChumSlot)
          rigGroup.slots.push({
            id: "feederChum",
            label: "Прикормка",
            type: "chum_mix",
          });
        const maxHooks =
          equipped.feederRig?.effectiveStats?.hooksCount ||
          rod.effectiveStats?.maxHooks ||
          1;
        for (let i = 0; i < maxHooks; i++) {
          rigGroup.slots.push({
            id: `hooks_${i}`,
            label: `Гачок ${i + 1}`,
            type: "hook",
          });
          if (equipped.hooks && equipped.hooks[i]) {
            rigGroup.slots.push({
              id: `baits_${i}`,
              label: `Наживка ${i + 1}`,
              type: "bait",
            });
          }
        }
      }
      if (rigGroup.slots.length > 0) groups.push(rigGroup);
    }

    const extraGroup = { groupName: "Додатково", slots: [] };
    extraGroup.slots.push({ id: "net", label: "Підсака", type: "net" });
    extraGroup.slots.push({
      id: "delivery",
      label: "Кораблик",
      type: "delivery",
    });

    if (equipped.delivery) {
      const sections =
        equipped.delivery.effectiveStats?.sections ||
        1;
      for (let i = 0; i < sections; i++) {
        extraGroup.slots.push({
          id: `deliveryChums_${i}`,
          label: `Бункер ${i + 1}`,
          type: "chum_mix",
        });
      }
    }
    groups.push(extraGroup);

    return groups;
  }

  #renderEquipment() {
    const fragment = document.createDocumentFragment();
    const equipped = this.#inventoryManager.getEquipped();
    const dynamicLayout = this.#getAvailableSlots(equipped);

    dynamicLayout.forEach((groupConfig) => {
      const groupNode = this.#createGroupContainer(groupConfig.groupName);
      let hasSlots = false;

      groupConfig.slots.forEach((slotConfig) => {
        let item = null;
        if (slotConfig.id.includes("_")) {
          const [baseId, indexStr] = slotConfig.id.split("_");
          const index = parseInt(indexStr, 10);
          if (equipped[baseId] && Array.isArray(equipped[baseId])) {
            item = equipped[baseId][index];
          }
        } else {
          item = equipped[slotConfig.id];
        }

        groupNode.appendChild(
          this.#createSlotDOM(slotConfig.id, slotConfig.label, item, false),
        );
        hasSlots = true;
      });

      if (hasSlots) fragment.appendChild(groupNode);
    });

    this.#leftPanelNode.innerHTML = "";
    this.#leftPanelNode.appendChild(fragment);
  }

  #createGroupContainer(titleText) {
    const group = document.createElement("div");
    group.style.cssText =
      "display: flex; flex-wrap: wrap; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);";
    const title = document.createElement("div");
    title.innerText = titleText;
    title.style.cssText =
      "width: 100%; font-size: 12px; color: #888; text-transform: uppercase; margin-bottom: -5px;";
    group.appendChild(title);
    return group;
  }

  #createSlotDOM(
    slotId,
    label,
    item,
    isInventory = false,
    instanceId = null,
    isBuildPlaceholder = false,
  ) {
    const slotDiv = document.createElement("div");
    slotDiv.className = `inv-slot ${isInventory ? "inventory" : ""}`;

    if (
      !isInventory &&
      slotId &&
      this.#isSelectedItemValidForSlot(slotId)
    ) {
      slotDiv.classList.add("highlight-target");
    }

    // Якщо це пуста заглушка для речі, яка лежить у ящику, але зараз одягнена
    if (isBuildPlaceholder) {
      slotDiv.innerHTML = `<span style="font-size: 10px; color: #00ff80;">Екіпір.</span>`;
      slotDiv.style.borderColor = "#00ff80";
      return slotDiv;
    }

    if (isInventory && instanceId === this.#selectedInstanceId) {
      slotDiv.classList.add("selected");
    }

    if (item) {
      const resolvedInstanceId = instanceId || item.instanceId;
      if (resolvedInstanceId) {
        slotDiv.dataset.instanceId = String(resolvedInstanceId);
      }
      this.#rarityDomAdapter?.apply(slotDiv, item.rarity);
      this.#conditionDomAdapter?.apply(slotDiv, item.condition);
      if (!isInventory) {
        slotDiv.classList.add("equipped");
        // Додаємо фіолетову крапку, якщо річ зі збірки
        if (item.buildId) {
          const badge = document.createElement("div");
          badge.style.cssText =
            "position: absolute; top: -5px; left: -5px; background: #b066ff; width: 8px; height: 8px; border-radius: 50%;";
          slotDiv.appendChild(badge);
        }
      }

      const contentNode = document.createElement("div");
      contentNode.className = "inv-slot__content";
      contentNode.textContent = item.icon || "📦";
      slotDiv.appendChild(contentNode);
      if (isInventory && item.quantity > 1) {
        const quantityNode = document.createElement("span");
        quantityNode.className = "qty";
        quantityNode.textContent = String(item.quantity);
        slotDiv.appendChild(quantityNode);
      }
      this.#progressionDomAdapter?.apply(slotDiv, item.progression);

      this.#addTooltip(
        slotDiv,
        item,
        slotId,
        !isInventory,
        instanceId || item.instanceId,
      );
    } else {
      slotDiv.innerHTML = `<span style="font-size: 10px; color: #555;">✖</span>`;
      slotDiv.title = label;

      // --- ДОДАНО: Візуальне виділення активного пустого слота ---
      if (this.#highlightedSlotId === slotId) {
        slotDiv.classList.add("highlight-active-empty");
      }
      // -----------------------------------------------------------

      slotDiv.addEventListener("click", () => {
        if (this.#inventoryManager.isLocked) {
          this.showWarning(
            "Витягніть снасть з води, щоб змінити екіпірування!",
          );
          return;
        }

        if (this.#tryEquipSelectedItemToSlot(slotId)) return;

        if (!this.#viewingBuildId) {
          // --- ДОДАНО: Логіка перемикання підсвітки сумісних речей ---
          if (this.#highlightedSlotId === slotId) {
            this.#highlightedSlotId = null; // Якщо клікнули повторно - вимикаємо
          } else {
            this.#highlightedSlotId = slotId; // Вмикаємо пошук для цього слота
            this.#selectedInstanceId = null; // Скидаємо виділений предмет у рюкзаку, якщо був
          }
          this.refreshUI();
          // ---------------------------------------------------------
        }
      });
    }

    return slotDiv;
  }

  #resolveEquipInteraction(item) {
    return this.#equipTargetPolicy.resolve({
      item,
      slotGroups: this.#getAvailableSlots(
        this.#inventoryManager.getEquipped(),
      ),
      validateSlot: (slotId, candidate) =>
        this.#inventoryManager.validateEquipToSlot(slotId, candidate),
    });
  }

  #isSelectedItemValidForSlot(slotId) {
    if (!this.#selectedInstanceId) return false;
    const selectedItem = this.#inventoryManager._hydrateInstance(
      this.#selectedInstanceId,
    );
    if (!selectedItem) return false;
    return this.#inventoryManager.validateEquipToSlot(
      slotId,
      selectedItem,
    ).isValid;
  }

  #tryEquipSelectedItemToSlot(slotId) {
    if (!this.#selectedInstanceId) return false;

    const selectedItem = this.#inventoryManager._hydrateInstance(
      this.#selectedInstanceId,
    );
    if (!selectedItem) {
      this.#selectedInstanceId = null;
      return false;
    }

    const validation = this.#inventoryManager.validateEquipToSlot(
      slotId,
      selectedItem,
    );
    if (!validation.isValid) {
      this.showWarning(validation.reason);
      return true;
    }

    const equipped = this.#inventoryManager.equipItem(
      slotId,
      this.#selectedInstanceId,
    );
    if (!equipped) {
      this.showWarning("Не вдалося спорядити предмет у вибраний слот.");
      return true;
    }

    this.#selectedInstanceId = null;
    this.#highlightedSlotId = null;
    this.refreshUI();
    return true;
  }

  #tryEquipInventoryItemToHighlightedSlot(instanceId, item) {
    if (!this.#highlightedSlotId) return false;

    const validation = this.#inventoryManager.validateEquipToSlot(
      this.#highlightedSlotId,
      item,
    );
    if (!validation.isValid) return false;

    const equipped = this.#inventoryManager.equipItem(
      this.#highlightedSlotId,
      instanceId,
    );
    if (!equipped) {
      this.showWarning("Не вдалося спорядити предмет у вибраний слот.");
      return true;
    }

    this.#selectedInstanceId = null;
    this.#highlightedSlotId = null;
    this.refreshUI();
    return true;
  }

  #handleInventoryItemClick(instanceId) {
    const item = this.#inventoryManager._hydrateInstance(instanceId);
    if (!item) {
      this.showWarning("Предмет не знайдено.");
      return;
    }

    if (this.#tryEquipInventoryItemToHighlightedSlot(instanceId, item)) {
      return;
    }

    this.#highlightedSlotId = null;

    if (this.#selectedInstanceId === instanceId) {
      const result = this.#inventoryManager.autoEquipItem(instanceId);
      if (!result.success) this.showWarning(result.reason);
      this.#selectedInstanceId = null;
      this.refreshUI();
      return;
    }

    const interaction = this.#resolveEquipInteraction(item);
    if (interaction.shouldEquipImmediately) {
      const equipped = this.#inventoryManager.equipItem(
        interaction.validSlotIds[0],
        instanceId,
      );
      if (!equipped) {
        this.showWarning("Не вдалося спорядити предмет.");
      }
      this.#selectedInstanceId = null;
    } else if (interaction.requiresSlotChoice) {
      this.#selectedInstanceId = instanceId;
    } else {
      const validation = this.#inventoryManager.validateEquip(item);
      this.#selectedInstanceId = null;
      this.showWarning(
        interaction.rejectionReason ||
          validation.reason ||
          "Для цього предмета немає доступного слота.",
      );
    }

    this.refreshUI();
  }

  #addTooltip(element, item, slotId, isEquipped, instanceId) {
    element.addEventListener("mouseenter", () => {
      if (!window.matchMedia("(hover: hover)").matches) return;

      const currentItem = instanceId
        ? this.#inventoryManager.hydrateInstance(instanceId) || item
        : item;
      this.#rarityDomAdapter?.apply(this.#tooltipNode, currentItem.rarity);

      const titleHtml = `<div class="inv-tooltip-title">${currentItem.icon} ${currentItem.name}</div>`;
      let detailsHtml = "";
      const renderedLabels = new Set();
      const displayStats = currentItem.displayStats || {};
      for (const [label, value] of Object.entries(displayStats)) {
        if (value === undefined || value === null) continue;
        renderedLabels.add(label);
        detailsHtml += `<div class="inv-tooltip-stat" style="color: #aaa;"><b>${label}:</b> <span style="color: #fff;">${value}</span></div>`;
      }

      const internalKeys = new Set([
        "id",
        "name",
        "icon",
        "itemType",
        "variant",
        "instanceId",
        "quantity",
        "buildId",
        "buildName",
        "displayStats",
        "displayStatsSchema",
        "gameplayStats",
        "effectiveStats",
        "statOverrides",
        "rarityProfile",
        "rarity",
        "progressionProfile",
        "progression",
        "requiresTag",
        "level",
        "basePower",
        "compensation",
        "maxDistance",
        "durabilityMaxLoadLossPerPercent",
        "hasReel",
        "capabilities",
        "line",
      ]);

      for (const key of Object.keys(currentItem.effectiveStats || {})) {
        internalKeys.add(key);
      }

      for (const [key, val] of Object.entries(currentItem)) {
        if (internalKeys.has(key) || renderedLabels.has(key)) continue;

        if (typeof val !== "object" && typeof val !== "function") {
          detailsHtml += `<div class="inv-tooltip-stat" style="color: #aaa;"><b>${key}:</b> <span style="color: #fff;">${val}</span></div>`;
        }
      }
      detailsHtml += this.#buildCompatibilityTooltip(currentItem);

      this.#tooltipNode.innerHTML = titleHtml;
      this.#progressionDomAdapter?.appendTooltip(
        this.#tooltipNode,
        currentItem.progression,
      );
      this.#tooltipNode.insertAdjacentHTML("beforeend", detailsHtml);
      this.#tooltipNode.style.display = "block";
      if (currentItem.instanceId) {
        this.#tooltipNode.dataset.instanceId = String(currentItem.instanceId);
      }

      const rect = element.getBoundingClientRect();
      this.#tooltipNode.style.left = `${rect.right + 10}px`;
      this.#tooltipNode.style.top = `${rect.top}px`;
    });

    element.addEventListener("mouseleave", () => {
      this.#hideTooltip();
    });

    element.addEventListener("click", () => {
      this.#hideTooltip();

      if (this.#inventoryManager.isLocked) {
        this.showWarning("Витягніть снасть з води, щоб змінити екіпірування!");
        return;
      }

      if (this.#warningBoxNode.style.display === "block") {
        this.#warningBoxNode.style.display = "none";
      }

      if (item.itemType === "build_box") {
        this.#viewingBuildId = item.instanceId;
        this.refreshUI();
        return;
      }

      if (isEquipped && slotId) {
        if (this.#tryEquipSelectedItemToSlot(slotId)) return;
        this.#highlightedSlotId = null;
        this.#inventoryManager.unequipItem(slotId);
      } else if (!isEquipped && instanceId) {
        this.#handleInventoryItemClick(instanceId);
      }
    });
  }

  #buildCompatibilityTooltip(item) {
    const compatibility = this.#inventoryManager.getCompatibilityInfo(item);
    if (!compatibility?.hasCompatibility) return "";

    const requiredLabel = this.#getRequiredTagLabel(compatibility.requiredTag);
    const rodLabel = this.#getRodTypeLabel(
      compatibility.rodType,
      compatibility.rodHasReel,
    );
    const statusClass = compatibility.isCompatible
      ? "compatible"
      : "incompatible";
    const statusText = compatibility.isCompatible ? "Сумісно" : "Не сумісно";

    return `
      <div class="inv-tooltip-section">
        <div class="inv-tooltip-section-title">Сумісність</div>
        <div class="inv-tooltip-stat"><b>Для вудки:</b> <span>${requiredLabel}</span></div>
        <div class="inv-tooltip-stat"><b>Поточна:</b> <span>${rodLabel}</span></div>
        <div class="inv-tooltip-compat ${statusClass}">${statusText}</div>
      </div>
    `;
  }

  #getRequiredTagLabel(tag) {
    const labels = {
      bait: "Гачок або фідерна оснастка",
      chum_mix: "Фідер / підгодовування",
      feeder_rig: "Фідер",
      float: "Поплавкова: болонська або махова",
      hook: "Поплавкова / фідерна",
      lure: "Спінінг",
      line: "Ліска потрібної довжини",
      reel: "Вудка з котушкою",
    };
    return labels[tag] || tag || "Не вказано";
  }

  #getRodTypeLabel(type, hasReel) {
    const labels = {
      feeder: "Фідер",
      spinning: "Спінінг",
    };
    if (type === "float" || type === "pole") {
      return hasReel ? "Болонська" : "Махова";
    }
    return labels[type] || "Не споряджена";
  }

  #renderBuildControls() {
    this.#categoryContainerNode.innerHTML = "";
    this.#subFilterContainerNode.classList.remove("active");

    const backBtn = document.createElement("button");
    backBtn.innerText = "🔙 Назад";
    backBtn.style.cssText =
      "background: #34495e; color: #fff; border: 1px solid #73c2fb; border-radius: 5px; padding: 5px 10px; cursor: pointer; margin-right: 15px;";
    backBtn.onclick = () => {
      this.#viewingBuildId = null;
      this.refreshUI();
    };

    const equipBtn = document.createElement("button");
    equipBtn.innerText = "✅ Екіпірувати все";
    equipBtn.style.cssText =
      "background: #00ff80; color: #000; border: none; border-radius: 5px; padding: 5px 10px; cursor: pointer; font-weight: bold; margin-right: 10px;";
    equipBtn.onclick = () => {
      if (this.#inventoryManager.isLocked) {
        this.showWarning("Витягніть снасть з води!");
        return;
      }
      this.#inventoryManager.equipBuild(this.#viewingBuildId);
      this.#viewingBuildId = null;
      this.refreshUI();
    };

    const breakBtn = document.createElement("button");
    breakBtn.innerText = "🔨 Розібрати";
    breakBtn.style.cssText =
      "background: #ff4444; color: #fff; border: none; border-radius: 5px; padding: 5px 10px; cursor: pointer; font-weight: bold;";
    breakBtn.onclick = () => {
      if (this.#inventoryManager.isLocked) {
        this.showWarning("Витягніть снасть з води!");
        return;
      }
      this.#inventoryManager.disassembleBuild(this.#viewingBuildId);
      this.#viewingBuildId = null;
      this.refreshUI();
    };

    this.#categoryContainerNode.append(backBtn, equipBtn, breakBtn);
  }

  #renderCategories() {
    const fragment = document.createDocumentFragment();

    const funnelBtn = document.createElement("button");
    funnelBtn.className = `inv-funnel-btn ${this.#isFunnelOpen ? "active" : ""}`;
    funnelBtn.innerHTML = "🔽";
    funnelBtn.onclick = () => {
      this.#isFunnelOpen = !this.#isFunnelOpen;
      this.#renderSubFilters();
    };
    fragment.appendChild(funnelBtn);

    this.#inventoryCategories.forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = `inv-category-btn ${this.#activeCategory === cat.id ? "active" : ""}`;
      btn.innerText = cat.label;
      btn.onclick = () => {
        this.#activeCategory = cat.id;
        this.#activeSubFilters.clear();
        this.#highlightedSlotId = null;
        this.refreshUI();
      };
      fragment.appendChild(btn);
    });

    this.#categoryContainerNode.innerHTML = "";
    this.#categoryContainerNode.appendChild(fragment);
    this.#renderSubFilters();
  }

  #renderSubFilters() {
    if (!this.#isFunnelOpen) {
      this.#subFilterContainerNode.classList.remove("active");
      const funnelBtn =
        this.#categoryContainerNode.querySelector(".inv-funnel-btn");
      if (funnelBtn) funnelBtn.classList.remove("active");
      return;
    }

    this.#subFilterContainerNode.classList.add("active");
    const funnelBtn =
      this.#categoryContainerNode.querySelector(".inv-funnel-btn");
    if (funnelBtn) funnelBtn.classList.add("active");

    this.#subFilterContainerNode.innerHTML = "";

    const items = this.#inventoryManager.getInventoryItems();
    const catConfig = this.#inventoryCategories.find(
      (c) => c.id === this.#activeCategory,
    );

    const availableGroups = new Set();

    items.forEach((invItem) => {
      if (invItem.buildId && !this.#viewingBuildId) return;
      const itemData = this.#inventoryManager._hydrateInstance(
        invItem.instanceId,
      );
      if (!itemData) return;

      // --- НОВА ЛОГІКА ДЛЯ ЗБІРОК ---
      if (this.#activeCategory === "builds") {
        if (itemData.itemType === "build_box") {
          availableGroups.add(itemData.name); // Чекбокси отримують імена збірок!
        }
        return;
      }

      // Для всіх інших категорій ховаємо ящики з лійки
      if (itemData.itemType === "build_box") return;

      if (
        catConfig.acceptTypes === "ALL" ||
        catConfig.acceptTypes.includes(itemData.itemType)
      ) {
        const filterType = itemData.variant || itemData.itemType;
        const groupLabel = this.#subfilterMapping[filterType] || filterType;
        availableGroups.add(groupLabel);
      }
    });

    if (availableGroups.size === 0) {
      this.#subFilterContainerNode.innerHTML =
        "<span style='color: #888; font-size: 12px;'>Немає предметів для сортування</span>";
      return;
    }

    const fragment = document.createDocumentFragment();
    Array.from(availableGroups)
      .sort()
      .forEach((groupLabel) => {
        const labelNode = document.createElement("label");
        labelNode.className = "inv-subfilter-label";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = this.#activeSubFilters.has(groupLabel);
        cb.onchange = (e) => {
          if (e.target.checked) this.#activeSubFilters.add(groupLabel);
          else this.#activeSubFilters.delete(groupLabel);
          this.#renderInventory();
        };

        labelNode.appendChild(cb);
        labelNode.appendChild(document.createTextNode(groupLabel));
        fragment.appendChild(labelNode);
      });

    this.#subFilterContainerNode.appendChild(fragment);
  }

  #renderInventory() {
    const fragment = document.createDocumentFragment();
    const items = this.#inventoryManager.getInventoryItems();

    const equippedItems = this.#inventoryManager.getEquipped();
    const equippedCounts = {};
    const countItem = (item) => {
      if (item && item.instanceId) {
        equippedCounts[item.instanceId] =
          (equippedCounts[item.instanceId] || 0) + 1;
      }
    };

    countItem(equippedItems.rod);
    countItem(equippedItems.reel);
    countItem(equippedItems.line);
    countItem(equippedItems.float);
    countItem(equippedItems.feederRig);
    countItem(equippedItems.feederChum);
    countItem(equippedItems.net);
    countItem(equippedItems.delivery);
    if (equippedItems.deliveryChums)
      equippedItems.deliveryChums.forEach(countItem);
    if (equippedItems.hooks) equippedItems.hooks.forEach(countItem);
    if (equippedItems.baits) equippedItems.baits.forEach(countItem);

    if (this.#viewingBuildId) {
      items.forEach((invItem) => {
        if (invItem.buildId !== this.#viewingBuildId) return;

        const itemData = this.#inventoryManager._hydrateInstance(
          invItem.instanceId,
        );
        if (!itemData) return;

        const eqCount = equippedCounts[invItem.instanceId] || 0;

        if (eqCount >= itemData.quantity) {
          fragment.appendChild(
            this.#createSlotDOM(null, null, null, true, null, true),
          );
        } else {
          const displayItemData = {
            ...itemData,
            quantity: itemData.quantity - eqCount,
          };
          fragment.appendChild(
            this.#createSlotDOM(
              null,
              null,
              displayItemData,
              true,
              invItem.instanceId,
            ),
          );
        }
      });
    } else {
      const catConfig = this.#inventoryCategories.find(
        (c) => c.id === this.#activeCategory,
      );

      items.forEach((invItem) => {
        if (invItem.buildId) return;

        const itemData = this.#inventoryManager._hydrateInstance(
          invItem.instanceId,
        );
        if (!itemData) return;

        if (
          catConfig.acceptTypes !== "ALL" &&
          !catConfig.acceptTypes.includes(itemData.itemType)
        )
          return;

        // --- ВИПРАВЛЕНО: Роздільна фільтрація ---
        if (this.#activeCategory === "builds") {
          // У вкладці Збірки фільтруємо за назвами ящиків
          if (
            this.#activeSubFilters.size > 0 &&
            !this.#activeSubFilters.has(itemData.name)
          )
            return;
        } else {
          // У всіх інших вкладках фільтруємо за типом (а ящик тепер зникає, якщо не вибраний)
          const filterType = itemData.variant || itemData.itemType;
          const groupLabel = this.#subfilterMapping[filterType] || filterType;
          if (
            this.#activeSubFilters.size > 0 &&
            !this.#activeSubFilters.has(groupLabel)
          )
            return;
        }

        const eqCount = equippedCounts[invItem.instanceId] || 0;
        const remainingQty = itemData.quantity - eqCount;
        if (remainingQty <= 0 && itemData.itemType !== "build_box") return;

        const displayItemData = { ...itemData, quantity: remainingQty };

        // 1. Створюємо DOM-елемент слота
        const slotDom = this.#createSlotDOM(
          null,
          null,
          displayItemData,
          true,
          invItem.instanceId,
        );

        // 2. ДОДАНО: Перевіряємо, чи є зараз активний пустий слот для підсвітки
        if (this.#highlightedSlotId) {
          const baseSlot = this.#highlightedSlotId.split("_")[0];
          const config =
            this.#slotConfig[baseSlot] || null;

          // Спочатку груба перевірка за типом слота
          if (
            config &&
            config.acceptTypes &&
            config.acceptTypes.includes(itemData.itemType)
          ) {
            // Потім глибока перевірка валідатором (на наявність вудки/гачка)
            const validation = this.#inventoryManager.validateEquipToSlot(
              this.#highlightedSlotId,
              itemData,
            );
            if (validation.isValid) {
              slotDom.classList.add("highlight-compatible");
            }
          }
        }

        // 3. Тепер додаємо готовий слот (з підсвіткою або без) у фрагмент
        fragment.appendChild(slotDom);
      });
    }

    this.#inventoryGridNode.innerHTML = "";
    this.#inventoryGridNode.appendChild(fragment);
  }

  dispose() {
    document.removeEventListener(
      "inventory-changed",
      this.#onInventoryChanged,
    );
    document.removeEventListener(
      "item-progression-updated",
      this.#onProgressionUpdated,
    );
    if (this.#warningTimeout) {
      clearTimeout(this.#warningTimeout);
      this.#warningTimeout = null;
    }
    this.#backpackButtonNode?.remove();
    this.#containerNode?.remove();
    this.#tooltipNode?.remove();
    this.#backpackButtonNode = null;
    this.#containerNode = null;
    this.#tooltipNode = null;
    this.#isOpen = false;
  }
}
