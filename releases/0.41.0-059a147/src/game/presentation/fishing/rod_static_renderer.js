// Static mode of the rod (spec 099, owner D9): the skin's atlas region drawn upright over the skeleton's setup
// bounds with Canvas 2D, no Spine runtime. A region stored rotated 90 degrees (counter-clockwise in the page, the
// Spine atlas convention) is drawn through a 90 degree canvas rotation.
export class RodStaticRenderer {
  #surface;

  constructor({ surface }) {
    if (typeof surface?.drawImage !== "function") throw new TypeError("RodStaticRenderer requires surface");
    this.#surface = surface;
  }

  render(model) {
    if (!model.visible || model.rodMode !== "static") return;
    const region = model.rodRegion;
    const bounds = model.rodBounds;
    const scale = model.rodScale;
    const left = model.rodBaseX + bounds.x * scale;
    const top = model.rodBaseY - (bounds.y + bounds.height) * scale;
    const width = bounds.width * scale;
    const height = bounds.height * scale;
    const surface = this.#surface;
    if (region.rotate === 90) {
      surface.save();
      surface.translate(left + width, top);
      surface.rotate(Math.PI / 2);
      surface.drawImage(model.rodImage, region.x, region.y, region.height, region.width, 0, 0, height, width);
      surface.restore();
      return;
    }
    surface.drawImage(model.rodImage, region.x, region.y, region.width, region.height, left, top, width, height);
  }
}
