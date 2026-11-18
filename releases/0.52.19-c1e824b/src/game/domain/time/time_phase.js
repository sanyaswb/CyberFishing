// The time-of-day phase of a whole game hour (spec 180 stage F, TK-335): the game's environment and the DEV weather
// probes read the same rule. timePhases: { phase: { startHour, endHour } } (CONFIG.spawns.timePhases); a range with
// startHour > endHour passes midnight. Returns the last phase whose range holds the hour, or null when none does.
export function timePhaseAt(hour, timePhases) {
  let found = null;
  for (const [phase, times] of Object.entries(timePhases ?? {})) {
    const inRange = times.startHour < times.endHour
      ? hour >= times.startHour && hour < times.endHour
      : hour >= times.startHour || hour < times.endHour;
    if (inRange) found = phase;
  }
  return found;
}
