export class KeepnetCardRenderer {
  #document;
  #labels;
  constructor({ documentRef, labels }) { this.#document = documentRef; this.#labels = labels; }

  group(group, onOpen) {
    const card = this.#button("keepnet-modal__group", "", `species:${group.id}`, () => onOpen(group.id));
    card.setAttribute("aria-label", this.#labels.details(group.name, group.count));
    const badge = this.#el("span", "keepnet-modal__badge", String(group.count));
    badge.setAttribute("aria-label", this.#labels.groupCount(group.count));
    card.append(this.#image(group), this.#el("strong", "keepnet-modal__fish-name", group.name),
      this.#el("span", "keepnet-modal__fish-weight", this.#labels.totalWeight(group.totalWeightKg)), badge);
    return { element: card, focusables: [card] };
  }

  fish(fish, { aquarium, pendingRelease, onAction }) {
    const card = this.#el("article", "keepnet-modal__fish");
    const labels = this.#labels;
    card.append(this.#image(fish), this.#el("strong", "keepnet-modal__fish-name", fish.name),
      this.#el("span", "keepnet-modal__fish-weight", labels.weight(fish.weightKg)),
      this.#el("span", "keepnet-modal__fish-rarity", fish.rarity ? labels.rarity(fish.rarity) : labels.unknownRarity),
      this.#el("span", "keepnet-modal__fish-level", labels.level(fish.level)));
    const timer = this.#el("span", "keepnet-modal__fish-timer");
    card.append(timer);
    const actions = this.#el("div", "keepnet-modal__actions");
    const focusables = [];
    const action = (id, text) => {
      const button = this.#button("keepnet-modal__action", text, `${fish.id}:${id}`, () => onAction(fish, id));
      actions.append(button); focusables.push(button);
    };
    if (pendingRelease === fish.id) {
      action("confirm-release", labels.confirmRelease); action("cancel-release", labels.cancel);
    } else {
      if (fish.kind === "catch" && fish.canConvert) action("convert", labels.convert);
      if (fish.kind === "live_bait") {
        action(fish.selected ? "deselect" : "select", fish.selected ? labels.deselect : labels.select);
        if (aquarium?.owned) action("transfer", labels.transfer);
      }
      action("release", labels.release);
    }
    card.append(actions);
    const update = (current) => {
      timer.textContent = current.kind === "catch" ? labels.catch :
        `${current.remainingMs === null ? labels.protected : labels.lifetime(current.remainingMs)}${current.selected ? " · ✓" : ""}`;
    };
    update(fish);
    return { element: card, focusables, update };
  }

  #image(fish) {
    const media = this.#el("div", "keepnet-modal__thumbnail");
    const fallback = this.#el("span", "keepnet-modal__image-fallback", "🐟");
    fallback.setAttribute("aria-hidden", "true");
    media.append(fallback);
    if (fish.imagePath) {
      const image = this.#el("img", "keepnet-modal__image");
      image.alt = fish.name; image.loading = "lazy"; image.decoding = "async";
      fallback.hidden = true;
      image.addEventListener("error", () => { image.hidden = true; fallback.hidden = false; }, { once: true });
      image.src = fish.imagePath;
      media.append(image);
    }
    return media;
  }
  #button(className, text, key, handler) {
    const button = this.#el("button", className, text);
    button.type = "button"; button.dataset.keepnetFocus = key;
    button.addEventListener("click", handler);
    return button;
  }
  #el(tag, className, text = null) {
    const el = this.#document.createElement(tag);
    el.className = className;
    if (text !== null) el.textContent = text;
    return el;
  }
}
