import { UiEventShield } from "../dom/ui_event_shield.js";

// Spec 184 D4 (TK-376): the HUD's drink button, like the chum button in the toolbar, left of the item selector: shown only
// while the drink slot holds something, with the drink's art and how many are left; a tap drinks one (onDrink). The
// DOM is written only when what it shows changes.
// assets: the AssetRegistry (the drink's art by asset id); labels: { drinkAction(name, count) }.
export class DrinkHudControl {
  #button;
  #image;
  #count;
  #assets;
  #labels;
  #shown = null;
  #imageUrl = null;

  constructor({ documentRef, mountNode, assets, labels, onDrink }) {
    if (typeof assets?.pathOf !== "function") throw new TypeError("DrinkHudControl requires assets");
    if (typeof labels?.drinkAction !== "function") throw new TypeError("DrinkHudControl requires labels.drinkAction");
    if (typeof onDrink !== "function") throw new TypeError("DrinkHudControl requires onDrink");
    this.#assets = assets;
    this.#labels = labels;
    const button = documentRef.createElement("button");
    button.type = "button";
    button.className = "game-control game-toolbar-button game-toolbar-button--drink drink-control";
    button.hidden = true;
    const image = documentRef.createElement("img");
    image.className = "drink-control__image";
    // Spec 157 R6: lazy before src, so the hidden button's art waits until it is shown.
    image.loading = "lazy";
    image.decoding = "async";
    image.alt = "";
    image.draggable = false;
    image.setAttribute("aria-hidden", "true");
    const count = documentRef.createElement("span");
    count.className = "drink-control__count";
    count.setAttribute("aria-hidden", "true");
    button.append(image, count);
    UiEventShield.makeSolid(button);
    button.addEventListener("click", () => {
      if (!button.hidden) onDrink();
    });
    mountNode.appendChild(button);
    this.#button = button;
    this.#image = image;
    this.#count = count;
  }

  // drink: the drink slot's item ({ name, quantity, iconAsset }) or null.
  update(drink) {
    const count = drink ? Math.max(1, Math.floor(Number(drink.quantity) || 1)) : 0;
    const key = drink ? `${drink.iconAsset ?? ""}|${drink.name ?? ""}|${count}` : "";
    if (key === this.#shown) return;
    this.#shown = key;
    this.#button.hidden = !drink;
    if (!drink) return;
    const url = drink.iconAsset ? this.#assets.pathOf(drink.iconAsset) : "";
    if (url !== this.#imageUrl) {
      this.#imageUrl = url;
      this.#image.src = url;
    }
    this.#count.textContent = String(count);
    const label = this.#labels.drinkAction(drink.name ?? "", count);
    this.#button.title = label;
    this.#button.setAttribute("aria-label", label);
  }

  dispose() {
    this.#button.remove();
  }
}
