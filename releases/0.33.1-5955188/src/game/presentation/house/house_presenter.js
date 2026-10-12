import { backgroundTimeBlend } from "../../domain/time/background_time_blend.js";

export class HousePresenter {
  #liveBait;
  #view;
  #labels;
  #now;
  #room;
  #gameTime;
  #blend = { evening: 0, night: 0 };

  constructor({ liveBait, room, gameTime, view, labels, now }) {
    this.#liveBait = liveBait;
    this.#room = room;
    this.#gameTime = gameTime;
    this.#view = view;
    this.#labels = labels;
    this.#now = now;
  }

  refresh() {
    const state = this.#liveBait.getView();
    const labels = this.#labels;
    const aquarium = state.aquarium;
    const now = this.#now();
    const slots = aquarium.slots.map((slot) => ({
      ...slot,
      percentage: Math.max(0, Math.min(100, slot.foodPercent)),
      status: slot.starving
        ? slot.nextDeathAt === null ? labels.noFood : labels.starvation(labels.duration(slot.nextDeathAt - now))
        : labels.feedLeft(labels.duration(slot.remainingFeedMs)),
    }));
    const priority = slots.find((slot) => slot.sourceSpeciesId === state.nextFeedSpeciesId);
    const room = this.#room.getView();
    backgroundTimeBlend(this.#gameTime.getHours(), this.#blend);
    this.#view.render({
      ...state,
      aquarium: { ...aquarium, slots },
      levelLabel: aquarium.owned ? labels.level(aquarium.level) : labels.absent,
      upgradeLabel: aquarium.nextUpgradeCapacity ? labels.upgrade(aquarium.nextUpgradeCapacity) : labels.maxLevel,
      nextFeedLabel: priority ? labels.feedNext(priority.name) : slots.length ? labels.allFed : "",
      canFeed: aquarium.owned && !!priority && state.feedStock > 0,
      autoStatus: !aquarium.autoFeeder.owned ? labels.manual : !aquarium.autoFeeder.enabled
        ? labels.automaticPaused : state.feedStock > 0 ? labels.automatic : labels.automaticEmpty,
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

  perform(action, id) {
    const service = this.#liveBait;
    let result;
    switch (action) {
      case "upgradeRoom": result = this.#room.start(); break;
      case "finishRoom": result = this.#room.finish(); break;
      case "buyAquarium": result = service.buyAquarium(); break;
      case "upgrade": result = service.upgradeAquarium(); break;
      case "buyFeed": result = service.buyFeed(); break;
      case "feed": result = service.feedAquarium(); break;
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
  }
}
