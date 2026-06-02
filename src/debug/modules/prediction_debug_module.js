class PredictionDebugModule extends ConsoleTableDebugModule {
  constructor() {
    super({ key: "prediction", title: "Bite Prediction" });
  }

  render(context) {
    const live = context.live || {};
    const chances = Array.isArray(live.liveChances) ? live.liveChances : [];
    if (!chances.length) {
      console.info("[prediction] No live bite chance data yet.");
      return;
    }

    console.table(
      chances.map((fish) => ({
        fish: fish.name,
        chance: fish.chance,
        base: fish.breakdown?.base,
        bait: fish.breakdown?.bait,
        time: fish.breakdown?.time,
        day: fish.breakdown?.day,
        depth: fish.breakdown?.depth,
        weather: fish.breakdown?.weather,
        zone: fish.breakdown?.zone,
        chum: fish.breakdown?.chum,
        spam: fish.breakdown?.spam,
        overDepth: fish.breakdown?.overDepth,
      })),
    );
  }
}

window.PredictionDebugModule = PredictionDebugModule;
