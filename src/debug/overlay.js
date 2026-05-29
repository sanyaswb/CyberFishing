const OVERLAY_MODULES = {
  echo: false,
  chancesDetail: false,
  state: true,
  chum: false,
  fishBase: false,
  fishStates: true,
  worstCase: false,
  playerMax: false,
  liveY: false,
  liveX: false,
  debuffsLive: false,
  fightPhysics: true,
};

class OverlayModule {
  constructor(key) {
    this.key = key;
  }

  isActive(data) {
    return OVERLAY_MODULES[this.key] && this.shouldRender(data);
  }

  shouldRender(data) {
    return true;
  }

  render(data) {
    return "";
  }

  formatHeader(title, color = "#00ccff") {
    return `<div style="color: ${color}; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px; text-transform: uppercase; font-size: 13px;">${title}</div>`;
  }

  metricRow(label, value, options = {}) {
    const metricKey = options.metricKey || label;
    const color = options.color || "#8a9bac";

    return `<div class="debug-overlay-row" data-overlay-metric="${this.escapeAttr(metricKey)}">
      <span class="debug-overlay-label">
        <button
          type="button"
          class="overlay-metric-info-btn"
          data-metric="${this.escapeAttr(metricKey)}"
          title="Пояснити формулу"
          aria-label="Пояснити формулу для ${this.escapeAttr(label)}"
        ></button>
        ${label}:
      </span>
      <span class="debug-overlay-value" style="color:${this.escapeAttr(color)};">${value}</span>
    </div>`;
  }

  escapeAttr(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  getStateColor(state) {
    const colors = {
      dash: "#ff4444",
      lastdash: "#ff00ff",
      panic: "#ff0055",
      megadash: "#ff2222",
      surrender: "#888888",
      swim: "#ffaa00",
      rest: "#00ff80",
      idle: "#00ccff",
    };
    return colors[state?.toLowerCase()] || "#8a9bac";
  }
}

class EchoModule extends OverlayModule {
  constructor() {
    super("echo");
  }

  shouldRender(d) {
    return ["scouting", "waiting", "biting"].includes(d.gameState);
  }

  render(d) {
    let html = this.formatHeader("📡 ЕХОЛОТ", "#00ff80");
    const stateText = d.isBoatSonar ? "СКАНУВАННЯ (КОРАБЛИК)" : d.gameState;

    html += `<div style="margin-bottom: 4px;">Стан: <span style="color: #00ccff; text-transform: uppercase;">${stateText}</span></div>`;

    if (d.gameState !== "scouting" || d.isBoatSonar) {
      html += `<div style="margin-bottom: 4px;">`;
      if (d.isBoatSonar) {
        html += `Дно під корабликом: <span style="color: #ffaa00;">${d.bottomDepth ? d.bottomDepth.toFixed(2) : 0} м</span>`;
      } else {
        html += `Гачок: <span style="color: #ffaa00;">${d.hookDepth ? d.hookDepth.toFixed(2) : 0} м</span> / 
        Дно: <span style="color: #ffaa00;">${d.bottomDepth ? d.bottomDepth.toFixed(2) : 0} м</span> / 
        Ліска: <span style="color: #00ccff;">${d.lineLength ? d.lineLength.toFixed(2) : 0} м</span>`;
      }
      html += `</div>`;

      const baitsText = Array.isArray(d.baits)
        ? d.baits.join(", ")
        : d.bait || "---";
      html += `<div style="margin-bottom: 4px;">Наживка: <span style="color: #b066ff;">${baitsText}</span></div>`;

      html += `<div style="margin-bottom: 8px;">Фаза: <span style="color: #ffff00;">${d.phase || "---"}</span></div>`;

      let weather = d.isRaining
        ? "🌧️ Дощ "
        : d.isFoggy
          ? "🌫️ Туман"
          : "☀️ Ясно";
      html += `<div style="margin-bottom: 8px;">Погода: <span style="color: #00ccff;">${weather}</span></div>`;

      if (d.liveChances?.length > 0) {
        html += `<div style="color: #8a9bac; font-size: 12px; margin-bottom: 4px;">Шанси кльову:</div>`;
        d.liveChances.forEach((f) => {
          html += `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>${f.name}</span><span style="color: #00ff80; font-weight: bold;">${f.chance}</span>
          </div>`;
        });
      }
    } else {
      html += `<div style="color: #8a9bac; margin-bottom: 4px;">Закиньте вудку для аналізу...</div>`;
    }
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }
}

class BehaviorModule extends OverlayModule {
  constructor() {
    super("state");
  }

  shouldRender(d) {
    return d.gameState === "playing" && d.hookedFish;
  }

  render(d) {
    const color = this.getStateColor(d.fishState);
    let html = this.formatHeader(
      `🧠 ПОВЕДІНКА (${d.hookedFish.name || "Риба"})`,
    );

    // Основні параметри поведінки
    html += `<div style="margin-bottom: 4px;">Стан: <span style="color: ${color}; text-transform: uppercase; font-weight: bold;">${d.fishState || "---"}</span></div>`;
    html += `<div style="margin-bottom: 4px;">Множник Тяги (Y): <span style="color: ${color};">x${(d.pullMult || 0).toFixed(2)}</span></div>`;
    html += `<div style="margin-bottom: 4px;">Множник Втечі (X): <span style="color: ${color};">x${(d.moveMult || 0).toFixed(2)}</span></div>`;

    // --- НОВИЙ БЛОК: Прикормка для цієї риби ---
    if (d.chumZones && d.chumZones.length > 0) {
      // Шукаємо зони, які націлені на ID цієї риби
      const activeBonus = d.chumZones
        .filter(
          (z) =>
            !z.isExpired && z.baitConfig?.targets?.includes(d.hookedFish.id),
        )
        .reduce((max, z) => Math.max(max, z.currentBonus || 1), 1.0);

      if (activeBonus > 1) {
        html += `<div style="margin-top: 6px; padding-top: 4px; border-top: 1px dashed #4a5b6c;">`;
        html += `<span style="color: #ffff00;">🧲 БОНУС ПРИКОРМКИ:</span> <span style="color: #00ff80; font-weight: bold;">x${activeBonus.toFixed(2)}</span>`;
        html += `</div>`;
      } else {
        html += `<div style="margin-top: 6px; color: #8a9bac; font-size: 11px;">Прикормка не впливає на цей вид</div>`;
      }
    }

    return html + `<div style="margin-bottom: 12px;"></div>`;
  }
}

class FishPowerModule extends OverlayModule {
  constructor() {
    super("fishBase");
  }

  shouldRender(d) {
    return d.gameState === "playing";
  }

  render(d) {
    const initial = d.fishInitialPower || 0;
    const current = d.fishBasePower || 0;
    const lost = initial - current;

    let html = this.formatHeader("🔥 ПОТОЧНА БАЗОВА СИЛА РИБИ", "#ffaa00");
    html += `<div style="margin-bottom: 4px;">Початкова база: <span style="color: #8a9bac;">${initial.toFixed(2)}</span></div>`;
    html += `<div style="margin-bottom: 4px;">Втрачено (Виснаження): <span style="color: #ff4444; font-weight: bold;">-${lost.toFixed(2)}</span></div>`;
    html += `<div style="margin-bottom: 12px; font-size: 16px;">Поточна: <span style="color: #00ff80; font-weight: bold;">${current.toFixed(2)}</span></div>`;
    return html;
  }
}

class FishStatesModule extends OverlayModule {
  constructor() {
    super("fishStates");
  }

  shouldRender(d) {
    return (
      d.gameState === "playing" &&
      (d.hookedFish?.physics?.behaviors ||
        d.hookedFish?.physics?.behaviorProfile?.behaviors)
    );
  }

  render(d) {
    let html = this.formatHeader("📊 СИЛА РИБИ ЗА СТАНАМИ");
    const behaviors =
      d.hookedFish.physics.behaviors ||
      d.hookedFish.physics.behaviorProfile?.behaviors ||
      {};
    const basePower = d.fishBasePower || 0;

    for (const [name, cfg] of Object.entries(behaviors)) {
      const color = this.getStateColor(name);
      const forceMultiplier = Number(cfg.forceMultiplier ?? 1) || 1;
      const speedMultiplier = Number(cfg.speedMultiplier ?? 0) || 0;
      const stateForceKg = basePower * forceMultiplier;

      html += `<div style="margin-bottom: 2px; display: flex; justify-content: space-between; font-size: 12px;">
                <span style="color: ${color}; font-weight: bold;">${name.toUpperCase()}</span>
                <span style="color: #e6e6e6;">kg: <span style="color: ${color}; font-weight: bold;">${stateForceKg.toFixed(3)}</span> | speed: <span style="color: ${color}; font-weight: bold;">${speedMultiplier.toFixed(2)}</span></span>
              </div>`;
    }
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }
}

class DebuffsModule extends OverlayModule {
  constructor() {
    super("debuffsLive");
  }

  shouldRender(d) {
    return d.gameState === "playing";
  }

  render(d) {
    let html = this.formatHeader("☠️ АКТИВНІ ДЕБАФИ", "#ff00ff");

    // Секція рандомних дебафів
    const debuffName = d.activeDebuffName || "Немає";
    let debuffDesc = '<span style="color: #8a9bac;">фаза 2 ще ціла</span>';

    if (debuffName !== "Немає") {
      const sColor = this.getStateColor(d.fishState);
      debuffDesc = `<span style="color: ${sColor}; font-weight: bold;">[${d.fishState?.toUpperCase()}]</span> <span style="color: #ffaa00; font-size: 11px;">${debuffName}</span>`;
    }

    html += `<div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;"><span>Рандом:</span> <span>${debuffDesc}</span></div>`;

    // Секція Майстерності (Mastery)
    html += `<div style="margin-bottom: 2px;"><span>Майстерність:</span></div>`;

    const mRatio = CONFIG.stamina.mechanics.masteryTimeRatio || 0.5;
    const targetMs = (d.exhaustionDurationMs || 1000) * mRatio;
    const curTimer = d.masteryTimerMs || 0;
    const curMult = d.masteryCurrentMult || 1.0;

    let mHtml = "";
    if (curTimer === 0 && curMult === 1.0) {
      mHtml = `<span style="color: #8a9bac;">Тримайте по центру...</span>`;
    } else if (!d.isMasteryActive) {
      const pct = Math.min(100, (curTimer / targetMs) * 100);
      mHtml = `<div style="color: #00ccff; font-size: 11px; font-weight: bold;">[ФАЗА 1] Утримання: ${pct.toFixed(0)}%</div>`;
    } else {
      const pLost = ((1 - curMult) * 100).toFixed(1);
      mHtml = `<div style="color: #ff4444; font-size: 11px; font-weight: bold;">[ФАЗА 2] Здавлювання: ВПАЛА НА -${pLost}%</div>`;
    }

    html += `<div style="background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; border-left: 3px solid #ff00ff;">${mHtml}</div>`;
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }
}

class PlayerMaxModule extends OverlayModule {
  constructor() {
    super("playerMax");
  }

  shouldRender(d) {
    return d.gameState === "playing";
  }

  render(d) {
    let html = this.formatHeader("📊 СИЛА ГРАВЦЯ", "#00ff80");
    html += `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span>ЛІМІТ СНАСТІ:</span> <span style="color: #00ff80; font-weight: bold;">${(d.maxTackleLoadKg || d.playerMaxPowerY || 0).toFixed(3)} кг</span></div>`;
    html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Rod hold:</span><span style="color:#00ff80;">${(d.rodPullForceKg || 0).toFixed(3)}kg</span></div>`;
    html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Simple speed:</span><span style="color:#00ff80;">${(d.simpleFightSpeedMps || 0).toFixed(2)}m/s</span></div>`;
    if (d.dragSupported) {
      html += `<div style="display: flex; justify-content: space-between; margin-bottom: 12px;"><span>ФРИКЦІОН:</span> <span style="color: #00ccff; font-weight: bold;">${(d.dragLimitKg || 0).toFixed(3)} кг</span></div>`;
    }
    return html;
  }
}

class FightPhysicsModule extends OverlayModule {
  constructor() {
    super("fightPhysics");
  }

  shouldRender(d) {
    return d.gameState === "playing";
  }

  render(d) {
    const lineRemaining = Math.max(0, Number(d.lineRemainingMeters) || 0);
    const lineMaxRemaining = Math.max(0, Number(d.lineMaxRemainingMeters) || 0);
    const rodStrokeUsed = Math.max(
      0,
      Number(d.rodStrokeUnrecoveredMeters) || 0,
    );
    const rodStrokeCapacity = Math.max(
      0,
      Number(d.rodStrokeCapacityMeters) || 0,
    );

    return this.#renderSimpleFightSections({
      ...d,
      lineRemaining,
      lineMaxRemaining,
      rodStrokeUsed,
      rodStrokeCapacity,
    });
  }

  #renderSimpleFightSections(d) {
    let html = this.formatHeader("FIGHT PHYSICS", "#73c2fb");
    html += this.#section("FISH", [
      this.#row("Fish weight", this.#kg(d.fishWeightKg, 3)),
      this.#row("Water weight / passive force", this.#kg(d.fishPassiveKg, 3), "#ffaa00"),
      this.#row("State force multiplier", `x${this.#num(d.fishStateForceMultiplier ?? d.pullMult, 2)}`),
      this.#row("Direction multiplier", `x${this.#num(d.directionResistanceMultiplier, 2)}`),
      this.#row("Active fish force", this.#kg(d.fishActiveKg, 3), "#ff8888"),
      this.#row("Fish opposition", this.#kg(d.fishOppositionKg, 3), "#ff8888"),
    ]);
    html += this.#section("ROD HOLD", [
      this.#row("Rod hold", this.#kg(d.rodPullForceKg, 3), "#00ff80"),
      this.#row("Rod hold max", this.#kg(d.rodHoldMaxKg, 3), "#ffaa00"),
      this.#row("Rod stroke", `${this.#meters(d.rodStrokeUsed, 2)} / ${this.#meters(d.rodStrokeCapacity, 2)}`),
      this.#row("Angle multiplier", `x${this.#num(d.anglePenalty || 1, 2)}`),
      this.#row("Effective rod hold", this.#kg(d.effectiveRodHoldKg, 3), "#00ff80"),
      this.#row("Hold tension ratio", this.#percent(d.holdTensionRatio, 1)),
      this.#row("Raw hold tension", this.#kg(d.rawPlayerHoldTensionKg, 3), "#00ff80"),
      this.#row("Movable tension cap", this.#kg(d.movableHoldTensionCapKg, 3), "#73c2fb"),
      this.#row("Hold to tension", this.#kg(d.playerHoldTensionKg, 3), "#00ff80"),
    ]);
    html += this.#section("REEL HOLD", this.#reelHoldRows(d));
    html += this.#section("DRAG / Y ESCAPE", this.#dragRows(d));
    html += this.#section("MOVEMENT", [
      this.#row("Net force", this.#kg(d.netForceKg, 3), this.#netForceColor(d.netForceKg)),
      this.#row("Winner", this.#winner(d.netForceKg), this.#netForceColor(d.netForceKg)),
      this.#row("Water resistance", this.#num(d.waterMotionResistance, 1)),
      this.#row("Speed multiplier", `x${this.#num(d.waterSpeedMultiplier, 2)}`),
      this.#row("Speed m/s", this.#mps(d.simpleFightSpeedMps, 3), "#73c2fb"),
      this.#row("Speed px/s", `${this.#num(d.simpleFightSpeedPxPerSec ?? d.fishSpeedPxPerSec, 1)}px/s`, "#73c2fb"),
    ]);
    html += this.#section("TENSION", [
      this.#row("Fish tension", this.#kg(d.fishTensionKg, 3), "#ff8888"),
      this.#row("Player tension", this.#kg(d.playerHoldTensionKg, 3), "#00ff80"),
      this.#row("Total tension", this.#kg(d.totalTensionKg ?? d.calculatedTensionKg, 3), "#ffaa00"),
      this.#row("Rod stress", this.#percent(d.rodStressRatio, 1), this.#stressColor(d.rodStressRatio)),
      this.#row("Line stress", this.#percent(d.lineStressRatio, 1), this.#stressColor(d.lineStressRatio)),
      this.#row("Hook stress", this.#percent(d.hookStressRatio, 1), this.#stressColor(d.hookStressRatio)),
    ]);
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }


  #dragRows(d) {
    const dragRatio = Number(d.dragRatio) || 0;
    const dragLimitKg = Number(d.effectiveDragLimitKg ?? d.dragLimitKg) || 0;
    const fishWonYForceKg = Number(d.fishWonYForceKg) || 0;
    const yEscapeForceKg = Number(d.yEscapeForceKg ?? d.excessYForceKg) || 0;
    const finalYSpeed = Number(d.finalYSpeedPxPerSec) || 0;
    const shouldSlip = !!d.shouldSlipDrag;
    const canHoldY = fishWonYForceKg <= dragLimitKg + 0.000001 && dragRatio > 0;
    return [
      this.#row("Drag ratio", this.#percent(dragRatio, 1)),
      this.#row("Drag limit", this.#kg(dragLimitKg, 3), "#00ccff"),
      this.#row("Fish won Y force", this.#kg(fishWonYForceKg, 3), "#ff8888"),
      this.#row("Drag blocked force", this.#kg(d.dragBlockedForceKg, 3), "#ffaa00"),
      this.#row("Y escape force", this.#kg(yEscapeForceKg, 3), yEscapeForceKg > 0 ? "#ff8888" : "#00ff80"),
      this.#row("Final X speed", `${this.#num(d.finalXSpeedPxPerSec, 1)}px/s`, "#73c2fb"),
      this.#row("Final Y speed", `${this.#num(finalYSpeed, 1)}px/s`, finalYSpeed === 0 ? "#00ff80" : "#ff8888"),
      this.#row("Drag state", shouldSlip ? "SLIPPING" : canHoldY ? "HOLDING_Y" : "OPEN/NO_Y", shouldSlip ? "#ff8888" : "#00ff80"),
    ];
  }

  #reelHoldRows(d) {
    const reelLimit = Number(d.holdReelRecoverReelMaxLoadKg) || 0;
    const totalTension = Number(d.totalTensionKg ?? d.calculatedTensionKg) || 0;
    const safeMarginKg = Math.max(0, reelLimit - totalTension);
    const reason = d.holdReelRecoverBlockedReason || "not_checked";
    const active = !!d.holdReelRecoverActive;
    const eligible = !!d.holdReelRecoverEligible;
    const state = active ? "YES" : eligible ? "WAIT" : "NO";
    const color = active ? "#00ff80" : eligible ? "#ffaa00" : "#8a9bac";

    return [
      this.#row("Reel hold active", state, color),
      this.#row("Reel safe margin", this.#kg(safeMarginKg, 3), safeMarginKg > 0 ? "#00ff80" : "#ff8888"),
      this.#row("Reel hold limit", this.#kg(reelLimit, 3)),
      this.#row("Reel retrieve speed", this.#mps(d.holdReelRecoverSpeedMps, 3), "#00ff80"),
      this.#row("Reel blocked reason", reason, active ? "#00ff80" : "#8a9bac"),
    ];
  }

  #winner(netForceKg) {
    const force = Number(netForceKg) || 0;
    if (force > 0.001) return "Player";
    if (force < -0.001) return "Fish";
    return "Balanced";
  }

  #netForceColor(netForceKg) {
    const force = Number(netForceKg) || 0;
    if (force > 0.001) return "#00ff80";
    if (force < -0.001) return "#ff8888";
    return "#ffaa00";
  }

  #stressColor(ratio) {
    const value = Number(ratio) || 0;
    if (value >= 1) return "#ff4444";
    if (value >= 0.8) return "#ffaa00";
    return "#00ff80";
  }

  #section(title, rows) {
    const body = rows.filter(Boolean).join("");
    return `<div style="margin-bottom:10px; background:rgba(0,0,0,0.22); border-left:3px solid #73c2fb; padding:6px; border-radius:4px;">
      <div style="color:#73c2fb; font-weight:bold; margin-bottom:5px; font-size:12px; text-transform:uppercase;">${title}</div>
      ${body}
    </div>`;
  }

  #row(label, value, color = "#8a9bac") {
    return this.metricRow(label, value, { color });
  }

  #kg(value, digits = 3) {
    return `${this.#num(value, digits)}кг`;
  }

  #kgPerKg(value) {
    return `${this.#num(value, 3)}кг/кг`;
  }

  #kgPerKgMps(value) {
    return `${this.#num(value, 3)}кг/кг/м·с⁻¹`;
  }

  #meters(value, digits = 2) {
    return `${this.#num(value, digits)}м`;
  }

  #mps(value, digits = 2) {
    return `${this.#num(value, digits)}м/с`;
  }

  #seconds(valueMs) {
    return `${this.#num((Number(valueMs) || 0) / 1000, 1)}с`;
  }

  #percent(value, digits = 1) {
    return `${this.#num((Number(value) || 0) * 100, digits)}%`;
  }

  #num(value, digits = 2) {
    const parsed = Number(value);
    return (Number.isFinite(parsed) ? parsed : 0).toFixed(digits);
  }
}

class LiveForcesModule extends OverlayModule {
  constructor() {
    super("liveY");
  }

  shouldRender(d) {
    return d.gameState === "playing";
  }

  render(d) {
    const pY = d.playerForceY || 0,
      fY = d.fishForceY || 0;
    const pX = d.playerForceX || 0,
      fX = d.fishForceX || 0;

    let html = "";

    // Блок Y (Тяга)
    if (OVERLAY_MODULES.liveY) {
      const yTotal = pY + fY || 1;
      const yDiff = Math.abs((pY / yTotal) * 100 - (fY / yTotal) * 100).toFixed(
        1,
      );
      const yLead =
        fY > pY
          ? `<span style="color: #ff4444;">🚨 Риба тягне сильніше на ${yDiff}%</span>`
          : `<span style="color: #00ff80;">💪 Гравець тягне сильніше на ${yDiff}%</span>`;

      html += this.formatHeader("⚖️ LIVE: ТЯГА (Y)");
      html += `<div style="margin-bottom: 4px;">Гравець: <span style="color: #00ff80;">${pY.toFixed(3)}</span> | Риба: <span style="color: #ff4444;">${fY.toFixed(3)}</span></div>`;
      html += `<div style="font-weight: bold; font-size: 13px; margin-bottom: 12px;">${yLead}</div>`;
    }

    // Блок X (Керування)
    if (OVERLAY_MODULES.liveX) {
      const xLead =
        fX > pX
          ? `<span style="color: #ff4444;">🚨 Риба втікає (Домінує)</span>`
          : `<span style="color: #00ff80;">✅ Керування стабільне</span>`;

      html += this.formatHeader("⚖️ LIVE: КЕРУВАННЯ (X)");
      html += `<div style="margin-bottom: 4px;">Гравець: <span style="color: #00ff80;">${pX.toFixed(3)}</span> | Риба: <span style="color: #ff4444;">${fX.toFixed(3)}</span></div>`;
      html += `<div style="font-weight: bold; font-size: 13px; margin-bottom: 12px;">${xLead}</div>`;
    }

    return html;
  }
}

class ChancesDetailModule extends OverlayModule {
  constructor() {
    super("chancesDetail");
  }

  shouldRender(d) {
    return (
      (d.gameState === "scouting" ||
        d.gameState === "waiting" ||
        d.gameState === "biting") &&
      d.liveChances?.length > 0
    );
  }

  render(d) {
    let html = this.formatHeader("🧮 РОЗРАХУНОК ШАНСІВ", "#b066ff");
    const godMode =
      typeof CONFIG !== "undefined" ? CONFIG.debug?.godMode : null;
    if (godMode?.enabled) {
      const biteMode = godMode.biteSequenceMode || "default";
      if (godMode.fixedBiteChanceEnabled) {
        const fixedPercent = Math.max(
          0,
          Math.min(100, Number(godMode.fixedBiteChancePercent) || 0),
        );
        html += `<div style="margin-bottom:6px; color:#00ff80; font-size:11px;">GOD Bite Chance: ${fixedPercent.toFixed(0)}% · Mode: ${biteMode}</div>`;
      } else if (biteMode !== "default") {
        html += `<div style="margin-bottom:6px; color:#00ff80; font-size:11px;">GOD Bite Mode: ${biteMode}</div>`;
      }
    }
    d.liveChances.forEach((fish) => {
      const b = fish.breakdown || {};
      const chumColor = parseFloat(b.chum) > 1.0 ? "#00ff80" : "#ddd";

      html += `<div style="margin-bottom: 8px; background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; border-left: 3px solid #b066ff;">`;
      html += `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: #fff; font-weight: bold;">${fish.name}</span>
                <span style="color: #00ff80; font-weight: bold;">${fish.chance}</span>
              </div>`;

      html += `<div style="color: #8a9bac; font-size: 11px; line-height: 1.4; display: grid; grid-template-columns: 1fr 1fr;">
                <span>База: <span style="color:#ddd">${b.base}</span></span>
                <span>Наживка: <span style="color:#ddd">x${b.bait}</span></span>
                <span>Час: <span style="color:#ddd">x${b.time}</span></span>
                <span>День: <span style="color:#ddd">x${b.day}</span></span>
                <span>Глибина: <span style="color:#ddd">x${b.depth}</span></span>
                <span>Погода: <span style="color:#ddd">x${b.weather}</span></span>
                <span>Зона: <span style="color:#ddd">x${b.zone}</span></span>
                <span>Прикормка: <span style="color:${chumColor}; font-weight: bold;">x${b.chum || "1.00"}</span></span>
                <span>Спам: <span style="color:${b.spam < 1 ? "#ff4444" : "#ddd"}">x${b.spam}</span></span>
                <span style="grid-column: span 2;">Лежачий поплавок: <span style="color:${b.overDepth < 1 ? "#ff4444" : "#ddd"}">x${b.overDepth}</span></span>
              </div></div>`;
    });
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }
}

class ChumOverlayModule extends OverlayModule {
  constructor() {
    super("chum");
  }
  shouldRender(d) {
    return d.chumZones?.length > 0;
  }
  render(d) {
    let html = this.formatHeader("🧲 АКТИВНІ ПРИКОРМКИ", "#ffff00");
    d.chumZones.forEach((z, idx) => {
      const color = z.isExpired ? "#888" : "#00ff80";
      html += `<div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px;">
                <span>Зона ${idx + 1}:</span>
                <span style="color: ${color}; font-weight: bold;">x${(z.currentBonus || 1).toFixed(2)}</span>
               </div>`;
    });
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }
}

class WorstCaseModule extends OverlayModule {
  constructor() {
    super("worstCase");
  }

  shouldRender(d) {
    return d.gameState === "playing" && d.hookedFish;
  }

  render(d) {
    const activeFish = d.hookedFish;
    const behaviors = activeFish.physics?.behaviorProfile?.behaviors || {};
    const currentFishBase = d.fishPassiveKg || d.fishBasePower || 0;

    let maxPull = 0,
      maxMove = 0;
    Object.values(behaviors).forEach((b) => {
      const forceMultiplier = b.forceMultiplier ?? 0;
      const speedMultiplier = b.speedMultiplier ?? 0;
      if (forceMultiplier > maxPull) maxPull = forceMultiplier;
      const effMove = Math.abs(speedMultiplier);
      if (effMove > maxMove) maxMove = effMove;
    });

    const maxPossibleForceY = currentFishBase * maxPull;
    const worstFishX = currentFishBase * maxMove;

    const eq = d.equipment || d.eq || {};
    const effectiveLoad = (item, fallback = 0) => {
      const maxLoad = Number(item?.maxLoadKg ?? fallback);
      const durability = Number(item?.durability ?? 100);
      const lossPerPercent = Number(
        item?.durabilityMaxLoadLossPerPercent ?? 0.001,
      );
      if (!Number.isFinite(maxLoad) || maxLoad <= 0) return fallback;
      return (
        maxLoad *
        Math.max(0.1, 1 - Math.max(0, 100 - durability) * lossPerPercent)
      );
    };
    const loads = [];
    const pushLoad = (value) => {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) loads.push(n);
    };
    pushLoad(effectiveLoad(eq.rod, 0));
    const hasReel = eq.rod?.hasReel !== false && !!eq.reel;
    if (hasReel) {
      pushLoad(effectiveLoad(eq.reel, 0));
      pushLoad(effectiveLoad(eq.reel?.line, 0));
    } else {
      pushLoad(
        CONFIG.fightPhysicsConfig?.getLineConfig?.()?.defaultMaxLoadKg ??
          0,
      );
    }
    const pPower = loads.length ? Math.min(...loads) : 0;

    const angleCfg =
      CONFIG.fightPhysicsConfig?.getRodAnglePenaltyConfig?.() ||
      {};
    const worstPenaltyMult =
      angleCfg.enabled === false
        ? 1.0
        : (angleCfg.maxPenaltyMultiplier ?? 0.65);
    const worstPlayerY = pPower * worstPenaltyMult;
    const playerSteerMin =
      pPower *
      worstPenaltyMult *
      (
        CONFIG.fightPhysicsConfig?.getPlayerSteeringMultiplier?.() ??
        1.5
      );

    let html = this.formatHeader("💀 НАЙГІРШІ УМОВИ (КУТ)", "#ff4444");
    html += `<div style="color: #8a9bac; font-size: 12px; margin-bottom: 4px;">Максимальна тяга X:</div>
             <div style="margin-bottom: 2px; display: flex; justify-content: space-between;"><span>Риба:</span> <span style="color: #ff4444; font-weight: bold;">${worstFishX.toFixed(3)}</span></div>
             <div style="margin-bottom: 8px; display: flex; justify-content: space-between;"><span>Гравець:</span> <span style="color: #ffaa00; font-weight: bold;">${playerSteerMin.toFixed(3)}</span></div>`;

    html += `<div style="color: #8a9bac; font-size: 12px; margin-bottom: 4px;">Максимальна тяга Y:</div>
             <div style="margin-bottom: 2px; display: flex; justify-content: space-between;"><span>Риба:</span> <span style="color: #ff4444; font-weight: bold;">${maxPossibleForceY.toFixed(3)}</span></div>
             <div style="margin-bottom: 12px; display: flex; justify-content: space-between;"><span>Гравець:</span> <span style="color: #ffaa00; font-weight: bold;">${worstPlayerY.toFixed(3)}</span></div>`;

    return html;
  }
}

class DebugOverlay {
  #container;
  #content;
  #intervalId;
  #data = {};
  #userScale = 1.0;
  #modules = [];
  #lastHtml = "";

  constructor() {
    this.#initModules();
    this.#initDOM();
    this.#initListener();
    this.#start();
  }

  #initModules() {
    this.#modules = [
      new EchoModule(),
      new ChancesDetailModule(),
      new BehaviorModule(),
      new FishPowerModule(),
      new FishStatesModule(),
      new DebuffsModule(),
      new FightPhysicsModule(),
      new PlayerMaxModule(),
      new LiveForcesModule(),
      new ChumOverlayModule(),
    ];
  }

  #initDOM() {
    this.#container = document.createElement("div");
    this.#container.id = "debugOverlay";
    this.#container.className = "debug-overlay";
    this.#container.style.cssText = `
      position: absolute; bottom: 10px; left: 10px; 
      background: rgba(11, 21, 32, 0.95); color: #ffffff; 
      padding: 15px 15px 50px 15px; font-family: monospace; 
      font-size: 14px; border: 1px solid #4a5b6c; border-radius: 8px; 
      z-index: 10000; display: none; box-shadow: 0 4px 15px rgba(0,0,0,0.6); 
      min-width: 280px; transform-origin: bottom left; 
      touch-action: none; pointer-events: all;
    `;

    if (typeof UIUtils !== "undefined" && UIUtils.makeSolid) {
      UIUtils.makeSolid(this.#container);
    }

    this.#content = document.createElement("div");
    this.#content.className = "debug-overlay-content";
    this.#content.style.pointerEvents = "none";
    this.#container.appendChild(this.#content);

    const controlsDiv = document.createElement("div");
    controlsDiv.style.cssText = `
      position: absolute; bottom: 10px; left: 50%; 
      transform: translateX(-50%); display: flex; gap: 15px; 
      z-index: 10001; pointer-events: all;
    `;

    const btnMinus = document.createElement("button");
    btnMinus.innerHTML = "-";
    this.#styleZoomBtn(btnMinus);

    const btnPlus = document.createElement("button");
    btnPlus.innerHTML = "+";
    this.#styleZoomBtn(btnPlus);

    const handleZoom = (e, delta) => {
      e.preventDefault();
      e.stopPropagation();
      this.#userScale = Math.max(0.3, Math.min(3.0, this.#userScale + delta));
      this.#forceScaleUpdate();
    };

    [
      { btn: btnMinus, d: -0.1 },
      { btn: btnPlus, d: 0.1 },
    ].forEach(({ btn, d }) => {
      btn.addEventListener("pointerdown", (e) => handleZoom(e, d), {
        capture: true,
      });
    });

    controlsDiv.append(btnMinus, btnPlus);
    this.#container.appendChild(controlsDiv);
    document.body.appendChild(this.#container);
    this.#installOverlayStyles();

    if (
      typeof UIDraggableButton !== "undefined" &&
      typeof CONFIG !== "undefined"
    ) {
      new UIDraggableButton(this.#container, null, CONFIG, {
        id: "debug_overlay",
        noTransform: true,
      });
    }
  }

  #styleZoomBtn(btn) {
    Object.assign(btn.style, {
      width: "32px",
      height: "32px",
      backgroundColor: "rgba(0, 204, 255, 0.1)",
      color: "#00ccff",
      border: "1px solid #00ccff",
      borderRadius: "6px",
      fontFamily: "monospace",
      fontWeight: "bold",
      fontSize: "20px",
      cursor: "pointer",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      touchAction: "none",
    });
  }

  #initListener() {
    document.addEventListener("debug-live-update", (e) => {
      this.#data = e.detail;
      if (this.#container.style.display === "none") {
        this.#container.style.display = "block";
      }
    });
  }

  #installOverlayStyles() {
    if (document.getElementById("debug-overlay-styles")) return;

    const style = document.createElement("style");
    style.id = "debug-overlay-styles";
    style.textContent = `
      .debug-overlay-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 2px;
        font-size: 12px;
      }
      .debug-overlay-label {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        min-height: 16px;
        line-height: 1.2;
      }
      .debug-overlay-value {
        font-weight: bold;
        text-align: right;
      }
      .overlay-metric-info-btn {
        width: 14px;
        height: 14px;
        min-width: 14px;
        flex: 0 0 14px;
        box-sizing: border-box;
        padding: 0;
        border-radius: 4px;
        border: 1px solid rgba(115, 194, 251, 0.9);
        background: rgba(115, 194, 251, 0.12);
        box-shadow: 0 0 5px rgba(115, 194, 251, 0.35);
        cursor: pointer;
        pointer-events: auto;
        touch-action: none;
        transform: translateZ(0);
        transition: none;
        outline: none;
        -webkit-tap-highlight-color: transparent;
      }
      .overlay-metric-info-btn:hover {
        background: rgba(115, 194, 251, 0.12);
        border-color: rgba(115, 194, 251, 0.9);
        box-shadow: 0 0 5px rgba(115, 194, 251, 0.35);
      }
      .overlay-metric-info-btn-active,
      .overlay-metric-info-btn:active {
        background: rgba(255, 255, 255, 0.85);
        border-color: #ffffff;
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.9);
      }
    `;
    document.head.appendChild(style);
  }

  #forceScaleUpdate() {
    this.#container.style.transform = `scale(${this.#userScale})`;
  }

  #update() {
    if (typeof CONFIG === "undefined" || !CONFIG.debug?.overlay) {
      this.#container.style.display = "none";
      return;
    }

    const html = this.#modules
      .filter((m) => m.isActive(this.#data))
      .map((m) => m.render(this.#data))
      .join("");

    if (html !== "") {
      if (html !== this.#lastHtml) {
        this.#content.innerHTML = html;
        this.#lastHtml = html;
      }
      this.#container.style.display = "block";
      this.#forceScaleUpdate();
    } else {
      this.#lastHtml = "";
      this.#container.style.display = "none";
    }
  }

  #start() {
    const updateMs = Number(
      typeof CONFIG !== "undefined" ? CONFIG.debug?.overlayUpdateMs : 150,
    );
    this.#intervalId = setInterval(
      () => this.#update(),
      Number.isFinite(updateMs) && updateMs > 0 ? updateMs : 150,
    );
  }
}

new DebugOverlay();
