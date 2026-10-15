// House screen: aquarium status and actions; composes navigation, room art and fish lists injected by bootstrap.
export class HouseView {
  #window;
  #root;
  #nodes = new Map();
  #perform;
  #uiConfig;
  #onReturn;
  #noticeTimer = null;
  #fishView;
  #feedPicker;
  #resourceMeters;
  #feedMeter;
  #capacityMeter;
  #autoSwitchRenderer;
  #autoSwitch;
  #actions = new Map();
  #labels;
  #navigation;
  #roomView;
  #aquariumLevelCard;
  #liveBaitList;
  #keepnetList;
  #hints;
  #notice;
  #noticeRoom;

  constructor({ documentRef, rootNode, windowTarget, perform, uiConfig, onReturn, fishView, feedPicker,
    resourceMeters, autoSwitchRenderer, hintRenderer, labels, navigation, roomView, aquariumLevelCard, liveBaitList, keepnetList }) {
    this.#window = windowTarget;
    this.#root = rootNode;
    this.#perform = perform;
    this.#uiConfig = uiConfig;
    this.#onReturn = onReturn;
    this.#fishView = fishView;
    this.#feedPicker = feedPicker;
    this.#resourceMeters = resourceMeters;
    this.#autoSwitchRenderer = autoSwitchRenderer;
    this.#labels = labels;
    this.#navigation = navigation;
    this.#roomView = roomView;
    this.#aquariumLevelCard = aquariumLevelCard;
    this.#liveBaitList = liveBaitList;
    this.#keepnetList = keepnetList;
    this.#hints = hintRenderer;
    for (const name of ["level", "capacity", "unowned", "owned", "upgrade-level", "upgrade-capacity",
      "auto-status", "bait-count", "keepnet-warning", "dead-count", "catch-count", "notice", "notice-text", "notice-close", "aquarium-image",
      "aquarium-level-count", "capacity-meter", "aquarium-stage", "feed-bar",
      "feed-image", "feed-meter", "feed-time", "auto-switch-mount"])
      this.#nodes.set(name, documentRef.querySelector(`[data-house-${name}]`));
    for (const action of documentRef.querySelectorAll("[data-house-action]"))
      this.#actions.set(action.dataset.houseAction, action);
    this.#autoSwitch = autoSwitchRenderer.create({ id: "house-auto-feeder", name: labels.autoFeeder,
      modeLabel: labels.enableFeeder, variant: "control", className: "house__auto-switch",
      onChange: () => this.#perform("toggleAutoFeeder") });
    this.#nodes.get("auto-switch-mount").appendChild(this.#autoSwitch);
    this.#notice = this.#nodes.get("notice");
    this.#noticeRoom = this.#notice.parentNode;
    hintRenderer.adopt(this.#notice, { text: this.#nodes.get("notice-text"), close: this.#nodes.get("notice-close"),
      onClose: () => this.#clearNoticeTimer() });
    this.#root.addEventListener("click", this.#handleClick);
  }

  dispose() {
    this.#navigation.dispose();
    this.#clearNoticeTimer();
    this.#hints.dispose(this.#notice);
    this.#root.removeEventListener("click", this.#handleClick);
    this.#autoSwitchRenderer.dispose(this.#autoSwitch);
    this.#autoSwitch.remove();
    this.#feedMeter?.remove();
    this.#feedMeter = null;
    this.#capacityMeter?.remove();
    this.#capacityMeter = null;
    this.#liveBaitList.dispose();
    this.#keepnetList.dispose();
  }

  // The notice appears inside its container (spec 080): the open sheet whose action it reports, otherwise the room.
  announce(message, failed = false) {
    const node = this.#notice;
    this.#clearNoticeTimer();
    if (!message) { this.#hints.hide(node); return; }
    const sheet = this.#navigation.activeSheetContent();
    const host = sheet || this.#noticeRoom;
    if (node.parentNode !== host) host.appendChild(node);
    node.classList.toggle("house__notice--sheet", sheet !== null);
    this.#hints.show(node, message, failed ? "error" : "info");
    this.#noticeTimer = this.#window.setTimeout(() => {
      this.#hints.hide(node);
      this.#noticeTimer = null;
    }, this.#uiConfig.noticeDurationMs);
  }

  #clearNoticeTimer() {
    if (this.#noticeTimer === null) return;
    this.#window.clearTimeout(this.#noticeTimer);
    this.#noticeTimer = null;
  }

  handleSceneGesture(deltaY) {
    this.#navigation.handleSceneGesture(deltaY);
  }

  setNavigationState(state) {
    this.#navigation.setNavigationState(state);
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
    this.#aquariumLevelCard.render(aquarium.level, aquarium.maxLevel, null, 0);
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
    get("bait-count").textContent = this.#labels.fishCount(model.liveBaits.length);
    get("catch-count").textContent = this.#labels.fishCount(model.keepnet.length);
    get("keepnet-warning").hidden = !model.liveBaits.some((fish) => fish.location === "keepnet");
    get("dead-count").hidden = model.deadCount === 0;
    get("dead-count").textContent = model.deadCount > 0 ? this.#labels.deadCount(model.deadCount) : "";
    this.#feedPicker.update(model);
    this.#actions.get("buyAutoFeeder").hidden = aquarium.autoFeeder.owned;
    get("auto-switch-mount").hidden = !aquarium.autoFeeder.owned;
    const hasFeedStock = Number(model.feedStock) > 0 && model.canAutoFeed !== false;
    this.#autoSwitchRenderer.update(this.#autoSwitch, { checked: aquarium.autoFeeder.enabled && hasFeedStock,
      disabled: !hasFeedStock || !aquarium.autoFeeder.owned,
      modeLabel: model.autoToggleLabel });
    this.#renderFeed(model);
    this.#liveBaitList.render(model.liveBaits);
    this.#keepnetList.render(model.keepnet);
    this.#navigation.setLocked(this.#roomView.render(model.room));
    if (model.error) this.announce(this.#labels.saveError(model.error), true);
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
        label: this.#labels.feedReading(feed.name, Math.round(percent), model.feedTimeLabel) };
      if (!this.#feedMeter) {
        this.#feedMeter = this.#resourceMeters.create(reading, { variant: "parameter", showIcon: false });
        this.#nodes.get("feed-meter").appendChild(this.#feedMeter);
      } else this.#resourceMeters.updateReading(this.#feedMeter, reading);
      this.#nodes.get("feed-time").textContent = model.feedTimeLabel;
    }
  }

  #handleClick = (event) => {
    if (this.#navigation.handleClick(event)) return;
    if (event.target.closest("[data-house-return]")) {
      event.preventDefault();
      this.#onReturn();
      return;
    }
    const action = event.target.closest("[data-house-action]");
    if (action) this.#perform(action.dataset.houseAction, action.dataset.houseFishId);
  };
}
