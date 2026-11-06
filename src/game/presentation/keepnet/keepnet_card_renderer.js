import { createItemPlaceholderIcon } from "../inventory/inventory_icons.js";
import { applyArtSize } from "../ui/art_size.js";

const SVG = "http://www.w3.org/2000/svg";
// A five-point star in a 24-unit box (the victory panel's star shape).
const STAR_PATH = "M12 1.8l2.95 6.6 7.2.66-5.45 4.78 1.62 7.06L12 17.2l-6.32 3.7 1.62-7.06L1.85 9.06l7.2-.66z";

export class KeepnetCardRenderer {
  #document;
  #labels;
  #fishArt;
  #dom;
  // fishArt: FishArtVariants (a caught fish's 128 px thumbnail through the asset registry). domFactory draws the
  // placeholder of a fish without an image.
  constructor({ documentRef, labels, fishArt, domFactory }) {
    if (typeof fishArt?.thumbnailPath !== "function" || typeof fishArt.artSizeOf !== "function") {
      throw new TypeError("KeepnetCardRenderer requires fishArt");
    }
    this.#document = documentRef; this.#labels = labels; this.#fishArt = fishArt; this.#dom = domFactory;
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
  fish(fish, { aquarium, pendingRelease, onAction, onPreview }) {
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
    const action = (id, text) => {
      const button = this.#button("keepnet-section__action", text, `${fish.id}:${id}`, () => onAction(fish, id));
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
    const setPreviewed = (previewed) => card.classList.toggle("keepnet-section__fish--previewed", previewed);
    return { element: card, focusables, update, setPreviewed };
  }

  // Rarity as a row of stars filled by half steps like the victory panel's; the exact reading is the accessible name. A
  // legacy text rarity (or none) stays text.
  #rarity(rarity) {
    const text = rarity ? this.#labels.rarity(rarity) : this.#labels.unknownRarity;
    if (typeof rarity !== "object" || rarity === null || !(rarity.maxHalfSteps > 0)) {
      return this.#el("span", "keepnet-section__fish-rarity", text);
    }
    const row = this.#el("span", "keepnet-section__fish-rarity keepnet-section__stars");
    row.setAttribute("role", "img");
    row.setAttribute("aria-label", text);
    row.title = text;
    const perStar = rarity.unitsPerStar > 0 ? rarity.unitsPerStar : 2;
    const count = Math.round(rarity.maxHalfSteps / perStar);
    for (let index = 0; index < count; index++) {
      const fill = Math.max(0, Math.min(1, (rarity.halfSteps - index * perStar) / perStar));
      const star = this.#el("span", "keepnet-section__star");
      const filled = this.#el("span", "keepnet-section__star-fill");
      filled.style.setProperty("--keepnet-star-fill", String(fill));
      star.append(this.#starShape("keepnet-section__star-shape"), filled);
      filled.append(this.#starShape("keepnet-section__star-shape"));
      row.append(star);
    }
    return row;
  }
  #starShape(className) {
    const svg = this.#document.createElementNS(SVG, "svg");
    svg.setAttribute("class", className);
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const path = this.#document.createElementNS(SVG, "path");
    path.setAttribute("d", STAR_PATH);
    svg.appendChild(path);
    return svg;
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
