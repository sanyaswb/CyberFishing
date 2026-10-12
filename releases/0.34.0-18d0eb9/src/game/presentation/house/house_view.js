export class HouseView {
  #document;
  #window;
  #root;
  #nodes = new Map();
  #perform;
  #roomConfig;
  #uiConfig;
  #aquariumCapacities;
  #toggleFullscreen;
  #fullscreenDocument;
  #onReturn;
  #lastLevel = null;
  #levelCardKeys = new Map();
  #rooms;
  #roomIndex = 0;
  #activePanel = null;
  #lastScrollY = 0;
  #lastTouchY = 0;
  #noticeTimer = null;
  #fishView;
  #feedChoice;
  #feedChoiceKey = "";

  constructor({ documentRef, windowTarget, perform, roomConfig, uiConfig, aquariumCapacities,
    returnTo, toggleFullscreen, fullscreenDocument, onReturn, fishView }) {
    this.#document = documentRef;
    this.#window = windowTarget;
    this.#root = documentRef.body;
    this.#perform = perform;
    this.#roomConfig = roomConfig;
    this.#uiConfig = uiConfig;
    this.#aquariumCapacities = aquariumCapacities;
    this.#toggleFullscreen = toggleFullscreen;
    this.#fullscreenDocument = fullscreenDocument;
    this.#onReturn = onReturn;
    this.#fishView = fishView;
    this.#feedChoice = documentRef.querySelector("[data-house-feed-choice]");
    this.#feedChoice.addEventListener("change", this.#selectFeed);
    for (const name of ["level", "capacity", "unowned", "owned", "slot-count", "feed-slots",
      "next-feed", "feed-stock", "auto-status", "bait-count", "live-baits", "keepnet-warning",
      "dead-count", "catch-count", "catches", "notice", "aquarium-image", "room-track",
      "room-count", "room-prev", "room-next", "room-navigation", "header", "dock", "scrim", "fullscreen",
      "room-level-panel", "room-max-level", "room-next-level", "room-duration",
      "room-segments", "room-level-list", "aquarium-segments", "aquarium-level-list",
      "renovation", "renovation-level", "renovation-time", "aquarium-stage", "feed-bar",
      "feed-image", "feed-track", "feed-fill", "feed-time"])
      this.#nodes.set(name, documentRef.querySelector(`[data-house-${name}]`));
    this.#rooms = [...documentRef.querySelectorAll("[data-house-room]")];
    documentRef.querySelector("[data-house-return]").href = returnTo;
    this.#syncFullscreen();
    this.#nodes.get("room-navigation").hidden = this.#rooms.length < 2;
    this.#setHeaderVisible(false);
    this.#roomConfig && (this.#nodes.get("aquarium-image").src = this.#roomConfig.aquariumImage);
    this.#root.addEventListener("click", this.#handleClick);
    this.#root.addEventListener("wheel", this.#handleWheel, { passive: true });
    this.#root.addEventListener("touchstart", this.#handleTouchStart, { passive: true });
    this.#root.addEventListener("touchmove", this.#handleTouchMove, { passive: true });
    this.#window.addEventListener("scroll", this.#handleScroll, { passive: true });
    this.#fullscreenDocument.addEventListener("fullscreenchange", this.#syncFullscreen);
    this.#nodes.get("room-track")?.addEventListener("keydown", this.#handleRoomKey);
    this.#showRoom(0);
  }

  dispose() {
    this.#feedChoice.removeEventListener("change", this.#selectFeed);
    if (this.#noticeTimer !== null) this.#window.clearTimeout(this.#noticeTimer);
    this.#root.removeEventListener("click", this.#handleClick);
    this.#root.removeEventListener("wheel", this.#handleWheel);
    this.#root.removeEventListener("touchstart", this.#handleTouchStart);
    this.#root.removeEventListener("touchmove", this.#handleTouchMove);
    this.#window.removeEventListener("scroll", this.#handleScroll);
    this.#fullscreenDocument.removeEventListener("fullscreenchange", this.#syncFullscreen);
    this.#nodes.get("room-track")?.removeEventListener("keydown", this.#handleRoomKey);
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
    get("level").textContent = model.levelLabel;
    get("capacity").textContent = `${aquarium.count} / ${aquarium.capacity}`;
    this.#renderLevelCard("aquarium", aquarium.level, aquarium.maxLevel, null, 0,
      (level) => ({ bonus: `+${this.#aquariumCapacities[level - 1] - (this.#aquariumCapacities[level - 2] || 0)} до місткості живця`,
        detail: `Місткість ${this.#aquariumCapacities[level - 1]}` }));
    get("unowned").hidden = aquarium.owned;
    get("owned").hidden = !aquarium.owned;
    get("aquarium-image").hidden = !aquarium.owned;
    get("aquarium-stage").hidden = !aquarium.owned;
    this.#fishView.show(model.liveBaits.filter((fish) => fish.location === "aquarium"), aquarium.owned);
    const upgrade = this.#document.querySelector('[data-house-action="upgrade"]');
    upgrade.hidden = !aquarium.owned;
    upgrade.disabled = aquarium.level >= aquarium.maxLevel;
    upgrade.textContent = model.upgradeLabel;
    get("slot-count").textContent = aquarium.feed?.name || "";
    get("feed-stock").textContent = String(model.feedStock);
    get("next-feed").textContent = model.nextFeedLabel;
    get("auto-status").textContent = model.autoStatus;
    get("bait-count").textContent = `${model.liveBaits.length} риб`;
    get("catch-count").textContent = `${model.keepnet.length} риб`;
    get("keepnet-warning").hidden = !model.liveBaits.some((fish) => fish.location === "keepnet");
    get("dead-count").hidden = model.deadCount === 0;
    get("dead-count").textContent = model.deadCount > 0 ? `Живців втрачено: ${model.deadCount}` : "";
    this.#document.querySelector('[data-house-action="feed"]').disabled = !model.canFeed;
    this.#document.querySelector('[data-house-action="buyAutoFeeder"]').hidden = aquarium.autoFeeder.owned;
    const toggle = this.#document.querySelector('[data-house-action="toggleAutoFeeder"]');
    toggle.hidden = !aquarium.autoFeeder.owned;
    toggle.textContent = model.autoToggleLabel;
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
        this.#document.querySelector(`[data-house-background="${phase}"]`).src = art[phase];
      this.#lastLevel = room.level;
    }
    const scene = this.#document.querySelector(".house__scene");
    scene.style.setProperty("--house-evening", room.eveningOpacity);
    scene.style.setProperty("--house-night", room.nightOpacity);
    get("room-level-panel").textContent = String(room.level);
    get("room-max-level").textContent = String(room.maxLevel);
    get("room-next-level").textContent = room.nextDurationMs === null
      ? "Максимальний рівень" : `Наступний рівень: ${room.level + 1}`;
    get("room-duration").textContent = room.nextDurationMs === null
      ? "" : `${room.nextDurationMs / 3600000} год`;
    const progress = room.targetLevel === null || room.nextDurationMs === null ? 0
      : Math.max(0, Math.min(1, 1 - room.remainingMs / room.nextDurationMs));
    this.#renderLevelCard("room", room.level, room.maxLevel, room.targetLevel, progress,
      (level) => ({ bonus: "+ нове оформлення кімнати", detail: `${this.#roomConfig.upgradeDurationMs[level] / 3600000} год · 3 фони` }));
    this.#document.querySelector('[data-house-action="upgradeRoom"]').disabled =
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
        const bar = this.#el("span", "inventory-parameter__segment");
        if (index <= level) bar.classList.add("inventory-parameter__segment--filled");
        if (index === targetLevel) bar.classList.add("house__level-segment--pending");
        bars.push(bar);
      }
      segments.replaceChildren(...bars);
      const nextLevel = level < maxLevel ? level + 1 : null;
      list.hidden = nextLevel === null;
      if (nextLevel === null) list.replaceChildren();
      else {
        const benefit = describe(nextLevel);
        const row = this.#el("li", "house__level-step");
        if (nextLevel === targetLevel) row.classList.add("house__level-step--pending");
        row.append(this.#el("span", "", `Рівень ${nextLevel}`),
          this.#el("strong", "", benefit.bonus), this.#el("small", "", benefit.detail));
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
      this.#nodes.get("feed-fill").style.setProperty("--house-feed", `${feed.percentage}%`);
      this.#nodes.get("feed-track").setAttribute("aria-valuenow", String(Math.round(feed.percentage)));
      this.#nodes.get("feed-time").textContent = model.feedTimeLabel;
    }
    const key = JSON.stringify(model.feedItems.map((item) => [item.id, item.count]));
    if (key !== this.#feedChoiceKey) {
      this.#feedChoice.replaceChildren(...model.feedItems.map((item) => {
        const option = this.#el("option", "", `${item.name} · ${item.durationMs / 60000} хв · запас ${item.count}`);
        option.value = item.id; return option;
      }));
      this.#feedChoiceKey = key;
    }
    this.#feedChoice.value = model.selectedFeedId;
  }
  #selectFeed = () => this.#perform("selectFeed", this.#feedChoice.value);

  #renderFish(container, fish, live) {
    const rows = fish.map((entry) => {
      const row = this.#el("article", "house__fish");
      row.append(this.#el("strong", "house__fish-name", entry.name));
      row.append(this.#el("span", "house__muted", `${entry.weightLabel} · ${live ? entry.locationLabel : "Садок"}`));
      if (live) {
        row.append(this.#el("span", "house__fish-timer", entry.timerLabel));
        row.append(this.#button(entry.selected ? "deselect" : "select", entry.actionLabel, entry.id));
        if (entry.canTransfer) row.append(this.#button("transfer", "До акваріума", entry.id));
        if (entry.location !== "hook") row.append(this.#button("releaseBait", "Випустити", entry.id));
      } else row.append(this.#button("release", "Випустити", entry.id));
      return row;
    });
    container.replaceChildren(...(rows.length ? rows : [this.#el("p", "house__muted", live ? "Живця немає." : "Садок порожній.")]));
  }

  #button(action, label, id) {
    const button = this.#el("button", "house__fish-action", label);
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
    if (event.target.closest("[data-house-return]") && this.#onReturn) {
      event.preventDefault();
      this.#onReturn();
      return;
    }
    if (event.target.closest("[data-house-fullscreen]")) {
      void this.#toggleFullscreenMode();
      return;
    }
    const action = event.target.closest("[data-house-action]");
    if (action) { this.#perform(action.dataset.houseAction, action.dataset.houseFishId); return; }
    const panelButton = event.target.closest("[data-house-panel-button]");
    if (panelButton) {
      const name = panelButton.dataset.housePanelButton;
      this.#setPanel(this.#activePanel === name ? null : name);
      return;
    }
    if (event.target.closest("[data-house-panel-close]") || event.target.closest("[data-house-scrim]")) {
      this.#setPanel(null);
      return;
    }
    if (event.target.closest("[data-house-room-prev]")) this.#showRoom(this.#roomIndex - 1);
    if (event.target.closest("[data-house-room-next]")) this.#showRoom(this.#roomIndex + 1);
  };

  async #toggleFullscreenMode() {
    try {
      await this.#toggleFullscreen();
    } catch {
      this.announce("Не вдалося ввімкнути повноекранний режим.", true);
    }
  }

  #syncFullscreen = () => {
    const button = this.#nodes.get("fullscreen");
    const active = Boolean(this.#fullscreenDocument.fullscreenElement);
    button.textContent = active ? "🗗" : "⛶";
    button.setAttribute("aria-label", active ? "Вийти з повного екрана" : "На весь екран");
    button.title = active ? "Вийти з повного екрана" : "На весь екран";
  };

  #setPanel(name) {
    this.#activePanel = name;
    for (const panel of this.#document.querySelectorAll("[data-house-panel]"))
      panel.hidden = panel.dataset.housePanel !== name;
    for (const button of this.#document.querySelectorAll("[data-house-panel-button]"))
      button.setAttribute("aria-expanded", String(button.dataset.housePanelButton === name));
    this.#nodes.get("scrim").hidden = name === null;
  }

  #handleWheel = (event) => { if (Math.abs(event.deltaY) > 2) this.#setHeaderVisible(event.deltaY > 0); };
  #handleTouchStart = (event) => { this.#lastTouchY = event.touches[0]?.clientY ?? 0; };
  #handleTouchMove = (event) => {
    const y = event.touches[0]?.clientY ?? this.#lastTouchY;
    if (Math.abs(y - this.#lastTouchY) > 5) this.#setHeaderVisible(y > this.#lastTouchY);
    this.#lastTouchY = y;
  };
  #handleScroll = () => {
    const y = this.#window.scrollY;
    if (Math.abs(y - this.#lastScrollY) > 2) this.#setHeaderVisible(y > this.#lastScrollY);
    this.#lastScrollY = y;
  };
  #setHeaderVisible(visible) {
    const header = this.#nodes.get("header");
    header.classList.toggle("house__header--visible", visible);
    this.#nodes.get("dock").classList.toggle("house__dock--visible", visible);
    header.inert = !visible;
    header.setAttribute("aria-hidden", String(!visible));
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
    this.#nodes.get("room-track").scrollTo({ left: room.offsetLeft, behavior: "smooth" });
    this.#nodes.get("room-count").textContent = `${this.#roomIndex + 1} / ${this.#rooms.length}`;
    this.#nodes.get("room-prev").disabled = this.#roomIndex === 0;
    this.#nodes.get("room-next").disabled = this.#roomIndex === this.#rooms.length - 1;
  }
}
