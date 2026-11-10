import { BalanceControlPanel } from "./balance_control_panel.js";

const SECTIONS_STORAGE_KEY = "overlay_balance_sections";
const LIVE_UPDATE_EVENT = "debug-live-update";

// The overlay windows «🐟 ACTIVE FISH» and «🎣 ACTIVE ROD» (spec 168): each shows while its overlay switch
// (settingsStore keys activeFish / activeRod) is on, refreshed every intervalMs from the latest `debug-live-update`;
// isLiveDataRequested() is true while either is on, so the game sends that data (R17). Section states are remembered.
export class FightBalanceWindows {
  #documentTarget;
  #settingsStore;
  #cache;
  #updateLoop;
  #entries;
  #liveData = null;
  #started = false;
  #sectionStates;
  #onLiveUpdate = (event) => { this.#liveData = event.detail ?? null; };

  // windows: [{ key, window: OverlayToolWindow, content: { build(liveData), change(path, value), action(id) } }];
  // createUpdateLoop(callback): { start(), stop() } (OverlayUpdateLoop, the main overlay's cadence); cache: LocalStorageCache.
  constructor({ documentTarget, createUpdateLoop, settingsStore, cache, windows }) {
    this.#documentTarget = documentTarget;
    this.#settingsStore = settingsStore;
    this.#cache = cache;
    this.#updateLoop = createUpdateLoop(() => this.update());
    this.#sectionStates = { ...(cache.get(SECTIONS_STORAGE_KEY) ?? {}) };
    const sectionState = {
      isOpen: (id) => this.#sectionStates[id] === true,
      setOpen: (id, open) => {
        this.#sectionStates[id] = open === true;
        this.#cache.set(SECTIONS_STORAGE_KEY, this.#sectionStates);
      },
    };
    this.#entries = windows.map((entry) => ({ ...entry, panel: new BalanceControlPanel({ documentTarget, sectionState,
      onChange: (path, value) => entry.content.change(path, value),
      onAction: (id) => { entry.content.action(id); this.update(); } }) }));
  }

  start() {
    if (this.#started) return;
    this.#started = true;
    this.#documentTarget.addEventListener(LIVE_UPDATE_EVENT, this.#onLiveUpdate);
    this.#updateLoop.start();
    this.update();
  }

  isLiveDataRequested() {
    return this.#entries.some((entry) => this.#settingsStore.isEnabled(entry.key));
  }

  update() {
    for (const entry of this.#entries) {
      if (!this.#settingsStore.isEnabled(entry.key)) {
        entry.window.hide();
        continue;
      }
      entry.panel.render(entry.content.build(this.#liveData), entry.window.body);
      entry.window.show();
    }
  }

  dispose() {
    this.#updateLoop.stop();
    this.#started = false;
    this.#documentTarget.removeEventListener(LIVE_UPDATE_EVENT, this.#onLiveUpdate);
    for (const entry of this.#entries) {
      entry.panel.dispose();
      entry.window.dispose();
    }
  }
}
