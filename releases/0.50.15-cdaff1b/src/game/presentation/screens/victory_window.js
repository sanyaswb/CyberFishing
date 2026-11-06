import { applyArtSize } from "../ui/art_size.js";

// The victory window (spec 161): a DOM dialog over the game, built once and filled when a fish is caught. The blur
// behind it is the compositor's backdrop filter (no per-frame canvas work). The picture opens the fish on the whole
// screen; a click there (or Escape) brings the panel back. Claim and Release report their action to the victory state.
export class VictoryWindow {
  #dom;
  #labels;
  #stars;
  #scale;
  #icons;
  #root;
  #panel;
  #title;
  #picture;
  #image;
  #level;
  #details;
  #stats;
  #zoom;
  #zoomImage;
  #claim;
  #release;
  #onAction = null;

  // domFactory: InventoryDomFactory (elements, sprite icons, asset URLs); mountNode: the UI surface's mount root;
  // icons: { sprite, weight } asset ids (status-icons sprite, the weight icon); stars: RarityStarsRenderer;
  // scale: VictoryWeightScaleRenderer.
  constructor({ domFactory, mountNode, labels, stars, scale, icons }) {
    this.#dom = domFactory;
    this.#labels = labels;
    this.#stars = stars;
    this.#scale = scale;
    this.#icons = icons;
    const dom = domFactory;
    this.#root = dom.element("div", "victory-window");
    this.#root.hidden = true;
    this.#root.setAttribute("role", "dialog");
    this.#root.setAttribute("aria-modal", "true");
    this.#root.setAttribute("aria-label", labels.dialog);
    this.#panel = dom.element("section", "victory-window__panel");
    this.#title = dom.element("h2", "victory-window__title");
    this.#picture = dom.button("victory-window__picture", "", { title: labels.showFish });
    this.#picture.setAttribute("aria-label", labels.showFish);
    this.#image = this.#fishImage("victory-window__image");
    this.#level = dom.element("span", "victory-window__level");
    this.#picture.append(this.#image);
    this.#details = dom.element("div", "victory-window__details");
    this.#stats = dom.element("ul", "victory-window__stats");
    const actions = dom.element("div", "victory-window__actions");
    this.#claim = dom.button("victory-window__action victory-window__action--primary", labels.claim);
    this.#release = dom.button("victory-window__action", labels.release);
    actions.append(this.#claim, this.#release);
    this.#panel.append(this.#level, dom.element("p", "victory-window__eyebrow", labels.title), this.#title, this.#picture,
      this.#details, this.#stats, actions);
    this.#zoom = dom.button("victory-window__zoom", "", { title: labels.closeFish });
    this.#zoom.setAttribute("aria-label", labels.closeFish);
    this.#zoom.hidden = true;
    this.#zoomImage = this.#fishImage("victory-window__zoom-image");
    this.#zoom.append(this.#zoomImage);
    this.#root.append(this.#panel, this.#zoom);
    this.#claim.addEventListener("click", this.#claimAction);
    this.#release.addEventListener("click", this.#releaseAction);
    this.#picture.addEventListener("click", this.#openFish);
    this.#zoom.addEventListener("click", this.#closeFish);
    this.#root.addEventListener("keydown", this.#handleKey);
    mountNode.appendChild(this.#root);
  }

  get element() { return this.#root; }
  get isOpen() { return !this.#root.hidden; }

  // view: VictoryViewModelBuilder.build(); onAction("claim" | "release").
  show(view, { onAction }) {
    const labels = this.#labels;
    this.#onAction = onAction;
    this.#root.style.setProperty("--victory-color", view.color.join(", "));
    this.#root.style.setProperty("--victory-background-alpha", String(view.backgroundAlpha));
    applyArtSize(this.#picture, view.artSize);
    this.#root.classList.toggle("victory-window--animated", view.animated);
    this.#title.textContent = view.name;
    for (const image of [this.#image, this.#zoomImage]) {
      image.alt = view.name;
      if (image.getAttribute("src") !== view.imagePath) image.src = view.imagePath;
    }
    this.#level.textContent = String(view.level);
    this.#level.setAttribute("aria-label", labels.level(view.level));
    const details = [this.#scale.create(view.scale, view.scale ? labels.scale(view.scale) : ""),
      this.#stars.create(view.rarity, labels.rarity(view.rarity), "victory-window__stars")].filter(Boolean);
    this.#details.replaceChildren(...details);
    this.#stats.replaceChildren(
      this.#stat("victory-window__stat--weight", [this.#weightIcon(), this.#dom.element("span", "victory-window__value",
        labels.weight(view.weightKg))], labels.weightName(view.weightKg)),
      this.#stat(`victory-window__stat--trophy victory-window__stat--${view.isTrophy ? "yes" : "no"}`,
        [this.#icon("trophy"), this.#icon(view.isTrophy ? "check" : "cross")], labels.trophy(view.isTrophy)),
      this.#stat(`victory-window__stat--anomaly victory-window__stat--${view.hasAnomaly ? "yes" : "no"}`,
        [this.#icon("radiation"), this.#icon(view.hasAnomaly ? "check" : "cross")], labels.anomaly(view.hasAnomaly, view.anomaly)),
      ...view.extraStats.map((text) => this.#stat("victory-window__stat--text",
        [this.#dom.element("span", "victory-window__value", text)], text)));
    this.#setZoomed(false);
    this.#root.hidden = false;
    this.#claim.focus?.();
  }

  hide() {
    this.#onAction = null;
    this.#setZoomed(false);
    this.#root.hidden = true;
  }

  dispose() {
    this.hide();
    this.#claim.removeEventListener("click", this.#claimAction);
    this.#release.removeEventListener("click", this.#releaseAction);
    this.#picture.removeEventListener("click", this.#openFish);
    this.#zoom.removeEventListener("click", this.#closeFish);
    this.#root.removeEventListener("keydown", this.#handleKey);
    this.#root.remove();
  }

  #act(action) { this.#onAction?.(action); }
  #claimAction = () => this.#act("claim");
  #releaseAction = () => this.#act("release");
  #openFish = () => { this.#setZoomed(true); this.#zoom.focus?.(); };
  #closeFish = () => { this.#setZoomed(false); this.#picture.focus?.(); };
  #handleKey = (event) => {
    if (event.key !== "Escape" || this.#zoom.hidden) return;
    event.preventDefault?.();
    this.#closeFish();
  };

  #setZoomed(zoomed) {
    this.#root.classList.toggle("victory-window--zoomed", zoomed);
    this.#panel.hidden = zoomed;
    this.#zoom.hidden = !zoomed;
  }

  #stat(modifier, children, label) {
    const stat = this.#dom.element("li", `victory-window__stat ${modifier}`);
    stat.setAttribute("aria-label", label);
    stat.title = label;
    stat.append(...children);
    return stat;
  }

  #icon(symbol) {
    return this.#dom.svgIcon(this.#icons.sprite, symbol, `ui-icon victory-window__icon victory-window__icon--${symbol}`);
  }

  #weightIcon() {
    const image = this.#dom.image(this.#icons.weight, "");
    image.className = "victory-window__icon victory-window__icon--weight";
    image.setAttribute("aria-hidden", "true");
    return image;
  }

  #fishImage(className) {
    const image = this.#dom.element("img", className);
    image.decoding = "async";
    image.draggable = false;
    return image;
  }
}
