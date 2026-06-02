class ForcesDebugModule extends ConsoleTableDebugModule {
  constructor() {
    super({ key: "forces", title: "Fight Forces" });
  }

  render(context) {
    const live = context.live || {};
    const fish = DebugDataSelectors.lastKnownFish(context);
    const eq = DebugDataSelectors.lastKnownEquipment(context);
    const rod = eq.rod || {};
    const reel = rod.hasReel === false ? null : eq.reel || {};

    console.table({
      Fish: fish
        ? `${fish.name || fish.id} / ${DebugFormatters.number(fish.weight, 3)} kg`
        : "n/a",
      "Fish state": live.fishState || "n/a",
      "Rod max load kg": DebugFormatters.number(
        DebugFormatters.equipmentPower(rod),
        3,
      ),
      "Reel max load kg": DebugFormatters.number(
        DebugFormatters.equipmentPower(reel),
        3,
      ),
      "Player force Y live": DebugFormatters.number(live.playerForceY, 3),
      "Player max Y live": DebugFormatters.number(live.playerMaxPowerY, 3),
      "Player force X live": DebugFormatters.number(live.playerForceX, 3),
      "Player max X live": DebugFormatters.number(live.playerMaxPowerX, 3),
      "Fish force Y live": DebugFormatters.number(live.fishForceY, 3),
      "Fish force X live": DebugFormatters.number(live.fishForceX, 3),
      "Fish base power live": DebugFormatters.number(live.fishBasePower, 3),
      "Fish initial power live": DebugFormatters.number(
        live.fishInitialPower,
        3,
      ),
      "Pull multiplier live": DebugFormatters.number(live.pullMult, 3),
      "Move multiplier live": DebugFormatters.number(live.moveMult, 3),
      "Active debuff": live.activeDebuffName || "n/a",
    });
  }
}

window.ForcesDebugModule = ForcesDebugModule;
