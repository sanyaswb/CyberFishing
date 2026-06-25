class OutcomeRenderFrameBuilder {
  #canvasMetrics;
  #clock;
  #styleResolver;
  #layoutResolver;
  #trophyFallbackColor = [145, 150, 160];
  #layoutContext = {
    width: 0,
    height: 0,
    config: null,
    statCount: 0,
  };

  constructor({
    canvasMetrics,
    clock,
    styleResolver,
    layoutResolver,
  }) {
    if (!styleResolver || typeof styleResolver.resolveVictory !== "function") {
      throw new TypeError(
        "OutcomeRenderFrameBuilder requires styleResolver",
      );
    }
    if (!layoutResolver || typeof layoutResolver.resolve !== "function") {
      throw new TypeError(
        "OutcomeRenderFrameBuilder requires layoutResolver",
      );
    }
    this.#canvasMetrics = canvasMetrics;
    this.#clock = clock;
    this.#styleResolver = styleResolver;
    this.#layoutResolver = layoutResolver;
  }

  buildInto({ target, intent }) {
    if (!intent.visible) return;
    target.visible = true;
    target.mode = intent.mode;
    if (intent.mode === "failed") {
      this.#buildGameOver(target.gameOver, intent.reason);
    } else if (intent.mode === "victory") {
      this.#buildVictory(target.victory, intent.fish || {});
    }
  }

  #buildGameOver(target, reason) {
    let title = "LINE SNAPPED";
    let titleColor = "#ff4444";
    let description = "Tension exceeded line capacity.";
    if (reason === "rod") {
      title = "ROD BROKEN";
      titleColor = "#ff0000";
      description = "Your rod could not handle the stress.";
    } else if (reason === "reel") {
      title = "REEL FAILED";
      titleColor = "#ff2200";
      description = "The reel was the weakest part of the rig.";
    } else if (reason === "leader") {
      title = "LEADER SNAPPED";
      titleColor = "#ff6644";
      description = "The leader was the weakest part of the rig.";
    } else if (reason === "hook" || reason === "net_escape") {
      title = "FISH ESCAPED";
      titleColor = "#ffaa00";
      description =
        reason === "net_escape"
          ? "The fish was too heavy and broke out of the net!"
          : "The hook bent and the fish got away.";
    }
    target.visible = true;
    target.width = this.#canvasMetrics.width;
    target.height = this.#canvasMetrics.height;
    target.title = title;
    target.titleColor = titleColor;
    target.description = description;
  }

  #buildVictory(target, source) {
    const fish = target.fish || (target.fish = {});
    const id = String(source.id || "unknown");
    const level = Number(source.level) || 1;
    const imagePath =
      source.imagePath ||
      `assets/fish/${id}/${id}--${level}.webp`;
    fish.id = id;
    fish.name = String(source.name || "Unknown fish");
    fish.level = level;
    fish.maxLevel = Number(source.maxLevel) || 0;
    fish.weight = Number(source.weight) || 0;
    fish.anomaly = String(source.anomaly || "none");
    fish.isTrophy = source.isTrophy === true;
    fish.isUnique = source.isUnique === true;
    const config = this.#styleResolver.resolveVictory();
    const stats = target.stats;
    this.#addStat(stats, `${fish.weight.toFixed(3)} kg`, null);
    this.#addStat(
      stats,
      fish.isTrophy ? "✓ Trophy" : "❌ Not trophy",
      fish.isTrophy ? null : this.#trophyFallbackColor,
    );
    this.#addStat(stats, `Anomaly: ${fish.anomaly}`, null);
    const extraStats = Array.isArray(source.victoryStats)
      ? source.victoryStats
      : [];
    for (let index = 0; index < extraStats.length; index += 1) {
      const stat = extraStats[index] || {};
      this.#addStat(
        stats,
        String(stat.label || stat.value || ""),
        stat.color || null,
      );
    }
    target.visible = true;
    target.width = this.#canvasMetrics.width;
    target.height = this.#canvasMetrics.height;
    target.nowMs = this.#clock.realNow ?? this.#clock.now;
    target.fish = fish;
    target.config = config;
    const layoutContext = this.#layoutContext;
    layoutContext.width = this.#canvasMetrics.width;
    layoutContext.height = this.#canvasMetrics.height;
    layoutContext.config = config;
    layoutContext.statCount = stats.count;
    target.layout = this.#layoutResolver.resolve(layoutContext);
    target.spriteId = ImageAssetProvider.assetIdForSource(imagePath, "fish");
    target.spritePath = imagePath;
  }

  #addStat(target, label, color) {
    const record = target.acquire();
    record.label = label;
    record.color = color;
  }
}
