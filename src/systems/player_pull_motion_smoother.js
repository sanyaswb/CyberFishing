class PlayerPullMotionSmoother {
  #velocityX = 0;
  #velocityY = 0;
  #debug = this.#createDebug();

  update({
    desiredMoveX = null,
    desiredMoveY = null,
    deltaTime,
    config,
  } = {}) {
    const dt = Math.max(0, Number(deltaTime) || 0);
    const next = {
      moveX: Number.isFinite(Number(desiredMoveX)) ? Number(desiredMoveX) : 0,
      moveY: Number.isFinite(Number(desiredMoveY)) ? Number(desiredMoveY) : 0,
    };
    if (Number.isFinite(Number(desiredMoveX))) {
      next.moveX = this.updateAxis({
        axis: "x",
        desiredMove: next.moveX,
        deltaTime: dt,
        config,
      }).move;
    }
    if (Number.isFinite(Number(desiredMoveY))) {
      next.moveY = this.updateAxis({
        axis: "y",
        desiredMove: next.moveY,
        deltaTime: dt,
        config,
      }).move;
    }
    return next;
  }

  updateAxis({
    axis,
    desiredMove,
    deltaTime,
    config,
  } = {}) {
    const dt = Math.max(0, Number(deltaTime) || 0);
    const desired = Number.isFinite(Number(desiredMove))
      ? Number(desiredMove)
      : 0;
    const inertiaSeconds = Math.max(
      0,
      Number(config?.inertiaSeconds) || 0,
    );
    const key = axis === "x" ? "x" : "y";
    const desiredVelocity = dt > 0 ? desired / dt : 0;
    let velocity = key === "x" ? this.#velocityX : this.#velocityY;

    if (dt <= 0 || inertiaSeconds <= 0) {
      velocity = desiredVelocity;
    } else {
      const alpha = 1 - Math.exp(-dt / inertiaSeconds);
      velocity += (desiredVelocity - velocity) * alpha;
    }

    const actualMove = velocity * dt;
    if (key === "x") {
      this.#velocityX = velocity;
      this.#debug.desiredMoveX = desired;
      this.#debug.actualMoveX = actualMove;
      this.#debug.velocityX = velocity;
    } else {
      this.#velocityY = velocity;
      this.#debug.desiredMoveY = desired;
      this.#debug.actualMoveY = actualMove;
      this.#debug.velocityY = velocity;
    }
    this.#debug.inertiaSeconds = inertiaSeconds;
    this.#debug.enabled = inertiaSeconds > 0;
    return {
      move: actualMove,
      velocity,
      desiredVelocity,
      inertiaSeconds,
    };
  }

  reconcileAxis({
    axis,
    appliedMove = 0,
    deltaTime = 0,
    blocked = false,
  } = {}) {
    if (!blocked) return;
    const dt = Math.max(0, Number(deltaTime) || 0);
    const move = Number(appliedMove) || 0;
    const velocity = dt > 0 ? move / dt : 0;
    const key = axis === "x" ? "x" : "y";
    if (key === "x") {
      this.#velocityX = velocity;
      this.#debug.actualMoveX = move;
      this.#debug.velocityX = velocity;
      return;
    }
    this.#velocityY = velocity;
    this.#debug.actualMoveY = move;
    this.#debug.velocityY = velocity;
  }

  getDebugData() {
    return this.#debug;
  }

  reset() {
    this.#velocityX = 0;
    this.#velocityY = 0;
    this.#debug = this.#createDebug();
  }

  resetAxis(axis) {
    if (axis === "x") {
      this.#velocityX = 0;
      this.#debug.desiredMoveX = 0;
      this.#debug.actualMoveX = 0;
      this.#debug.velocityX = 0;
      return;
    }
    this.#velocityY = 0;
    this.#debug.desiredMoveY = 0;
    this.#debug.actualMoveY = 0;
    this.#debug.velocityY = 0;
  }

  #createDebug() {
    return {
      enabled: false,
      inertiaSeconds: 0,
      desiredMoveX: 0,
      actualMoveX: 0,
      desiredMoveY: 0,
      actualMoveY: 0,
      velocityX: 0,
      velocityY: 0,
    };
  }
}
