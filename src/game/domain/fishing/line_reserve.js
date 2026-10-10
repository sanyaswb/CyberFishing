// A line can still pay out: the line state's explicit flag, else more than 1 mm left on the spool.
export function hasLineReserve(lineState) {
  if (typeof lineState?.canReleaseLine === "boolean") return lineState.canReleaseLine;
  return (Number(lineState?.remainingMeters) || 0) > 0.001;
}
