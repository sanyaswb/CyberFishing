class RarityAnimationResolver {
  resolvePulse(nowMs, durationMs) {
    const duration = Math.max(1, Number(durationMs) || 1200);
    const phase = (Number(nowMs || 0) / duration) * Math.PI * 2;
    return 0.5 + Math.sin(phase) * 0.5;
  }
}
