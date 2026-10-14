export class HouseView {
  #document;
  #window;
  #root;
  #nodes = new Map();
  #perform;
  #roomConfig;
  #uiConfig;
  #onReturn;
  #lastLevel = null;
  #levelCardKeys = new Map();
  #rooms;
  #roomIndex = 0;
  #activePanel = null;
  #headerVisible = null;
  #dockExpanded = null;
  #dockHovered = false;
  #sheetCloseCancel = null;
  #sheetHeights;
  #noticeTimer = null;
  #fishView;
  #feedPicker;
  #resourceMeters;
  #feedMeter;
  #capacityMeter;
  #sheetHandleRenderer;
  #sheetHandles = [];
  #sheetDismissLabel;
  #autoSwitchRenderer;
  #autoSwitch;
  #panels;
  #panelButtons;
  #actions = new Map();
  #backgrounds = new Map();
  #scene;
  #panelFocus = null;
  #fishLists = new Map();
  #motionPreference;

  constructor({ documentRef, windowTarget, perform, roomConfig, uiConfig,
    returnTo, onReturn, fishView, feedPicker,
    resourceMeters, sheetHeights, sheetHandleRenderer, sheetDismissLabel, menuHandleLabel = sheetDismissLabel, autoSwitchRenderer }) {
    this.#document = documentRef;
    this.#window = windowTarget;
    this.#motionPreference = windowTarget.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
    this.#root = documentRef.body;
    this.#perform = perform;
    this.#roomConfig = roomConfig;
    this.#uiConfig = uiConfig;
    this.#onReturn = onReturn;
    this.#fishView = fishView;
    this.#feedPicker = feedPicker;
    this.#resourceMeters = resourceMeters;
    this.#sheetHeights = sheetHeights;
    this.#sheetHandleRenderer = sheetHandleRenderer;
    this.#sheetDismissLabel = sheetDismissLabel;
    this.#autoSwitchRenderer = autoSwitchRenderer;
    for (const name of ["level", "capacity", "unowned", "owned", "upgrade-level", "upgrade-capacity", "feed-slots",
      "auto-status", "bait-count", "live-baits", "keepnet-warning",
      "dead-count", "catch-count", "catches", "notice", "aquarium-image", "room-track",
      "room-count", "room-prev", "room-next", "room-navigation", "header", "dock", "scrim",
      "room-level-panel", "room-max-level", "room-next-level", "room-duration",
      "room-segments", "room-level-list", "aquarium-segments", "room-level-count", "aquarium-level-count", "capacity-meter",
      "renovation", "renovation-level", "renovation-time", "aquarium-stage", "feed-bar",
      "feed-image", "feed-meter", "feed-time", "auto-switch-mount", "dock-handle-mount"])
      this.#nodes.set(name, documentRef.querySelector(`[data-house-${name}]`));
    this.#panels = [...documentRef.querySelectorAll("[data-house-panel]")];
    this.#panelButtons = [...documentRef.querySelectorAll("[data-house-panel-button]")];
    for (const action of documentRef.querySelectorAll("[data-house-action]"))
      this.#actions.set(action.dataset.houseAction, action);
    for (const phase of ["day", "evening", "night"])
      this.#backgrounds.set(phase, documentRef.querySelector(`[data-house-background="${phase}"]`));
    this.#scene = documentRef.querySelector(".house__scene");
    for (const panel of this.#panels) sheetHeights.attach(panel, panel.querySelector(".house__sheet-content"));
    for (const mount of documentRef.querySelectorAll("[data-house-sheet-handle-mount]")) {
      const panel = mount.closest("[data-house-panel]");
      const handle = sheetHandleRenderer.create({ label: this.#sheetDismissLabel,
        onDismiss: () => this.#dismissPanel(), onDragStart: () => sheetHeights.startDrag(panel),
        onDrag: distance => { if (distance > 0) sheetHeights.drag(panel, distance); else sheetHeights.settle(panel); } });
      mount.appendChild(handle);
      this.#sheetHandles.push(handle);
    }
    const menuHandle = sheetHandleRenderer.create({ label: menuHandleLabel,
      onTap: () => this.#setZones(this.#headerVisible, !this.#dockExpanded),
      onExpand: () => this.#setZones(this.#headerVisible, true),
      onDismiss: () => this.#setZones(this.#headerVisible, false) });
    this.#nodes.get("dock-handle-mount").appendChild(menuHandle);
    this.#sheetHandles.push(menuHandle);
    this.#autoSwitch = autoSwitchRenderer.create({ id: "house-auto-feeder", name: "Автогодівниця",
      modeLabel: "Увімкнути автогодівницю", variant: "control", className: "house__auto-switch",
      onChange: () => this.#perform("toggleAutoFeeder") });
    this.#nodes.get("auto-switch-mount").appendChild(this.#autoSwitch);
    this.#rooms = [...documentRef.querySelectorAll("[data-house-room]")];
    documentRef.querySelector("[data-house-return]").href = returnTo;
    this.#nodes.get("room-navigation").hidden = this.#rooms.length < 2;
    this.#setZones(false, false);
    this.#roomConfig && (this.#nodes.get("aquarium-image").src = this.#roomConfig.aquariumImage);
    this.#root.addEventListener("click", this.#handleClick);
    this.#root.addEventListener("keydown", this.#handlePanelKey);
    this.#nodes.get("dock").addEventListener("pointerover", this.#handleDockOver);
    this.#nodes.get("dock").addEventListener("pointerleave", this.#handleDockLeave);
    this.#nodes.get("room-track")?.addEventListener("keydown", this.#handleRoomKey);
    this.#showRoom(0);
  }

  dispose() {
    this.#setPanel(null);
    for (const panel of this.#panels) this.#sheetHeights.detach(panel);
    if (this.#noticeTimer !== null) this.#window.clearTimeout(this.#noticeTimer);
    this.#root.removeEventListener("click", this.#handleClick);
    this.#root.removeEventListener("keydown", this.#handlePanelKey);
    this.#nodes.get("dock").removeEventListener("pointerover", this.#handleDockOver);
    this.#nodes.get("dock").removeEventListener("pointerleave", this.#handleDockLeave);
    this.#setDockHovered(false);
    this.#nodes.get("room-track")?.removeEventListener("keydown", this.#handleRoomKey);
    for (const handle of this.#sheetHandles) {
      this.#sheetHandleRenderer.dispose(handle);
      handle.remove();
    }
    this.#sheetHandles.length = 0;
    this.#autoSwitchRenderer.dispose(this.#autoSwitch);
    this.#autoSwitch.remove();
    this.#feedMeter?.remove();
    this.#feedMeter = null;
    this.#capacityMeter?.remove();
    this.#capacityMeter = null;
    for (const list of this.#fishLists.values()) {
      for (const record of list.rows.values()) record.row.remove();
      list.empty.remove();
    }
    this.#fishLists.clear();
  }

  announce(message, failed = false) {
    const node = this.#nodes.get("notice");
    node.textContent = message || "";
    node.classList.toggle("house__notice--error", failed);
    if (this.#noticeTimer !== null) this.#window.clearTimeout(this.#noticeTimer);
    this.#noticeTimer = message ? this.#window.setTimeout(() => {
      node.textContent = "";
      this.#noticeTimer = null;
    }, this.#uiConfig.noticeDurationMs) : null;
  }

  render(model) {
    const get = (key) => this.#nodes.get(key);
    const aquarium = model.aquarium;
    get("level").setAttribute("aria-label", model.levelLabel);
    get("capacity").textContent = `${aquarium.count} / ${aquarium.capacity}`;
    get("aquarium-level-count").textContent = `${aquarium.level} / ${aquarium.maxLevel}`;
    const capacity = Math.max(0, Number(aquarium.capacity) || 0), count = Math.max(0, Number(aquarium.count) || 0);
    const occupancy = capacity > 0 ? Math.min(100, count / capacity * 100) : count > 0 ? 100 : 0;
    const capacityReading = { id: "aquarium-capacity", percent: occupancy, remainingPercent: 100 - occupancy,
      label: model.capacityLabel || get("capacity").textContent };
    if (!this.#capacityMeter) {
      this.#capacityMeter = this.#resourceMeters.create(capacityReading, { variant: "summary", showIcon: false });
      get("capacity-meter").appendChild(this.#capacityMeter);
    } else this.#resourceMeters.updateReading(this.#capacityMeter, capacityReading);
    this.#renderLevelCard("aquarium", aquarium.level, aquarium.maxLevel, null, 0);
    get("unowned").hidden = aquarium.owned;
    get("owned").hidden = !aquarium.owned;
    get("aquarium-image").hidden = !aquarium.owned;
    get("aquarium-stage").hidden = !aquarium.owned;
    this.#fishView.show(model.liveBaits.filter((fish) => fish.location === "aquarium"), aquarium.owned);
    const upgrade = this.#actions.get("upgrade");
    upgrade.hidden = !aquarium.owned;
    const affordable = model.upgradeAffordable !== false;
    upgrade.disabled = aquarium.level >= aquarium.maxLevel || !affordable;
    upgrade.classList.toggle("inventory-action--primary", affordable);
    upgrade.classList.toggle("inventory-action--danger", !affordable);
    upgrade.setAttribute("aria-label", model.upgradeLabel);
    upgrade.setAttribute("title", model.upgradeLabel);
    get("upgrade-level").textContent = String(model.upgradeLevel);
    get("upgrade-capacity").textContent = String(model.upgradeCapacity);
    get("auto-status").textContent = model.autoStatus;
    get("bait-count").textContent = `${model.liveBaits.length} риб`;
    get("catch-count").textContent = `${model.keepnet.length} риб`;
    get("keepnet-warning").hidden = !model.liveBaits.some((fish) => fish.location === "keepnet");
    get("dead-count").hidden = model.deadCount === 0;
    get("dead-count").textContent = model.deadCount > 0 ? `Живців втрачено: ${model.deadCount}` : "";
    this.#feedPicker.update(model);
    this.#actions.get("buyAutoFeeder").hidden = aquarium.autoFeeder.owned;
    this.#nodes.get("auto-switch-mount").hidden = !aquarium.autoFeeder.owned;
    const hasFeedStock = Number(model.feedStock) > 0 && model.canAutoFeed !== false;
    this.#autoSwitchRenderer.update(this.#autoSwitch, { checked: aquarium.autoFeeder.enabled && hasFeedStock,
      disabled: !hasFeedStock || !aquarium.autoFeeder.owned,
      modeLabel: model.autoToggleLabel });
    this.#renderFeed(model);
    this.#renderFish(get("live-baits"), model.liveBaits, true);
    this.#renderFish(get("catches"), model.keepnet, false);
    this.#renderRoom(model.room);
    if (model.error) this.announce(`Помилка збереження: ${model.error}`, true);
  }

  #renderRoom(room) {
    const get = (key) => this.#nodes.get(key);
    if (room.level !== this.#lastLevel) {
      const art = this.#roomConfig.backgrounds[room.level];
      for (const phase of ["day", "evening", "night"])
        this.#backgrounds.get(phase).src = art[phase];
      this.#lastLevel = room.level;
    }
    const scene = this.#scene;
    scene.style.setProperty("--house-evening", room.eveningOpacity);
    scene.style.setProperty("--house-night", room.nightOpacity);
    get("room-level-panel").textContent = String(room.level);
    get("room-max-level").textContent = String(room.maxLevel);
    get("room-level-count").textContent = `${room.level} / ${room.maxLevel}`;
    get("room-next-level").textContent = room.nextDurationMs === null
      ? "Максимальний рівень" : `Наступний рівень: ${room.level + 1}`;
    get("room-duration").textContent = room.nextDurationMs === null
      ? "" : `${room.nextDurationMs / 3600000} год`;
    const progress = room.targetLevel === null || room.nextDurationMs === null ? 0
      : Math.max(0, Math.min(1, 1 - room.remainingMs / room.nextDurationMs));
    this.#renderLevelCard("room", room.level, room.maxLevel, room.targetLevel, progress,
      (level) => ({ bonus: "+ нове оформлення кімнати", detail: `${this.#roomConfig.upgradeDurationMs[level] / 3600000} год · 3 фони` }));
    this.#actions.get("upgradeRoom").disabled =
      room.nextDurationMs === null || room.targetLevel !== null;
    const renovating = room.targetLevel !== null;
    get("renovation").hidden = !renovating;
    get("dock").hidden = renovating;
    if (renovating) {
      this.#setPanel(null);
      get("renovation-level").textContent = `Ремонт до рівня ${room.targetLevel}`;
      get("renovation-time").textContent = this.#formatCountdown(room.remainingMs);
    }
  }

  #formatCountdown(ms) {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  #renderLevelCard(name, level, maxLevel, targetLevel, progress, describe) {
    const segments = this.#nodes.get(`${name}-segments`);
    const list = this.#nodes.get(`${name}-level-list`);
    const key = `${level}:${maxLevel}:${targetLevel}`;
    if (this.#levelCardKeys.get(name) !== key) {
      const bars = [];
      for (let index = 1; index <= maxLevel; index++) {
        const bar = this.#el("span", "inventory-parameter__segment house__level-segment");
        if (index <= level) bar.classList.add("inventory-parameter__segment--filled");
        if (index === targetLevel) bar.classList.add("house__level-segment--pending");
        bars.push(bar);
      }
      segments.replaceChildren(...bars);
      const nextLevel = level < maxLevel ? level + 1 : null;
      if (list) list.hidden = nextLevel === null;
      if (list && nextLevel === null) list.replaceChildren();
      else if (list) {
        const benefit = describe(nextLevel);
        const row = this.#el("li", "house__level-step");
        if (nextLevel === targetLevel) row.classList.add("house__level-step--pending");
        row.append(this.#el("span", "house__level-name", `Рівень ${nextLevel}`),
          this.#el("strong", "house__level-bonus", benefit.bonus), this.#el("small", "house__level-detail", benefit.detail));
        list.replaceChildren(row);
      }
      this.#levelCardKeys.set(name, key);
    }
    segments.setAttribute("role", "progressbar");
    segments.setAttribute("aria-valuemin", "0");
    segments.setAttribute("aria-valuemax", String(maxLevel));
    segments.setAttribute("aria-valuenow", String(level + progress));
    if (targetLevel !== null) segments.children[targetLevel - 1]?.style.setProperty("--house-progress", `${Math.round(progress * 100)}%`);
  }

  #renderFeed(model) {
    const feed = model.aquarium.feed;
    this.#nodes.get("feed-bar").hidden = !feed;
    if (feed) {
      const image = this.#nodes.get("feed-image");
      if (image.getAttribute("src") !== feed.imagePath) image.src = feed.imagePath;
      image.alt = feed.name;
      const percentage = Number(feed.percentage);
      const percent = Number.isFinite(percentage) ? Math.max(0, Math.min(100, percentage)) : 0;
      const reading = { id: "aquarium-feed", percent,
        label: `${feed.name}: ${Math.round(percent)}% · ${model.feedTimeLabel}` };
      if (!this.#feedMeter) {
        this.#feedMeter = this.#resourceMeters.create(reading, { variant: "parameter", showIcon: false });
        this.#nodes.get("feed-meter").appendChild(this.#feedMeter);
      } else this.#resourceMeters.updateReading(this.#feedMeter, reading);
      this.#nodes.get("feed-time").textContent = model.feedTimeLabel;
    }
  }

  #renderFish(container, fish, live) {
    let list = this.#fishLists.get(container);
    if (!list) {
      list = { rows: new Map(), empty: this.#el("p", "house__muted", live ? "Живця немає." : "Садок порожній.") };
      this.#fishLists.set(container, list);
    }
    const active = new Set();
    const rows = fish.map((entry) => {
      active.add(entry.id);
      let record = list.rows.get(entry.id);
      if (!record) {
        record = { row: this.#el("article", "house__fish"), name: this.#el("strong", "house__fish-name"),
          meta: this.#el("span", "house__muted house__fish-meta") };
        record.row.append(record.name, record.meta);
        if (live) {
          record.timer = this.#el("span", "house__fish-timer");
          record.select = this.#button("select", "", entry.id);
          record.transfer = this.#button("transfer", "До акваріума", entry.id);
          record.release = this.#button("releaseBait", "Випустити", entry.id);
          record.row.append(record.timer, record.select, record.transfer, record.release);
        } else record.row.append(this.#button("release", "Випустити", entry.id));
        list.rows.set(entry.id, record);
      }
      record.name.textContent = entry.name;
      record.meta.textContent = `${entry.weightLabel} · ${live ? entry.locationLabel : "Садок"}`;
      if (live) {
        record.timer.textContent = entry.timerLabel;
        record.select.dataset.houseAction = entry.selected ? "deselect" : "select";
        record.select.textContent = entry.actionLabel;
        record.transfer.hidden = !entry.canTransfer;
        record.release.hidden = entry.location === "hook";
      }
      return record.row;
    });
    for (const id of list.rows.keys()) if (!active.has(id)) list.rows.delete(id);
    const next = rows.length ? rows : [list.empty];
    if (next.length !== container.children.length || next.some((row, index) => container.children[index] !== row))
      container.replaceChildren(...next);
  }

  #button(action, label, id) {
    const button = this.#el("button", "inventory-action house__fish-action", label);
    button.type = "button";
    button.dataset.houseAction = action;
    button.dataset.houseFishId = id;
    return button;
  }

  #el(tag, className, text = null) {
    const element = this.#document.createElement(tag);
    element.className = className;
    if (text !== null) element.textContent = text;
    return element;
  }

  #handleClick = (event) => {
    if (event.target.closest(".house__scene")) {
      const visible = !this.#headerVisible && !this.#dockExpanded && this.#activePanel === null;
      if (this.#activePanel !== null) this.#dismissPanel();
      this.#setZones(visible, visible);
      return;
    }
    if (event.target.closest("[data-house-return]") && this.#onReturn) {
      event.preventDefault();
      this.#onReturn();
      return;
    }
    const action = event.target.closest("[data-house-action]");
    if (action) { this.#perform(action.dataset.houseAction, action.dataset.houseFishId); return; }
    const panelButton = event.target.closest("[data-house-panel-button]");
    if (panelButton) {
      const name = panelButton.dataset.housePanelButton;
      if (this.#activePanel === name) this.#dismissPanel();
      else this.setNavigationState({ expanded: true, panel: name });
      return;
    }
    if (event.target.closest("[data-house-scrim]")) {
      this.#dismissPanel();
      this.#setZones(false, false);
      return;
    }
    if (event.target.closest("[data-house-room-prev]")) this.#showRoom(this.#roomIndex - 1);
    if (event.target.closest("[data-house-room-next]")) this.#showRoom(this.#roomIndex + 1);
  };

  #setPanel(name) {
    this.#setDockHovered(false);
    this.#sheetCloseCancel?.();
    this.#sheetCloseCancel = null;
    if (name === this.#activePanel) return;
    if (name !== null && this.#activePanel === null) this.#panelFocus = this.#document.activeElement;
    this.#activePanel = name;
    this.#nodes.get("dock").classList.toggle("house__dock--panel-open", name !== null);
    this.#nodes.get("dock").classList.remove("house__dock--closing");
    this.#nodes.get("dock-handle-mount").hidden = name !== null;
    for (const panel of this.#panels) {
      panel.classList.remove("house__sheet--closing");
      panel.inert = false;
      panel.hidden = panel.dataset.housePanel !== name;
      if (panel.hidden) this.#sheetHeights.hide(panel);
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "false");
    }
    for (const button of this.#panelButtons) {
      button.setAttribute("aria-expanded", String(button.dataset.housePanelButton === name));
      button.classList.toggle("house__dock-button--selected", button.dataset.housePanelButton === name);
    }
    this.#nodes.get("scrim").hidden = name === null;
    this.#nodes.get("room-track").inert = name !== null;
    this.#nodes.get("room-navigation").inert = name !== null;
    if (name !== null) {
      const panel = this.#panels.find((entry) => entry.dataset.housePanel === name);
      this.#sheetHeights.open(panel);
      this.#panelControls(panel)[0]?.focus();
    } else {
      const fallback = this.#panelButtons.find((button) => button === this.#panelFocus);
      (this.#panelFocus?.isConnected ? this.#panelFocus : fallback)?.focus();
      this.#panelFocus = null;
    }
  }

  #panelControls(panel) {
    return [...(panel?.querySelectorAll("button, input, a[href]") || [])]
      .filter((node) => !node.disabled && !node.closest("[hidden]"));
  }

  #handlePanelKey = (event) => {
    if (this.#activePanel === null) return;
    if (event.key === "Escape" && this.#feedPicker.isOpen) {
      event.preventDefault(); this.#feedPicker.close(); return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      this.#dismissPanel();
      return;
    }
  };

  handleSceneGesture(deltaY) {
    if (this.#activePanel !== null) {
      if (deltaY > 0) this.#dismissPanel();
      return;
    }
    if (deltaY > 0) this.#setZones(this.#dockExpanded ? this.#headerVisible : true, false);
    else if (deltaY < 0) this.#setZones(false, this.#headerVisible ? this.#dockExpanded : true);
  }
  #handleDockOver = (event) => {
    const dock = this.#nodes.get("dock");
    if (event.pointerType === "mouse" && this.#activePanel === null &&
      event.target?.closest(".house__dock-button") && dock.closest(".ui-surface--desktop-hover")) this.#setDockHovered(true);
  };
  #handleDockLeave = () => this.#setDockHovered(false);
  #setDockHovered(hovered) {
    if (hovered === this.#dockHovered) return;
    this.#dockHovered = hovered;
    this.#nodes.get("dock").classList.toggle("house__dock--hovered", hovered);
  }

  setNavigationState({ expanded = false, panel = null } = {}) {
    if (panel !== null && !this.#panels.some(node => node.dataset.housePanel === panel)) return;
    this.#setZones(this.#headerVisible, expanded || panel !== null);
    this.#setPanel(panel);
  }

  #setZones(headerVisible, dockExpanded) {
    if (!dockExpanded) this.#setDockHovered(false);
    if (headerVisible !== this.#headerVisible) {
      this.#headerVisible = headerVisible;
      const header = this.#nodes.get("header");
      header.classList.toggle("house__header--visible", headerVisible);
      header.inert = !headerVisible;
      header.setAttribute("aria-hidden", String(!headerVisible));
    }
    if (dockExpanded !== this.#dockExpanded) {
      this.#dockExpanded = dockExpanded;
      const dock = this.#nodes.get("dock");
      dock.classList.toggle("house__dock--expanded", dockExpanded);
      dock.inert = false;
      dock.setAttribute("aria-hidden", "false");
      this.#nodes.get("dock-handle-mount").children[0]?.setAttribute("aria-expanded", String(dockExpanded));
    }
  }

  #dismissPanel() {
    if (this.#activePanel === null || this.#sheetCloseCancel !== null) return;
    this.#feedPicker.close();
    this.#setDockHovered(false);
    this.#setZones(this.#headerVisible, false);
    if (this.#motionPreference?.matches) { this.#setPanel(null); return; }
    const panel = this.#panels.find(entry => entry.dataset.housePanel === this.#activePanel);
    panel.classList.add("house__sheet--closing");
    this.#nodes.get("dock").classList.add("house__dock--closing");
    panel.inert = true;
    this.#sheetCloseCancel = this.#sheetHeights.close(panel, () => {
      this.#sheetCloseCancel = null;
      this.#setPanel(null);
    });
  }

  #handleRoomKey = (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      this.#showRoom(this.#roomIndex + (event.key === "ArrowRight" ? 1 : -1));
      event.preventDefault();
    }
  };

  #showRoom(index) {
    this.#roomIndex = Math.max(0, Math.min(this.#rooms.length - 1, index));
    const room = this.#rooms[this.#roomIndex];
    if (!room) return;
    this.#nodes.get("room-track").scrollTo({ left: room.offsetLeft,
      behavior: this.#motionPreference?.matches ? "auto" : "smooth" });
    this.#nodes.get("room-count").textContent = `${this.#roomIndex + 1} / ${this.#rooms.length}`;
    this.#nodes.get("room-prev").disabled = this.#roomIndex === 0;
    this.#nodes.get("room-next").disabled = this.#roomIndex === this.#rooms.length - 1;
  }
}
