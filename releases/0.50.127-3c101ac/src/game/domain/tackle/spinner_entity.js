import { WaterEntity } from "./water_entity.js";

export class SpinnerEntity extends WaterEntity {
  _processMechanics(dt, input, reelPower, pullDirection, bottomDepth) {
    const dtSec = dt / 1000;

    if (input.isPulling && pullDirection) {
      this._applyRetrieveForce(
        dt,
        pullDirection,
        reelPower,
        this._lureRetrieveConfig().multiplier ?? 150,
        this._lureResistance,
      );

      this._currentHookDepth = Math.max(
        0,
        this._currentHookDepth - this._config.riseSpeed * dtSec,
      );
    } else {
      this._currentHookDepth = Math.min(
        bottomDepth,
        this._currentHookDepth + this._config.sinkSpeed * dtSec,
      );
    }
  }
}
