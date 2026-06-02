class DeviationsDebugModule extends ConsoleTableDebugModule {
  constructor() {
    super({ key: "deviations", title: "Force Deviations" });
  }

  render(context) {
    const live = context.live || {};
    const playerY = Number(live.playerForceY);
    const playerMaxY = Number(live.playerMaxPowerY);
    const playerX = Number(live.playerForceX);
    const playerMaxX = Number(live.playerMaxPowerX);
    const fishY = Number(live.fishForceY);
    const fishX = Number(live.fishForceX);

    console.table({
      "Y usage": Number.isFinite(playerY + playerMaxY)
        ? `${DebugFormatters.number((playerY / Math.max(0.001, playerMaxY)) * 100, 1)}%`
        : "n/a",
      "X usage": Number.isFinite(playerX + playerMaxX)
        ? `${DebugFormatters.number((playerX / Math.max(0.001, playerMaxX)) * 100, 1)}%`
        : "n/a",
      "Fish total force": Number.isFinite(fishY + fishX)
        ? DebugFormatters.number(Math.hypot(fishY, fishX), 3)
        : "n/a",
      "Player total force": Number.isFinite(playerY + playerX)
        ? DebugFormatters.number(Math.hypot(playerY, playerX), 3)
        : "n/a",
      "Live data source": live.gameState
        ? `debug-live-update (${live.gameState})`
        : "none",
    });
  }
}

window.DeviationsDebugModule = DeviationsDebugModule;
