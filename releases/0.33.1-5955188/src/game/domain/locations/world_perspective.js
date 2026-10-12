export class WorldPerspective {
  #locationsConfig;
  #locationId;

  constructor(locationsConfig, locationId) {
    this.#locationsConfig = locationsConfig;
    this.#locationId = locationId;
  }

  getPerspective(virtualY) {
    const mapConfig = this.#locationsConfig.map[this.#locationId];

    const pConfig = mapConfig.perspective || { angleTop: 5, angleBottom: 60 };

    const topY = mapConfig.safeZone.top;
    const bottomY = mapConfig.safeZone.bottom;

    // Normalize distance from the horizon (0) to the shore (1).
    const distRatio = Math.max(
      0,
      Math.min(1.0, (virtualY - topY) / (bottomY - topY)),
    );


    const currentAngleDeg =
      pConfig.angleTop + (pConfig.angleBottom - pConfig.angleTop) * distRatio;
    const currentAngleRad = (currentAngleDeg * Math.PI) / 180;
    const bottomAngleRad = (pConfig.angleBottom * Math.PI) / 180;


    // Vertical squash is sin(angle): 90 degrees gives 1; 5 degrees gives about 0.087.
    const squashY = Math.sin(currentAngleRad);


    // The tangent ratio scales distant objects; the shore remains at scale 1.

    const scale = Math.tan(currentAngleRad) / Math.tan(bottomAngleRad);

    return { scale, squashY };
  }
}
