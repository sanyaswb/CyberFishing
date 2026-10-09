import { GameState } from "./game_state.js";
import { Vector2 } from "../../../engine/math/vector2.js";

export class BitingState extends GameState {
  /** @param {BitingStateDeps} deps */
  constructor(deps) {
    super(deps);
  }

  #feederAudioPlayer;
  #lastStepId = -1;
  #ringQueue = [];
  #ringHead = 0;
  #stepTimeElapsed = 0;
  #normalRingAccumulator = 0;
  #guaranteedRingAccumulator = 0;
  #pullDirection = new Vector2(0, 0);

  enter(data) {
    if (super.enter) super.enter();

    this.fish = data.fish;

    this.#lastStepId = -1;
    this.#ringQueue.length = 0;
    this.#ringHead = 0;
    this.#stepTimeElapsed = 0;
    this.#normalRingAccumulator = 0;
    this.#guaranteedRingAccumulator = 0;

    const eq = this.deps.inventory.getEquipped();
    if (
      this.deps.rules.equipment.isFeeder(eq) &&
      this.deps.config.ui?.audio?.feederBite
    ) {
      const src = this.deps.config.ui.audio.feederBite;
      if (!this.#feederAudioPlayer || this.#feederAudioPlayer.src !== src) {
        this.#feederAudioPlayer?.dispose();
        this.#feederAudioPlayer = this.deps.services.audio.createPlayer(src);
      }
      this.#feederAudioPlayer.warm().catch(() => {});
    } else {
      this.#feederAudioPlayer?.dispose();
      this.#feederAudioPlayer = null;
    }
  }

  exit() {
    this.#ringQueue.length = 0;
    this.#ringHead = 0;
    this.#stepTimeElapsed = 0;
  }

  handleInput(input) {
    const eq = this.deps.inventory.getEquipped();
    const isSpinning = this.deps.rules.equipment.isSpinning(eq);

    if (input.isDoubleClick) {
      this.deps.float.stopBite();
      this.deps.commands.setState("scouting");
      return;
    }

    const isPassiveStrikeInput = input.isPulling || input.clickPos;
    if (isPassiveStrikeInput && !isSpinning) {
      if (!this.deps.canPlayerCast()) return;

      const isGuaranteed = this.deps.float.isGuaranteedBite();
      if (!isGuaranteed) {
        input.clickPos = null;
        this.deps.float.stopBite();
        this.deps.commands.setState("waiting");
        return;
      }

      const success = this.deps.rng.chance(0.99);

      if (success) {
        input.clickPos = null;
        this.deps.float.hook();
        if (
          this.deps.biteSystem &&
          typeof this.deps.biteSystem.hookFish === "function"
        ) {
          this.deps.biteSystem.hookFish();
        }
        this.deps.commands.setState("playing", { fish: this.fish });
      } else {
        input.clickPos = null;
        this.deps.float.stopBite();
        this.deps.commands.setState("waiting");
      }
    }
  }

  update(dt, bounds, envData) {
    this.deps.float.updateBite(dt, (vx, vy) =>
      this.deps.world.checkWater(vx, vy),
    );

    const input = envData.input || this.deps.input.getState();
    const pos = this.deps.float.getPosition();
    this.deps.projector.focusOnVirtualPos(pos.y, dt, 0.05);

    const eq = this.deps.inventory.getEquipped();
    const isSpinning = this.deps.rules.equipment.isSpinning(eq);

    const reelPower = eq?.reel?.effectiveStats?.basePower || 0;

    let pullDirection = null;
    if (input.isPulling) {
      const rodPos = this.deps.world.getRodVirtualPos(bounds);
      pullDirection = this.#pullDirection
        .set(rodPos.x - pos.x, rodPos.y - pos.y)
        .normalize();
    }

    this.deps.float.update(
      bounds,
      dt,
      envData.env,
      (vx, vy) => this.deps.world.checkWater(vx, vy),
      input,
      reelPower,
      pullDirection,
    );

    const stepInfo = this.deps.float.getBiteStepInfo?.();
    if (isSpinning && stepInfo && stepInfo.isGuaranteed && input.isPulling) {
      this.deps.float.hook();
      if (
        this.deps.biteSystem &&
        typeof this.deps.biteSystem.hookFish === "function"
      ) {
        this.deps.biteSystem.hookFish();
      }
      this.deps.commands.setState("playing", { fish: this.fish });
      return;
    }

    if (!this.deps.float.isBiting()) {
      this.deps.commands.setState("waiting");
      return;
    }

    const updatedPos = this.deps.float.getPosition();
    const shoreY = bounds.bottom;
    if (isSpinning && updatedPos.y >= shoreY) {
      this.deps.float.stopBite();
      this.deps.commands.setState("scouting");
      return;
    }

    if (stepInfo) {
      if (stepInfo.id !== this.#lastStepId) {
        this.#lastStepId = stepInfo.id;

        if (stepInfo.isAction) {
          if (
            this.deps.fishing.tryConsumeBaitDuringBite(
              eq,
              stepInfo,
              this.deps.rng,
              {
                baitLossChance:
                  this.deps.config.fightPhysicsConfig
                    ?.getBaitLossChanceConfig?.() || {},
              },
            )
          ) {
            this.deps.float.stopBite();
            this.deps.commands.setState("waiting");
            return;
          }

          if (this.#feederAudioPlayer) {
            this.#scheduleRings(stepInfo);
          }
        }
      }

      if (this.#feederAudioPlayer) {
        this.#processRingQueue(dt);
      }
    }
  }

  #scheduleRings(stepInfo) {
    this.#ringQueue.length = 0;
    this.#ringHead = 0;
    this.#stepTimeElapsed = 0;

    const cfg = this.deps.config.feederConfig || {
      volumeNormal: 0.4,
      volumeGuaranteed: 1.0,
      normalRings: [1, 1],
      guaranteedRings: [2, 3],
    };

    if (!stepInfo.isGuaranteed) {
      const ringCount = this.#resolveRingCount(
        cfg.normalRings,
        [1, 1],
        "normal",
      );
      this.#queueRings(ringCount, stepInfo.duration, cfg.volumeNormal);
      return;
    }

    const ringCount = this.#resolveRingCount(
      cfg.guaranteedRings,
      [2, 3],
      "guaranteed",
    );
    this.#queueRings(ringCount, stepInfo.duration, cfg.volumeGuaranteed);
  }

  #queueRings(ringCount, duration, volume) {
    if (ringCount <= 0) return;

    const interval = duration / ringCount;
    for (let i = 0; i < ringCount; i++) {
      this.#ringQueue.push({
        startAt: i * interval,
        volume,
      });
    }
  }

  #resolveRingCount(value, fallback, mode) {
    const range = this.#normalizeRingRange(value, fallback);
    const min = range[0];
    const max = range[1];

    if (min >= 1 && max >= 1 && Number.isInteger(min) && Number.isInteger(max))
      return this.deps.rng.int(min, max);

    const rate = min === max ? min : this.deps.rng.range(min, max);
    if (rate <= 0) return 0;

    const whole = Math.floor(rate);
    const fraction = rate - whole;
    let count = whole;

    if (fraction > 0) {
      if (mode === "guaranteed") {
        this.#guaranteedRingAccumulator += fraction;
        const extra = Math.floor(this.#guaranteedRingAccumulator);
        this.#guaranteedRingAccumulator -= extra;
        count += extra;
      } else {
        this.#normalRingAccumulator += fraction;
        const extra = Math.floor(this.#normalRingAccumulator);
        this.#normalRingAccumulator -= extra;
        count += extra;
      }
    }

    return count;
  }

  #normalizeRingRange(value, fallback) {
    const source = Array.isArray(value) ? value : [value, value];
    const fallbackSource = Array.isArray(fallback)
      ? fallback
      : [fallback, fallback];
    let min = Number(source[0]);
    let max = Number(source[1] ?? source[0]);

    if (!Number.isFinite(min)) min = Number(fallbackSource[0]) || 0;
    if (!Number.isFinite(max)) {
      max = Number(fallbackSource[1] ?? fallbackSource[0]) || min;
    }
    if (max < min) {
      const tmp = min;
      min = max;
      max = tmp;
    }

    return [Math.max(0, min), Math.max(0, max)];
  }

  #processRingQueue(dt) {
    if (this.#ringHead >= this.#ringQueue.length) return;

    this.#stepTimeElapsed += dt;

    while (
      this.#ringHead < this.#ringQueue.length &&
      this.#stepTimeElapsed >= this.#ringQueue[this.#ringHead].startAt
    ) {
      const currentRing = this.#ringQueue[this.#ringHead++];
      this.#playSound(currentRing.volume);
    }

    if (this.#ringHead >= this.#ringQueue.length) {
      this.#ringQueue.length = 0;
      this.#ringHead = 0;
    }
  }

  #playSound(volume) {
    this.#feederAudioPlayer?.play(volume);
  }

  dispose() {
    this.#feederAudioPlayer?.dispose();
    this.#feederAudioPlayer = null;
  }

  getRenderState(target, bounds) {
    target.stateName = "biting";
    target.fishing.visible = true;
    target.fishing.state = "biting";
    target.fishing.bottom = bounds.bottom;
    target.fishing.startTime = this.deps.getCastStartTime();
  }
}
