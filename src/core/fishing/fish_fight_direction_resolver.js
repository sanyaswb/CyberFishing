class FishFightDirectionResolver {
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
    const radial = this.#clamp(radialIntent, -1, 1);
    const lateral = this.#clamp(lateralIntent, -1, 1);
    this.#result.set(
      this.#away.x * radial + this.#lateral.x * lateral,
      this.#away.y * radial + this.#lateral.y * lateral,
    );

    if (this.#result.length() <= 0.001) {
      return this.#result.set(this.#away.x, this.#away.y);
    }
    return this.#result.normalize();
  }

  #clamp(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(min, Math.min(max, number));
  }
}
