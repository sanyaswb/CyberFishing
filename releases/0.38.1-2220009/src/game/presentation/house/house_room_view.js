import { timeOfDayLayers } from "../time/time_of_day_layers.js";

const TIME_PHASES = Object.freeze(["day", "evening", "night"]);

// Room art (level backgrounds and time of day), the room level card and renovation status.
export class HouseRoomView {
  #roomConfig;
  #labels;
  #levelCard;
  #nodes = new Map();
  #backgrounds = new Map();
  #scene;
  #upgradeAction;
  #lastLevel = null;
  #timeLayers = { base: "day", overlay: null, overlayOpacity: 0 };
  #phaseOpacities = new Map();
  #timeBlendEnabled = false;

  constructor({ documentRef, roomConfig, labels, levelCard, timeBlendMs }) {
    this.#roomConfig = roomConfig;
    this.#labels = labels;
    this.#levelCard = levelCard;
    for (const name of ["room-level-panel", "room-max-level", "room-level-count", "room-next-level", "room-duration",
      "renovation", "renovation-level", "renovation-time"])
      this.#nodes.set(name, documentRef.querySelector(`[data-house-${name}]`));
    for (const phase of TIME_PHASES)
      this.#backgrounds.set(phase, documentRef.querySelector(`[data-house-background="${phase}"]`));
    this.#upgradeAction = documentRef.querySelector("[data-house-action=\"upgradeRoom\"]");
    this.#scene = documentRef.querySelector(".house__scene");
    // Opacity eases linearly across one refresh interval, so the stepped clock reads as a continuous blend.
    this.#scene.style.setProperty("--house-time-blend-duration", `${timeBlendMs}ms`);
    documentRef.querySelector("[data-house-aquarium-image]").src = roomConfig.aquariumImage;
  }

  // Returns whether the room is under renovation.
  render(room) {
    const get = (key) => this.#nodes.get(key);
    if (room.level !== this.#lastLevel) {
      const art = this.#roomConfig.backgrounds[room.level];
      for (const phase of TIME_PHASES)
        this.#backgrounds.get(phase).src = art[phase];
      this.#lastLevel = room.level;
    }
    this.#renderTimeOfDay(room.eveningOpacity, room.nightOpacity);
    get("room-level-panel").textContent = String(room.level);
    get("room-max-level").textContent = String(room.maxLevel);
    get("room-level-count").textContent = `${room.level} / ${room.maxLevel}`;
    get("room-next-level").textContent = room.nextDurationMs === null
      ? this.#labels.maxLevel : this.#labels.nextLevel(room.level + 1);
    get("room-duration").textContent = room.nextDurationMs === null
      ? "" : this.#labels.hours(room.nextDurationMs);
    const progress = room.targetLevel === null || room.nextDurationMs === null ? 0
      : Math.max(0, Math.min(1, 1 - room.remainingMs / room.nextDurationMs));
    this.#levelCard.render(room.level, room.maxLevel, room.targetLevel, progress,
      (level) => ({ bonus: this.#labels.roomBenefit, detail: this.#labels.roomBenefitDetail(this.#roomConfig.upgradeDurationMs[level]) }));
    this.#upgradeAction.disabled = room.nextDurationMs === null || room.targetLevel !== null;
    const renovating = room.targetLevel !== null;
    get("renovation").hidden = !renovating;
    if (renovating) {
      get("renovation-level").textContent = this.#labels.renovationLevel(room.targetLevel);
      get("renovation-time").textContent = this.#formatCountdown(room.remainingMs);
    }
    return renovating;
  }

  #renderTimeOfDay(eveningOpacity, nightOpacity) {
    const scene = this.#scene;
    // The first reading appears at once; later readings blend from the previous one.
    if (!this.#timeBlendEnabled && this.#phaseOpacities.size > 0) {
      scene.classList.add("house__scene--time-blend");
      this.#timeBlendEnabled = true;
    }
    const layers = timeOfDayLayers(eveningOpacity, nightOpacity, this.#timeLayers);
    for (const phase of TIME_PHASES) {
      const opacity = phase === layers.base ? 1 : phase === layers.overlay ? layers.overlayOpacity : 0;
      if (this.#phaseOpacities.get(phase) === opacity) continue;
      this.#phaseOpacities.set(phase, opacity);
      scene.style.setProperty(`--house-${phase}`, String(opacity));
    }
  }

  #formatCountdown(ms) {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
}
