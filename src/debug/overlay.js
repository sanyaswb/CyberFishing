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
      const powerRatio = Number(cfg.powerRatio ?? 1) || 1;
      const speedRatio = Number(cfg.speedRatio ?? 0) || 0;
      const stateForceKg = basePower * powerRatio;

      html += `<div style="margin-bottom: 2px; display: flex; justify-content: space-between; font-size: 12px;">
                <span style="color: ${color}; font-weight: bold;">${name.toUpperCase()}</span>
                <span style="color: #e6e6e6;">kg: <span style="color: ${color}; font-weight: bold;">${stateForceKg.toFixed(3)}</span> | speed: <span style="color: ${color}; font-weight: bold;">${speedRatio.toFixed(2)}</span></span>
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
    html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Player pressure:</span><span style="color:#00ff80;">${(d.playerPullPressureKg || 0).toFixed(3)}kg -> ${(d.effectivePlayerPressureKg || 0).toFixed(3)}kg</span></div>`;
    html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Retrieve speed:</span><span style="color:#00ff80;">${(d.actualFishPullSpeedMps || 0).toFixed(2)}m/s</span></div>`;
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
    let html = this.formatHeader("FIGHT PHYSICS", "#73c2fb");
    const lineRemaining = Math.max(0, Number(d.lineRemainingMeters) || 0);
    const lineMaxRemaining = Math.max(0, Number(d.lineMaxRemainingMeters) || 0);
    const lineReserveColor = lineRemaining <= 0.001 ? "#ff4444" : "#8a9bac";
    const rodStrokeUsed = Math.max(
      0,
      Number(d.rodStrokeUnrecoveredMeters) || 0,
    );
    const rodStrokeCapacity = Math.max(
      0,
      Number(d.rodStrokeCapacityMeters) || 0,
    );

    html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Натяг:</span><span style="color:#ffaa00; font-weight:bold;">${(d.tensionKg || 0).toFixed(2)} / ${(d.maxTackleLoadKg || 0).toFixed(2)} кг</span></div>`;
    if (d.dragSupported) {
      html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Фрикціон:</span><span style="color:#00ccff; font-weight:bold;">${(d.dragPercent || 0).toFixed(0)}% / ${(d.dragLimitKg || 0).toFixed(2)} кг</span></div>`;
    }
    html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Випущено ліски:</span><span style="color:#00ff80;">${(d.lineReleasedMeters || 0).toFixed(1)}м / ${(d.lineTotalLengthMeters || 0).toFixed(1)}м</span></div>`;
    html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Залишок ліски:</span><span style="color:${lineReserveColor}; font-weight:bold;">${lineRemaining.toFixed(1)}м / ${lineMaxRemaining.toFixed(1)}м</span></div>`;
    html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Запас ліски:</span><span style="color:${d.lineCanRelease ? "#00ff80" : "#ff4444"}; font-weight:bold;">${d.lineCanRelease ? "Є" : "НЕМАЄ"}</span></div>`;
    html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Фізична межа ліски:</span><span style="color:${d.isLineFullyExtended ? "#ff4444" : "#00ff80"}; font-weight:bold;">${d.isLineFullyExtended ? "ТАК" : "НІ"}</span></div>`;
    html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Дистанція до риби:</span><span style="color:#8a9bac;">${(d.lineDistanceMeters || 0).toFixed(1)}м</span></div>`;
    html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Хід вудки:</span><span style="color:#8a9bac;">${rodStrokeUsed.toFixed(1)}м / ${rodStrokeCapacity.toFixed(1)}м</span></div>`;
    if (d.dragSupported) {
      const reelRecoverReasonLabels = {
        ready: "готово",
        disabled: "вимкнено",
        no_reel: "нема котушки",
        not_holding: "hold не утримується",
        rod_pull_inactive: "хід не активний",
        stroke_not_full: "хід не повний",
        drag_slipping: "фрикціон здає",
        no_reel_load_reserve: "нема запасу котушки",
        zero_recover_speed: "швидкість 0",
        not_checked: "не перевірено",
      };
      const reelRecoverReason =
        reelRecoverReasonLabels[d.holdReelRecoverBlockedReason] ||
        d.holdReelRecoverBlockedReason ||
        "not_checked";
      const reelRecoverColor = d.holdReelRecoverActive
        ? "#00ff80"
        : d.holdReelRecoverEligible
          ? "#ffaa00"
          : "#8a9bac";
      html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Підмотка hold:</span><span style="color:${reelRecoverColor}; font-weight:bold;">${d.holdReelRecoverActive ? "ТАК" : d.holdReelRecoverEligible ? "ЧЕКАЄ" : "НІ"}</span></div>`;
      html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Причина підмотки:</span><span style="color:#8a9bac;">${reelRecoverReason}</span></div>`;
      html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Таймер підмотки:</span><span style="color:#8a9bac;">${((d.holdReelRecoverTimerMs || 0) / 1000).toFixed(1)}с / ${((d.holdReelRecoverDelayMs || 0) / 1000).toFixed(1)}с</span></div>`;
      html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Швидк. підмотки:</span><span style="color:#00ff80;">${(d.holdReelRecoverSpeedMps || 0).toFixed(2)}м/с</span></div>`;
      html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>До скручування:</span><span style="color:#8a9bac;">${(d.pumpCreditMeters || 0).toFixed(1)}м</span></div>`;
    }
    html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Player pressure:</span><span style="color:#00ff80;">${(d.playerPullPressureKg || 0).toFixed(3)}kg -> ${(d.effectivePlayerPressureKg || 0).toFixed(3)}kg</span></div>`;
    html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Retrieve speed:</span><span style="color:#00ff80;">${(d.actualFishPullSpeedMps || 0).toFixed(2)}m/s</span></div>`;
    html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Пасивний опір тіла:</span><span style="color:#8a9bac;">${(d.tautBodyResistanceKg || 0).toFixed(3)}кг</span></div>`;
    html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Активний опір від гравця:</span><span style="color:#ff8888;">${(d.activeAwayForceKg || 0).toFixed(3)}кг</span></div>`;
    html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Опір води при підтягуванні:</span><span style="color:#73c2fb;">${(d.fishRetrieveWaterDragKg || 0).toFixed(3)}кг</span></div>`;
    html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Стартовий spike:</span><span style="color:#ffaa00;">${(d.fishRetrieveAccelerationLoadKg || 0).toFixed(3)}кг</span></div>`;
    html += `<div style="display:flex; justify-content:space-between; margin-bottom:12px;"><span>Штраф кута:</span><span style="color:#ffaa00;">x${(d.anglePenalty || 1).toFixed(2)} (${(d.angleDeg || 0).toFixed(0)}°)</span></div>`;
    return html;
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
    const behaviors = activeFish.physics?.behaviors || {};
    const currentFishBase = d.fishBasePower || 0;

    let maxPull = 0,
      maxMove = 0;
    Object.values(behaviors).forEach((b) => {
      const powerRatio = b.powerRatio ?? 0;
      const speedRatio = b.speedRatio ?? 0;
      if (powerRatio > maxPull) maxPull = powerRatio;
      const effMove = Math.abs(speedRatio);
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
      this.#content.innerHTML = html;
      this.#container.style.display = "block";
      this.#forceScaleUpdate();
    } else {
      this.#container.style.display = "none";
    }
  }

  #start() {
    this.#intervalId = setInterval(() => this.#update(), 100);
  }
}

new DebugOverlay();
