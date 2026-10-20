export class WorldPerspective {
  #getLocation;
  #sample = { scale: 1, squashY: 1 };

  constructor({ getLocation }) {
    this.#getLocation = getLocation;
  }

  getPerspective(virtualY) {
    const location = this.#getLocation();
    const angles = location.perspective || { angleTop: 5, angleBottom: 60 };
    const ratio = Math.max(0, Math.min(1,
      (virtualY - location.safeZone.top) / (location.safeZone.bottom - location.safeZone.top)));
    const radians = (angles.angleTop + (angles.angleBottom - angles.angleTop) * ratio) * Math.PI / 180;
    this.#sample.scale = Math.tan(radians) / Math.tan(angles.angleBottom * Math.PI / 180);
    this.#sample.squashY = Math.sin(radians);
    return this.#sample;
  }
}
