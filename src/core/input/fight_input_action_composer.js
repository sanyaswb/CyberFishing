class FightInputActionComposer {
  #state = Object.freeze({
    hold: Object.freeze({ active: false, ratio: 0, source: "none" }),
    lateralControl: Object.freeze({
      active: false,
      directionX: 0,
      inputRatio: 0,
      source: "none",
    }),
    raw: Object.freeze({
      pointerDown: false,
      spaceDown: false,
      leftDown: false,
      rightDown: false,
      legacyPulling: false,
      legacyRodControlActive: false,
    }),
  });

  compose(input = {}, config = {}) {
    if (input?.fightActions?.hold && input?.fightActions?.lateralControl) {
      return input.fightActions;
    }

    const keysConfig = config.keys || {};
    const pointerDown = input?.pointerDown === true;
    const legacyPulling = input?.isPulling === true || input?.pullHeld === true;
    const spaceDown = this.#isAnyKeyHeld(input, keysConfig.pull || ["Space"]);
    const pointerControl = this.#resolvePointerControl(
      input,
      config.rodControlInput || {},
    );
    const pointerHoldActive = pointerDown && !pointerControl.active;
    const legacyHoldActive = legacyPulling && !pointerControl.active;
    const holdActive = pointerHoldActive || legacyHoldActive || spaceDown;
    const holdSource = spaceDown
      ? "keyboard"
      : pointerHoldActive
        ? "pointer"
        : legacyHoldActive
          ? "legacy"
          : "none";

    const keyboardControl = this.#resolveKeyboardControl(input, keysConfig);
    const legacyControl = this.#resolveLegacyControl(input);
    const lateralControl = this.#mergeLateralControl({
      pointerControl,
      keyboardControl,
      legacyControl,
    });

    this.#state = Object.freeze({
      hold: Object.freeze({
        active: holdActive,
        ratio: holdActive ? 1 : 0,
        source: holdSource,
      }),
      lateralControl: Object.freeze({
        active: lateralControl.active,
        directionX: lateralControl.directionX,
        inputRatio: lateralControl.inputRatio,
        source: lateralControl.source,
      }),
      raw: Object.freeze({
        pointerDown,
        spaceDown,
        leftDown: keyboardControl.directionX < 0,
        rightDown: keyboardControl.directionX > 0,
        legacyPulling,
        legacyRodControlActive: input?.rodControlActive === true,
      }),
    });

    return this.#state;
  }

  #resolveLegacyControl(input) {
    if (input?.rodControlActive !== true) {
      return this.#emptyControl("legacy");
    }

    const directionX = Math.sign(Number(input.rodControlDirectionX) || 0);
    const inputRatio = this.#clamp01(input.rodControlInputRatio);
    if (directionX === 0 || inputRatio <= 0) {
      return this.#emptyControl("legacy");
    }

    return {
      active: true,
      directionX,
      inputRatio,
      source: "legacy",
      priority: 2,
    };
  }

  #resolveKeyboardControl(input, keysConfig) {
    let directionX = 0;
    if (this.#isAnyKeyHeld(input, keysConfig.left || ["KeyA", "ArrowLeft"])) directionX -= 1;
    if (this.#isAnyKeyHeld(input, keysConfig.right || ["KeyD", "ArrowRight"])) directionX += 1;
    directionX = Math.sign(directionX);
    if (directionX === 0) return this.#emptyControl("keyboard");

    const fallbackRatio = this.#clamp01(
      Number(input?.keyboardRodControlRatio ?? input?.rodControlInputRatio ?? 1),
    ) || 1;

    return {
      active: true,
      directionX,
      inputRatio: fallbackRatio,
      source: "keyboard",
      priority: 3,
    };
  }

  #resolvePointerControl(input, config) {
    if (input?.pointerDown !== true) return this.#emptyControl("pointer");

    const deltaX = Number(input?.pointerDelta?.x) || 0;
    const deltaY = Number(input?.pointerDelta?.y) || 0;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const minLock = Math.max(1, Number(config.minLockDistancePx) || 10);
    const dominance = Math.max(1, Number(config.horizontalDominanceRatio) || 1.25);

    if (absX < minLock || absX < absY * dominance) {
      return this.#emptyControl("pointer");
    }

    const directionX = Math.sign(deltaX);
    const fullPowerDistance = Math.max(
      1,
      Number(config.fallbackFullPowerPx) || 90,
    );
    const deadZone = Math.max(0, Number(config.directionDeadZonePx) || 12);
    const inputRatio = absX < deadZone
      ? 0
      : this.#clamp01(absX / fullPowerDistance);

    if (directionX === 0 || inputRatio <= 0) {
      return this.#emptyControl("pointer");
    }

    return {
      active: true,
      directionX,
      inputRatio,
      source: "pointer",
      priority: 1,
    };
  }

  #mergeLateralControl({ pointerControl, keyboardControl, legacyControl }) {
    const candidates = [keyboardControl, legacyControl, pointerControl]
      .filter((control) => control?.active === true);
    if (!candidates.length) return this.#emptyControl("none");

    let best = candidates[0];
    for (let i = 1; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (candidate.priority > best.priority) {
        best = candidate;
        continue;
      }
      if (
        candidate.priority === best.priority &&
        candidate.inputRatio > best.inputRatio
      ) {
        best = candidate;
      }
    }
    return best;
  }

  #emptyControl(source) {
    return {
      active: false,
      directionX: 0,
      inputRatio: 0,
      source,
      priority: 0,
    };
  }

  #isAnyKeyHeld(input, keyList) {
    if (!Array.isArray(keyList)) return false;
    const keys = input?.keys || {};
    for (let i = 0; i < keyList.length; i++) {
      const key = keyList[i];
      if (keys[key] === true || input?.[key] === true) return true;
    }
    return false;
  }

  #clamp01(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(1, number));
  }
}

if (typeof window !== "undefined") {
  window.FightInputActionComposer = FightInputActionComposer;
}
