// Rarity as a row of vector stars filled by half steps (TK-229.2, spec 161): the keepnet fish card and the victory
// window share it. A star is its outline shape with a filled copy clipped to the star's share (CSS width), so no SVG ids
// are needed. The exact reading is the row's accessible name and tooltip.
const SVG = "http://www.w3.org/2000/svg";
// A five-point star in a 24-unit box.
const STAR_PATH = "M12 1.8l2.95 6.6 7.2.66-5.45 4.78 1.62 7.06L12 17.2l-6.32 3.7 1.62-7.06L1.85 9.06l7.2-.66z";

export class RarityStarsRenderer {
  #document;

  constructor({ documentRef }) {
    if (typeof documentRef?.createElementNS !== "function") throw new TypeError("RarityStarsRenderer requires documentRef");
    this.#document = documentRef;
  }

  // The star row for { halfSteps, maxHalfSteps, unitsPerStar }, or null for a rarity without stars (legacy text, none).
  create(rarity, label, className = "") {
    if (typeof rarity !== "object" || rarity === null || !(rarity.maxHalfSteps > 0)) return null;
    const row = this.#element("span", `rarity-stars ${className}`.trim());
    row.setAttribute("role", "img");
    row.setAttribute("aria-label", label);
    row.title = label;
    const perStar = rarity.unitsPerStar > 0 ? rarity.unitsPerStar : 2;
    const count = Math.round(rarity.maxHalfSteps / perStar);
    for (let index = 0; index < count; index++) {
      const fill = Math.max(0, Math.min(1, (rarity.halfSteps - index * perStar) / perStar));
      const star = this.#element("span", "rarity-stars__star");
      const filled = this.#element("span", "rarity-stars__fill");
      filled.style.setProperty("--rarity-star-fill", String(fill));
      filled.append(this.#shape());
      star.append(this.#shape(), filled);
      row.append(star);
    }
    return row;
  }

  #shape() {
    const svg = this.#document.createElementNS(SVG, "svg");
    svg.setAttribute("class", "rarity-stars__shape");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const path = this.#document.createElementNS(SVG, "path");
    path.setAttribute("d", STAR_PATH);
    svg.appendChild(path);
    return svg;
  }

  #element(tag, className) {
    const element = this.#document.createElement(tag);
    element.className = className;
    return element;
  }
}
