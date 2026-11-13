import { Vector2 } from "../../../engine/math/vector2.js";
import { clampFinite } from "../../../engine/math/number_normalization.js";

export class FishFightDirectionResolver {
  #result = new Vector2(0, 0);
  #away = new Vector2(0, 0);
  #lateral = new Vector2(0, 0);

  resolve({
    fishPosition,
    rodTipPosition,
    radialIntent = 1,
    lateralIntent = 0,
  } = {}) {
    this.#away.set(
      (Number(fishPosition?.x) || 0) -
        (Number(rodTipPosition?.x) || 0),
      (Number(fishPosition?.y) || 0) -
        (Number(rodTipPosition?.y) || 0),
    );
    if (this.#away.length() <= 0.001) {
      this.#away.set(0, -1);
    } else {
      this.#away.normalize();
    }

    this.#lateral.set(-this.#away.y, this.#away.x);
    const radial = clampFinite(radialIntent, -1, 1, 0);
    const lateral = clampFinite(lateralIntent, -1, 1, 0);
    this.#result.set(
      this.#away.x * radial + this.#lateral.x * lateral,
      this.#away.y * radial + this.#lateral.y * lateral,
    );

    if (this.#result.length() <= 0.001) {
      return this.#result.set(this.#away.x, this.#away.y);
    }
    return this.#result.normalize();
  }
}
