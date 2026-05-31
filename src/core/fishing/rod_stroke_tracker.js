class RodStrokeTracker {
  calculate({
    previousFishY,
    currentFishY,
    pixelsPerMeter,
    towardPlayerYSign = 1,
  } = {}) {
    const scale = Math.max(1, Number(pixelsPerMeter) || 50);
    const previousY = Number(previousFishY);
    const currentY = Number(currentFishY);
    if (!Number.isFinite(previousY) || !Number.isFinite(currentY)) {
      return {
        yTowardMeters: 0,
        yAwayMeters: 0,
      };
    }

    const sign = Number(towardPlayerYSign) < 0 ? -1 : 1;
    const signedDeltaMeters = ((currentY - previousY) * sign) / scale;
    return {
      yTowardMeters: Math.max(0, signedDeltaMeters),
      yAwayMeters: Math.max(0, -signedDeltaMeters),
    };
  }

  resolveTowardPlayerYSign({ fishY, rodTipY } = {}) {
    const fish = Number(fishY);
    const rod = Number(rodTipY);
    if (!Number.isFinite(fish) || !Number.isFinite(rod)) return 1;
    return rod >= fish ? 1 : -1;
  }
}
