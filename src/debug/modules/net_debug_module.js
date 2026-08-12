class NetDebugModule extends ConsoleTableDebugModule {
  constructor() {
    super({ key: "net", title: "Landing Net" });
  }

  render(context) {
    const eq = DebugDataSelectors.lastKnownEquipment(context);
    const fish = DebugDataSelectors.lastKnownFish(context);
    const net = eq.net || {};

    console.table({
      "Equipped net": net.name || net.id || "none",
      "Net active": net.active === true,
      "Quality grade": net.effectiveStats?.quality ?? "n/a",
      Fish: fish ? fish.name || fish.id : "n/a",
      "Fish weight": fish
        ? `${DebugFormatters.number(fish.weight, 3)} kg`
        : "n/a",
      "Last net roll": context.lastNetRoll
        ? `${context.lastNetRoll.roll.toFixed(1)} / ${context.lastNetRoll.chance}%`
        : "none",
      "Last net success": context.lastNetRoll
        ? context.lastNetRoll.success
        : "n/a",
    });
  }
}

window.NetDebugModule = NetDebugModule;
