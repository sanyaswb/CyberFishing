import { backgroundTimeBlend } from "../../domain/time/background_time_blend.js";

export class HousePresenter {
  #liveBait;
  #view;
  #labels;
  #room;
  #gameTime;
  #getAvailableFunds;
  #blend = { evening: 0, night: 0 };

  constructor({ liveBait, room, gameTime, view, labels, getAvailableFunds = null }) {
    this.#liveBait = liveBait;
    this.#room = room;
    this.#gameTime = gameTime;
    this.#view = view;
    this.#labels = labels;
    this.#getAvailableFunds = getAvailableFunds;
  }

  refresh() {
    const state = this.#liveBait.getView();
    const labels = this.#labels;
    const aquarium = state.aquarium;
    const selectedFeed = state.feedItems.find((item) => item.id === state.selectedFeedId);
    const starvation = aquarium.starvation;
    const room = this.#room.getView();
    const upgradeLevel = aquarium.nextUpgradeCapacity ? aquarium.level + 1 : aquarium.level;
    const upgradeCapacity = aquarium.nextUpgradeCapacity ?? aquarium.capacity;
    backgroundTimeBlend(this.#gameTime.getHours(), this.#blend);
    this.#view.render({
      ...state,
      aquarium,
      levelLabel: aquarium.owned ? labels.level(aquarium.level) : labels.absent,
      upgradeLevel, upgradeCapacity, upgradeLabel: labels.upgrade(upgradeLevel, upgradeCapacity),
      upgradeAffordable: this.#isAffordable(state.prices?.upgrade),
      capacityLabel: labels.capacity(aquarium.count, aquarium.capacity),
      feedCountdownLabel: aquarium.feed ? labels.duration(aquarium.feed.remainingMs) : "",
      feedTimeLabel: starvation ? labels.starvationWindow(labels.duration(starvation.remainingMs), labels.duration(starvation.nextDeathMs))
        : aquarium.feed ? labels.feedLeft(labels.duration(aquarium.feed.remainingMs)) : labels.noFood,
      canAutoFeed: selectedFeed?.count > 0,
      autoStatus: !aquarium.autoFeeder.owned ? labels.manual : !aquarium.autoFeeder.enabled
        ? labels.automaticPaused : selectedFeed?.count > 0 ? labels.automatic : labels.automaticEmpty,
      autoToggleLabel: aquarium.autoFeeder.enabled ? labels.disableFeeder : labels.enableFeeder,
      liveBaits: state.liveBaits.map((fish) => ({
        ...fish,
        weightLabel: labels.weight(fish.weightKg),
        locationLabel: labels[fish.location],
        timerLabel: fish.remainingMs === null ? labels.fed : labels.dying(labels.duration(fish.remainingMs)),
        actionLabel: fish.selected ? labels.deselect : labels.select,
        canTransfer: fish.location === "keepnet" && aquarium.owned && aquarium.count < aquarium.capacity,
      })),
      keepnet: state.keepnet.map((fish) => ({ ...fish, weightLabel: labels.weight(fish.weightKg) })),
      room: { ...room, eveningOpacity: this.#blend.evening, nightOpacity: this.#blend.night },
    });
  }

  #isAffordable(price) {
    const cost = Number(price) || 0;
    if (cost <= 0) return true;
    const funds = this.#getAvailableFunds?.();
    return Number.isFinite(funds) && funds >= cost;
  }

  perform(action, id, quantity = 1) {
    const service = this.#liveBait;
    let result;
    switch (action) {
      case "upgradeRoom": result = this.#room.start(); break;
      case "finishRoom": result = this.#room.finish(); break;
      case "buyAquarium": result = service.buyAquarium(); break;
      case "upgrade": result = service.upgradeAquarium(); break;
      case "feed": result = service.feedAquarium(id, quantity); break;
      case "buyAutoFeeder": result = service.buyAutoFeeder(); break;
      case "toggleAutoFeeder": result = service.setAutoFeeder(!service.getView().aquarium.autoFeeder.enabled); break;
      case "select": result = service.selectBait(id); break;
      case "deselect": result = service.selectBait(null); break;
      case "transfer": result = service.transferToAquarium(id); break;
      case "release": result = service.releaseCatch(id); break;
      case "releaseBait": result = service.releaseBait(id); break;
      default: return;
    }
    this.refresh();
    const message = result?.ok ? this.#labels.success[action]
      : this.#labels.errors[result?.reason] || this.#labels.errors.failed;
    this.#view.announce(message, result?.ok !== true);
    return result;
  }
}
