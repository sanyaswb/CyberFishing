import { createItemPlaceholderIcon } from "../inventory/inventory_icons.js";
import { applyArtSize } from "../ui/art_size.js";
import { RarityStarsRenderer } from "../ui/rarity_stars_renderer.js";

export class KeepnetCardRenderer {
  #document;
  #labels;
  #fishArt;
  #dom;
  #stars;
  // fishArt: FishArtVariants (a caught fish's 128 px thumbnail through the asset registry). domFactory draws the
  // placeholder of a fish without an image.
  constructor({ documentRef, labels, fishArt, domFactory }) {
    if (typeof fishArt?.thumbnailPath !== "function" || typeof fishArt.artSizeOf !== "function") {
      throw new TypeError("KeepnetCardRenderer requires fishArt");
    }
    this.#document = documentRef; this.#labels = labels; this.#fishArt = fishArt; this.#dom = domFactory;
    this.#stars = new RarityStarsRenderer({ documentRef });
  }

  group(group, onOpen) {
    const card = this.#button("keepnet-section__group", "", `species:${group.id}`, () => onOpen(group.id));
    card.setAttribute("aria-label", this.#labels.details(group.name, group.count));
    card.title = `${this.#labels.details(group.name, group.count)} · ${this.#labels.totalWeight(group.totalWeightKg)}`;
    const badge = this.#el("span", "keepnet-section__badge", String(group.count));
    badge.setAttribute("aria-label", this.#labels.groupCount(group.count));
    card.append(this.#image(group), this.#el("strong", "keepnet-section__fish-name", group.name),
      this.#el("span", "keepnet-section__fish-weight", this.#labels.totalWeight(group.totalWeightKg)), badge);
    return { element: card, focusables: [card] };
  }

  // onPreview (TK-226): a click on the card outside its buttons; setPreviewed marks the fish shown in the overview.
  // hook (spec 162 stage 2): { pendingFishId, hookCount, hasBait, inWater } of LiveBaitHookController, or null.
  fish(fish, { aquarium, pendingRelease, onAction, onPreview, hook = null }) {
    const card = this.#el("article", "keepnet-section__fish");
    card.addEventListener("click", (event) => { if (!event.target?.closest?.("button")) onPreview(fish); });
    const labels = this.#labels;
    // TK-229.2: the text sits in its own grey box: name, level, weight, rarity stars, then the timer.
    const info = this.#el("div", "keepnet-section__info");
    const timer = this.#el("span", "keepnet-section__fish-timer");
    info.append(this.#el("strong", "keepnet-section__fish-name", fish.name),
      this.#el("span", "keepnet-section__fish-level", labels.level(fish.level)),
      this.#el("span", "keepnet-section__fish-weight", labels.weight(fish.weightKg)),
      this.#rarity(fish.rarity), timer);
    card.append(this.#image(fish), info);
    const actions = this.#el("div", "keepnet-section__actions");
    const focusables = [];
    const action = (id, text, disabledReason = null) => {
      const button = this.#button("keepnet-section__action", text, `${fish.id}:${id}`, () => onAction(fish, id));
      if (disabledReason) { button.disabled = true; button.title = disabledReason; }
      actions.append(button); focusables.push(button);
    };
    if (pendingRelease === fish.id) {
      action("confirm-release", labels.confirmRelease); action("cancel-release", labels.cancel);
    } else {
      // Spec 162: a live bait goes on the hook («На живця») or to the aquarium, which needs one bought.
      if (fish.kind === "live_bait" && hook?.pendingFishId === fish.id) {
        // Over a regular bait the card turns green and waits for «Замінити» (spec 162 stage 2).
        card.classList.add("keepnet-section__fish--replace");
        action("replace", labels.replace, hook.inWater ? labels.tackleInWater : null);
        action("cancel-replace", labels.cancelReplace);
      } else if (fish.kind === "live_bait") {
        const blocked = fish.selected || !hook ? null : hook.hookCount !== 1 ? labels.singleHookRequired
          : hook.hasBait && hook.inWater ? labels.tackleInWater : null;
        action(fish.selected ? "deselect" : "select", fish.selected ? labels.deselect : labels.select, blocked);
        if (fish.location !== "aquarium") action("transfer", labels.transfer, aquarium?.owned ? null : labels.aquariumRequired);
      }
      action("release", labels.release);
    }
    card.append(actions);
    const update = (current) => {
      timer.textContent = current.kind === "catch" ? labels.catch :
        `${current.remainingMs === null ? labels.protected : labels.lifetime(current.remainingMs)}${current.selected ? " · ✓" : ""}`;
    };
    update(fish);
    const setPreviewed = (previewed) => card.classList.toggle("keepnet-section__fish--previewed", previewed);
    return { element: card, focusables, update, setPreviewed };
  }

  // Rarity as the shared star row (TK-229.2); a legacy text rarity (or none) stays text.
  #rarity(rarity) {
    const text = rarity ? this.#labels.rarity(rarity) : this.#labels.unknownRarity;
    return this.#stars.create(rarity, text, "keepnet-section__fish-rarity") ?? this.#el("span", "keepnet-section__fish-rarity", text);
  }

  // The fish's image, or the placeholder icon when it has none or its file fails. Only one of them is in the box: an
  // SVG element has no hidden property, so a hidden placeholder stayed visible over the fish (TK-220).
  #image(fish) {
    const media = this.#el("div", "keepnet-section__thumbnail");
    // TK-224: a smaller fish (lower level) shows smaller in the same box.
    applyArtSize(media, this.#fishArt.artSizeOf(fish));
    const fallback = () => createItemPlaceholderIcon(this.#dom, "fish", "keepnet-section__image-fallback");
    if (!fish.imagePath) {
      media.append(fallback());
      return media;
    }
    const image = this.#el("img", "keepnet-section__image");
    image.alt = fish.name; image.loading = "lazy"; image.decoding = "async";
    image.addEventListener("error", () => image.replaceWith(fallback()), { once: true });
    image.src = this.#fishArt.thumbnailPath(fish.imagePath);
    media.append(image);
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
