// Spec 181 D5: the DEV port of the player's statuses — what DevTools «СТАТУСИ» reads and does (no subscribe: DevTools
// redraws on its own buttons). TK-378.1: one function builds it for the game and for its checks, so the module is checked
// against the port it really gets (the level `stacks` was missing from the game's port while the check used the whole
// PlayerStatusEffects: DevTools broke on the first active status).
export function createPlayerStatusesDevPort(statuses) {
  return Object.freeze({
    list: () => statuses.list(),
    definition: (id) => statuses.definition(id),
    remainingSec: (id) => statuses.remainingSec(id),
    stacks: (id) => statuses.stacks(id),
    apply: (id, options) => statuses.apply(id, options),
    remove: (id) => statuses.remove(id),
    clear: () => statuses.clear(),
  });
}
