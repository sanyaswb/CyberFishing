import { WaterEntity } from "./water_entity.js";

export class WobblerEntity extends WaterEntity {
  _processMechanics(dt, input, reelPower, pullDirection) {
    const dtSec = dt / 1000;

    if (input.isPulling && pullDirection) {
      this._applyRetrieveForce(
        dt,
        pullDirection,
        reelPower,
        this._lureRetrieveConfig().multiplier ?? 150,
        this._lureResistance,
      );

      const topDepth = this._config.targetMinDepth ?? 0;
      const bottomDepth = this._config.targetMaxDepth ?? this._maxDepth;

      if (this._config.mode === 1 || this._config.mode === 2) {
        this._adjustDepth(topDepth, dtSec);
      } else if (this._config.mode === 3) {
        this._adjustDepth(bottomDepth, dtSec);
      }
    } else {
      const topDepth = this._config.targetMinDepth ?? 0;
      const bottomDepth = this._config.targetMaxDepth ?? this._maxDepth;

      if (this._config.mode === 1 || this._config.mode === 2) {
        this._adjustDepth(bottomDepth, dtSec);
      } else if (this._config.mode === 3) {
        this._adjustDepth(topDepth, dtSec);
      }
    }
  }

  _adjustDepth(target, dtSec) {
    if (this._currentHookDepth < target) {
      this._currentHookDepth = Math.min(
        target,
        this._currentHookDepth + this._config.sinkSpeed * dtSec,
      );
    } else if (this._currentHookDepth > target) {
      this._currentHookDepth = Math.max(
        target,
        this._currentHookDepth - this._config.riseSpeed * dtSec,
      );
    }
  }
}
