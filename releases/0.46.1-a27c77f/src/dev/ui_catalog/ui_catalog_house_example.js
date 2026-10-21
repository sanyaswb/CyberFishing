import { HOUSE_LABELS } from "../../game/presentation/house/house_labels.js";
import { backgroundTimeBlend } from "../../game/domain/time/background_time_blend.js";

export class UiCatalogHouseExample {
  #view;
  #fishView;
  #feedPicker;
  #scheduler;
  #scope;
  #roomConfig;
  #status;
  #timeDisplay;
  #fullscreenControl;
  #sceneDetachers;
  #headerSizer;
  #model;
  #sheetHeights;
  #capacities;
  #feedCalculator;
  #feedCatalog;
  #value = 67;
  #gameTime;
  #phaseControl;
  #blend = { evening: 0, night: 0 };
  constructor({ view, fishView, feedPicker, frameScheduler, documentScope, roomConfig, timeDisplay, status,
    fullscreenControl = null, sceneDetachers = [], headerSizer = null, sheetHeights = null, aquariumCapacities, feedCalculator, feedCatalog,
    gameTime = null, phaseControl = null }) {
    this.#view = view; this.#fishView = fishView; this.#feedPicker = feedPicker;
    this.#scheduler = frameScheduler; this.#scope = documentScope; this.#roomConfig = roomConfig; this.#status = status;
    this.#timeDisplay = timeDisplay;
    this.#fullscreenControl = fullscreenControl;
    this.#sceneDetachers = sceneDetachers;
    this.#headerSizer = headerSizer;
    this.#sheetHeights = sheetHeights; this.#capacities = aquariumCapacities;
    this.#feedCalculator = feedCalculator; this.#feedCatalog = feedCatalog;
    this.#gameTime = gameTime; this.#phaseControl = phaseControl;
  }
  setState(state) {
    const owned = state !== "unowned";
    const empty = state === "empty" || !owned;
    let liveBaits = empty ? [] : [{ id: "catalog-aquarium-fish", name: state === "long" ? "Карась із дуже довгою назвою контрольного виду риби" : "Карась", imagePath: "assets/fish/crucian_stalker/unique/crucian_stalker--1-uniq.webp",
      weightKg: .1, weightLabel: "100 г", location: "aquarium", locationLabel: "Акваріум", timerLabel: "Під захистом", actionLabel: "Вибрати", selected: false, canTransfer: false }];
    if (state === "full") liveBaits = Array.from({ length: this.#capacities[0] }, (_, index) => ({ ...liveBaits[0], id: `catalog-aquarium-fish-${index}` }));
    const reserve = state === "no-feed" ? 0 : 12;
    const items = [Object.values(this.#feedCatalog)[0], Object.values(this.#feedCatalog).find(item => item.quality === "premium")];
    const feed = empty ? null : this.#feedCalculator.load(null, items[0].id, liveBaits.length, 1, 0);
    if (feed) feed.remainingMs = feed.durationMs * (state === "feed-ready" ? 50 : this.#value) / 100;
    this.#model = {
      aquarium: { owned, level: owned ? 1 : 0, maxLevel: this.#capacities.length, capacity: owned ? this.#capacities[0] : 0, count: liveBaits.length,
        feed,
        autoFeeder: { owned: true, enabled: true } },
      liveBaits, keepnet: [], feedItems: items.map((item, index) => ({ ...item, count: reserve ? index ? 5 : reserve : 0,
        name: state === "long" ? "Демонстраційна прикормка з дуже довгою назвою" : item.name })), selectedFeedId: items[0].id,
      feedStock: reserve, deadCount: 0, levelLabel: owned ? HOUSE_LABELS.level(1) : HOUSE_LABELS.absent,
      canAutoFeed: reserve > 0,
      upgradeLevel: 2, upgradeCapacity: this.#capacities[1],
      upgradeLabel: HOUSE_LABELS.upgrade(2, this.#capacities[1]), upgradeAffordable: state !== "unaffordable",
      capacityLabel: HOUSE_LABELS.capacity(liveBaits.length, owned ? this.#capacities[0] : 0),
      autoStatus: "Автоматично", autoToggleLabel: "Вимкнути",
      room: { level: 1, maxLevel: 5, nextDurationMs: this.#roomConfig.upgradeDurationMs[2], targetLevel: state === "renovating" ? 2 : null,
        remainingMs: this.#roomConfig.upgradeDurationMs[2] / 2, eveningOpacity: state === "evening" ? .5 : state === "night" ? 1 : 0, nightOpacity: state === "night" ? 1 : 0 },
      error: state === "error" ? "контрольна помилка" : null,
    };
    const hours = state === "evening" ? 19 : state === "night" ? 0 : 12;
    this.#gameTime?.setHours(hours);
    this.#timeDisplay.update(hours);
    this.#render();
    this.#view.setNavigationState({ expanded: state === "menu-expanded", panel: state === "section-open" ? "aquarium" : null });
    if (state !== "error") this.#view.announce(state === "long"
      ? "Довге повідомлення: прокрутіть текст, а з його початку потягніть униз для закриття. ".repeat(30)
      : "Коротке повідомлення знизу. Потягніть униз або натисніть ручку.");
    this.#status.textContent = "Угору — назви всіх трьох кнопок. Натискання відкриває розділ; мініатюри перемикають плашки. Свайп униз по фону або верхня ручка вниз — закриття. Hover діє лише на desktop.";
  }
  setValue(value) {
    this.#value = Math.max(0, Math.min(100, Number(value) || 0));
    if (this.#model.aquarium.feed) this.#model.aquarium.feed.remainingMs = this.#model.aquarium.feed.durationMs * this.#value / 100;
    this.#render();
  }
  advanceTime() {
    if (!this.#gameTime || !this.#phaseControl) return;
    this.#phaseControl.advance();
    const hours = this.#gameTime.getHours();
    backgroundTimeBlend(hours, this.#blend);
    this.#model.room.eveningOpacity = this.#blend.evening;
    this.#model.room.nightOpacity = this.#blend.night;
    this.#timeDisplay.update(hours);
    this.#render();
  }
  perform(action, id, quantity = 1) {
    if (action === "feed") {
      const item = this.#model.feedItems.find((entry) => entry.id === id);
      if (!item || quantity > item.count) return { ok: false, reason: "not_found" };
      if (!this.#feedCalculator.canLoad(this.#model.aquarium.feed)) return { ok: false, reason: "feed_locked" };
      item.count -= quantity; this.#model.selectedFeedId = item.id;
      this.#model.aquarium.feed = this.#feedCalculator.load(this.#model.aquarium.feed, item.id, this.#model.aquarium.count, quantity, 0);
      this.#render();
    }
    this.#view.announce(`Демонстраційна дія: ${action}`, false);
    this.#scheduler.flush();
    return { ok: true };
  }
  #render() {
    const feed = this.#model.aquarium.feed;
    if (feed) this.#model.aquarium.feed = { ...this.#model.feedItems.find(item => item.id === feed.itemId), ...feed,
      percentage: feed.remainingMs / feed.durationMs * 100 };
    this.#model.aquarium.canLoadFeed = this.#feedCalculator.canLoad(feed);
    this.#model.feedStock = this.#model.feedItems.reduce((sum, item) => sum + item.count, 0);
    this.#model.canAutoFeed = this.#model.feedItems.some(item => item.id === this.#model.selectedFeedId && item.count > 0);
    this.#model.feedTimeLabel = feed ? HOUSE_LABELS.feedLeft(HOUSE_LABELS.duration(feed.remainingMs)) : HOUSE_LABELS.noFood;
    this.#model.feedCountdownLabel = feed ? HOUSE_LABELS.duration(feed.remainingMs) : "";
    this.#view.render(this.#model); this.#scheduler.flush();
  }
  resize() { this.#scheduler.flush(); }
  dispose() {
    for (const detach of this.#sceneDetachers) detach();
    this.#sceneDetachers = [];
    this.#fullscreenControl?.dispose();
    this.#headerSizer?.dispose();
    this.#feedPicker.dispose(); this.#fishView.dispose(); this.#view.dispose(); this.#sheetHeights?.dispose(); this.#timeDisplay.dispose();
    this.#scheduler.dispose(); this.#scope.dispose(); this.#scope.body.remove();
  }
}
