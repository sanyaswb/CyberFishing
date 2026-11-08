// Line state queries shared by the fight stages and the DEV fight diagnostics.

// A line can still pay out: the line state's explicit flag, else more than 1 mm left on the spool.
export function hasLineReserve(lineState) {
  if (typeof lineState?.canReleaseLine === "boolean") return lineState.canReleaseLine;
  return (Number(lineState?.remainingMeters) || 0) > 0.001;
}

// The line is taut when at most 1 mm of released line is not yet out to the fish.
export function isLineTaut(lineState) {
  const recoverableLineMeters = Math.max(
    0,
    Number(lineState?.recoverableLineMeters) ||
      (
        (Number(lineState?.releasedMeters) || 0) -
        (Number(lineState?.distanceMeters) || 0)
      ),
  );
  return recoverableLineMeters <= 0.001;
}
