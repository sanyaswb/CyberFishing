// House navigation state: header/menu zones, the open sheet with its focus and dismissal, desktop menu hover and rooms.
export class HouseNavigationController {
  #document;
  #root;
  #nodes = new Map();
  #panels;
  #panelButtons;
  #rooms;
  #roomIndex = 0;
  #activePanel = null;
  #headerVisible = null;
  #dockExpanded = null;
  #dockHovered = false;
  #sheetCloseCancel = null;
  #panelFocus = null;
  #sheetHeights;
  #sheetHandleRenderer;
  #sheetHandles = [];
  #feedPicker;
  #motionPreference;

  constructor({ documentRef, rootNode, windowTarget, sheetHeights, sheetHandleRenderer, sheetDismissLabel, menuHandleLabel, feedPicker }) {
    this.#document = documentRef;
    this.#root = rootNode;
    this.#sheetHeights = sheetHeights;
    this.#sheetHandleRenderer = sheetHandleRenderer;
    this.#feedPicker = feedPicker;
    this.#motionPreference = windowTarget.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
    for (const name of ["header", "dock", "scrim", "dock-handle-mount", "room-track", "room-navigation",
      "room-count", "room-prev", "room-next"])
      this.#nodes.set(name, documentRef.querySelector(`[data-house-${name}]`));
    this.#panels = [...documentRef.querySelectorAll("[data-house-panel]")];
    this.#panelButtons = [...documentRef.querySelectorAll("[data-house-panel-button]")];
    for (const panel of this.#panels) sheetHeights.attach(panel, panel.querySelector(".house__sheet-content"));
    for (const mount of documentRef.querySelectorAll("[data-house-sheet-handle-mount]")) {
      const panel = mount.closest("[data-house-panel]");
      const handle = sheetHandleRenderer.create({ label: sheetDismissLabel,
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
    this.#rooms = [...documentRef.querySelectorAll("[data-house-room]")];
    this.#nodes.get("room-navigation").hidden = this.#rooms.length < 2;
    this.#setZones(false, false);
    this.#root.addEventListener("keydown", this.#handlePanelKey);
    this.#nodes.get("dock").addEventListener("pointerover", this.#handleDockOver);
    this.#nodes.get("dock").addEventListener("pointerleave", this.#handleDockLeave);
    this.#nodes.get("room-track")?.addEventListener("keydown", this.#handleRoomKey);
    this.#showRoom(0);
  }

  dispose() {
    this.#setPanel(null);
    for (const panel of this.#panels) this.#sheetHeights.detach(panel);
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
  }

  // Returns true when the click belonged to navigation (scene, menu button, scrim or room arrows).
  handleClick(event) {
    if (event.target.closest(".house__scene")) {
      const visible = !this.#headerVisible && !this.#dockExpanded && this.#activePanel === null;
      if (this.#activePanel !== null) this.#dismissPanel();
      this.#setZones(visible, visible);
      return true;
    }
    const panelButton = event.target.closest("[data-house-panel-button]");
    if (panelButton) {
      const name = panelButton.dataset.housePanelButton;
      if (this.#activePanel === name) this.#dismissPanel();
      else this.setNavigationState({ expanded: true, panel: name });
      return true;
    }
    if (event.target.closest("[data-house-scrim]")) {
      this.#dismissPanel();
      this.#setZones(false, false);
      return true;
    }
    if (event.target.closest("[data-house-room-prev]")) { this.#showRoom(this.#roomIndex - 1); return true; }
    if (event.target.closest("[data-house-room-next]")) { this.#showRoom(this.#roomIndex + 1); return true; }
    return false;
  }

  handleSceneGesture(deltaY) {
    if (this.#activePanel !== null) {
      if (deltaY > 0) this.#dismissPanel();
      return;
    }
    if (deltaY > 0) this.#setZones(this.#dockExpanded ? this.#headerVisible : true, false);
    else if (deltaY < 0) this.#setZones(false, this.#headerVisible ? this.#dockExpanded : true);
  }

  setNavigationState({ expanded = false, panel = null } = {}) {
    if (panel !== null && !this.#panels.some(node => node.dataset.housePanel === panel)) return;
    this.#setZones(this.#headerVisible, expanded || panel !== null);
    this.#setPanel(panel);
  }

  // The open sheet's content, the container of notices about its actions (spec 080); null when no sheet is open.
  activeSheetContent() {
    if (this.#activePanel === null) return null;
    const panel = this.#panels.find((entry) => entry.dataset.housePanel === this.#activePanel);
    return panel?.querySelector(".house__sheet-content") ?? null;
  }

  // A renovation hides the menu and closes its sheet.
  setLocked(locked) {
    this.#nodes.get("dock").hidden = locked;
    if (locked) this.#setPanel(null);
  }

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
    }
  };

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
