class VictoryActionGestureResolver {
  resolve({ input, entryGestureId, actions }) {
    if (!input?.pointerReleased || input.pointerReleaseCancelled === true) {
      return null;
    }

    const gestureId = Number(input.pointerGestureId);
    const boundary = Number(entryGestureId);
    if (!Number.isSafeInteger(gestureId) || !Number.isSafeInteger(boundary)) {
      return null;
    }
    if (gestureId <= boundary) return null;

    const pressedAction = this.#findAction(input.pointerStart, actions);
    if (!pressedAction) return null;

    const releasedAction = this.#findAction(input.pointerRelease, actions);
    return releasedAction === pressedAction ? releasedAction : null;
  }

  #findAction(point, actions) {
    if (!this.#isFinitePoint(point)) return null;
    if (this.#isPointInside(point, actions?.claim)) return "claim";
    if (this.#isPointInside(point, actions?.release)) return "release";
    return null;
  }

  #isFinitePoint(point) {
    return (
      Number.isFinite(Number(point?.x)) &&
      Number.isFinite(Number(point?.y))
    );
  }

  #isPointInside(point, rect) {
    if (!rect) return false;
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }
}
