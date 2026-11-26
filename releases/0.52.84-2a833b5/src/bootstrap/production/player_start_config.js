// Spec 184 D6 (TK-377): the player config a new player starts from — CONFIG.player as it is (production), or with a DEV
// start ({ equipment, assemblies, inventory, oneTimeGrants }) in place of its set: the DEV items, equipment and
// assemblies, and the DEV one-time grants after the production ones.
export function playerStartConfig(player, start = null) {
  if (!start) return player;
  return { ...player, equipment: start.equipment, assemblies: start.assemblies, inventory: start.inventory,
    oneTimeGrants: [...(player.oneTimeGrants || []), ...(start.oneTimeGrants || [])] };
}
