// The victory window's weight ruler (spec 161 D4): a grey track with ticks, the species' minimum and maximum weight at
// its ends, a marker with the current weight, and the trophy weight's segment in green with its number. One SVG built
// when the window opens.
const SVG = "http://www.w3.org/2000/svg";
const WIDTH = 320, LEFT = 18, RIGHT = 302, TRACK_Y = 26, TICKS = 10;

export class VictoryWeightScaleRenderer {
  #document;
  #format;

  // format(kg): the weight text of the labels.
  constructor({ documentRef, format }) {
    if (typeof documentRef?.createElementNS !== "function") throw new TypeError("VictoryWeightScaleRenderer requires documentRef");
    this.#document = documentRef;
    this.#format = format;
  }

  // The ruler for { minKg, maxKg, weightKg, trophyKg }, or null without a scale.
  create(scale, label) {
    if (!scale) return null;
    const svg = this.#node("svg", { class: "victory-scale", viewBox: `0 0 ${WIDTH} 58`, role: "img", "aria-label": label });
    const x = (kg) => LEFT + (RIGHT - LEFT) * (kg - scale.minKg) / (scale.maxKg - scale.minKg);
    svg.append(this.#node("rect", { class: "victory-scale__track", x: LEFT, y: TRACK_Y, width: RIGHT - LEFT, height: 6, rx: 3 }));
    if (scale.trophyKg !== null) {
      const start = x(scale.trophyKg);
      svg.append(this.#node("rect", { class: "victory-scale__trophy", x: start, y: TRACK_Y, width: RIGHT - start, height: 6, rx: 3 }));
      svg.append(this.#text(`≥ ${this.#format(scale.trophyKg)}`, Math.min(RIGHT - 40, Math.max(LEFT + 60, start)), 54,
        "middle", "victory-scale__label victory-scale__label--trophy"));
    }
    for (let index = 0; index <= TICKS; index++) {
      const tickX = LEFT + (RIGHT - LEFT) * index / TICKS;
      const major = index === 0 || index === TICKS / 2 || index === TICKS;
      svg.append(this.#node("line", { class: "victory-scale__tick", x1: tickX, x2: tickX, y1: TRACK_Y + 8, y2: TRACK_Y + (major ? 15 : 12) }));
    }
    svg.append(this.#text(this.#format(scale.minKg), LEFT, 54, "start", "victory-scale__label"));
    svg.append(this.#text(this.#format(scale.maxKg), RIGHT, 54, "end", "victory-scale__label"));
    const markerX = x(scale.weightKg);
    svg.append(this.#node("path", { class: "victory-scale__marker", d: `M${markerX - 6} 13h12l-6 9z` }));
    svg.append(this.#text(this.#format(scale.weightKg), Math.min(RIGHT - 24, Math.max(LEFT + 24, markerX)), 10, "middle",
      "victory-scale__label victory-scale__label--current"));
    return svg;
  }

  #text(content, x, y, anchor, className) {
    const text = this.#node("text", { class: className, x, y, "text-anchor": anchor });
    text.textContent = content;
    return text;
  }

  #node(tag, attributes) {
    const node = this.#document.createElementNS(SVG, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
    return node;
  }
}
