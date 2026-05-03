class Renderer {
  #canvas;
  #ctx;

  constructor(canvas) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext("2d", { alpha: false });
  }

  // src/render/renderer.js
  renderSensors(boat, projector) {
    // 1. Перевірка конфігу: якщо вимкнено — не малюємо
    if (!boat.config.showSensors) return;

    const rays = boat.sensorRays;
    if (!rays || rays.length === 0) return;

    this.#ctx.save();
    this.#ctx.lineWidth = 2;

    for (let i = 0; i < rays.length; i++) {
      const ray = rays[i];

      // Малюємо актуальні координати, які тепер оновлюються щокадру
      const startScreen = projector.virtualToScreen(ray.startX, ray.startY);
      const endScreen = projector.virtualToScreen(ray.endX, ray.endY);

      this.#ctx.strokeStyle = ray.isBlocked
        ? "rgba(255, 0, 0, 0.6)"
        : "rgba(0, 255, 0, 0.6)";

      this.#ctx.beginPath();
      this.#ctx.moveTo(startScreen.x, startScreen.y);
      this.#ctx.lineTo(endScreen.x, endScreen.y);
      this.#ctx.stroke();
    }

    this.#ctx.restore();
  }

  #resolveX(configValue, elementWidth = 0) {
    if (configValue === "center") {
      return (this.#canvas.width - elementWidth) / 2;
    }
    return Number(configValue) || 0;
  }

  drawInvalidCastMarker(marker) {
    this.#ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
    this.#ctx.lineWidth = 3;
    this.#ctx.beginPath();
    this.#ctx.arc(marker.x, marker.y, 15, 0, Math.PI * 2);
    this.#ctx.stroke();

    this.#ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
    this.#ctx.fill();

    this.#ctx.beginPath();
    this.#ctx.moveTo(marker.x - 8, marker.y - 8);
    this.#ctx.lineTo(marker.x + 8, marker.y + 8);
    this.#ctx.moveTo(marker.x + 8, marker.y - 8);
    this.#ctx.lineTo(marker.x - 8, marker.y + 8);
    this.#ctx.stroke();
  }

  clear(canvasBgColor = "#0f171e") {
    this.#ctx.fillStyle = canvasBgColor;
    this.#ctx.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
  }

  drawBackground(locationMap, projector) {
    locationMap.drawBackground(this.#ctx, projector);
  }

  drawLocationDebug(locationMap, projector, locationsConfig) {
    const debugCanvas = locationMap.getDebugCanvas();
    if (debugCanvas) {
      const pos = projector.virtualToScreen(0, 0);
      const scale = projector.getScale();
      const w = debugCanvas.width * scale;
      const h = debugCanvas.height * scale;

      const prevAlpha = this.#ctx.globalAlpha;
      this.#ctx.globalAlpha = locationsConfig.debugOpacity || 0.7;
      this.#ctx.drawImage(debugCanvas, pos.x, pos.y, w, h);
      this.#ctx.globalAlpha = prevAlpha;
    }

    const dynamicZones = locationMap.getDynamicZones();
    const cellSize = locationsConfig.cellSize;
    const pScale = projector.getScale();

    for (const dz of dynamicZones) {
      if (dz.bounds) {
        const bArr = Array.isArray(dz.bounds) ? dz.bounds : [dz.bounds];
        this.#ctx.fillStyle = "rgba(255, 100, 255, 0.1)";
        this.#ctx.strokeStyle = "rgba(255, 100, 255, 0.4)";
        this.#ctx.lineWidth = 1;

        for (const b of bArr) {
          if (b.x !== undefined && !isNaN(b.x)) {
            const bPos = projector.virtualToScreen(b.x, b.y);
            this.#ctx.fillRect(bPos.x, bPos.y, b.w * pScale, b.h * pScale);
            this.#ctx.strokeRect(bPos.x, bPos.y, b.w * pScale, b.h * pScale);
          }
        }
      }

      const pos = projector.virtualToScreen(dz.x * cellSize, dz.y * cellSize);
      const w = dz.w * cellSize * pScale;
      const h = dz.h * cellSize * pScale;

      this.#ctx.fillStyle = "rgba(0, 150, 255, 0.5)";
      this.#ctx.fillRect(pos.x, pos.y, w, h);
      this.#ctx.strokeStyle = "#00ffff";
      this.#ctx.lineWidth = 2;
      this.#ctx.strokeRect(pos.x, pos.y, w, h);
    }
  }

  drawCatchZone(
    projector,
    netSystem,
    virtualBottomY,
    locationsConfig,
    catchZoneUIConfig,
  ) {
    if (!locationsConfig.debugVisuals) return;

    const catchLineOffsetPx = locationsConfig.catchLineOffsetPx ?? 5;
    const virtualCatchOffset = catchLineOffsetPx / projector.getScale();
    const virtualCatchY = virtualBottomY - virtualCatchOffset;
    const catchScreenY = projector.virtualToScreen(0, virtualCatchY).y;

    const showCatch = locationsConfig.showCatchZone !== false;
    const showNet = locationsConfig.showNetZone !== false;

    if (showCatch) {
      const heightToDraw = this.#canvas.height - catchScreenY;

      if (heightToDraw > 0) {
        this.#ctx.fillStyle =
          catchZoneUIConfig?.color || "rgba(0, 150, 255, 0.3)";
        this.#ctx.fillRect(0, catchScreenY, this.#canvas.width, heightToDraw);
      }

      const lineDrawY = Math.min(catchScreenY, this.#canvas.height - 2);
      this.#ctx.strokeStyle = "rgba(0, 200, 255, 0.8)";
      this.#ctx.lineWidth = 2;
      this.#ctx.beginPath();
      this.#ctx.moveTo(0, lineDrawY);
      this.#ctx.lineTo(this.#canvas.width, lineDrawY);
      this.#ctx.stroke();
    }

    if (showNet && netSystem && netSystem.isActive) {
      const virtualTriggerY = netSystem.getTriggerVirtualY(virtualBottomY);
      const triggerScreenY = projector.virtualToScreen(0, virtualTriggerY).y;
      const netZoneHeight = catchScreenY - triggerScreenY;

      this.#ctx.strokeStyle = "rgba(0, 255, 128, 0.5)";
      this.#ctx.lineWidth = 1;
      this.#ctx.setLineDash([10, 10]);
      this.#ctx.beginPath();
      this.#ctx.moveTo(0, triggerScreenY);
      this.#ctx.lineTo(this.#canvas.width, triggerScreenY);
      this.#ctx.stroke();
      this.#ctx.setLineDash([]);

      if (netZoneHeight > 0) {
        this.#ctx.fillStyle = "rgba(0, 255, 128, 0.05)";
        this.#ctx.fillRect(
          0,
          triggerScreenY,
          this.#canvas.width,
          netZoneHeight,
        );
      }
    }
  }

  drawChumZones(chumManager, projector) {
    const zones = chumManager.getZones();

    for (const zone of zones) {
      if (!zone.isDelivered || zone.isExpired) continue;

      const cfg = zone.baitConfig;

      // ВІЗУАЛЬНЕ ВИПРАВЛЕННЯ:
      // Зона видима на 100%, поки діє бонус, і починає згасати тільки до minBonus
      let opacity = 1.0;
      if (zone.currentBonus < cfg.maxBonus) {
        opacity =
          0.3 +
          (0.7 * (zone.currentBonus - cfg.minBonus)) /
            Math.max(0.01, cfg.maxBonus - cfg.minBonus);
      }

      const perspective = projector.getPerspective(zone.y);
      const centerScreen = projector.virtualToScreen(zone.x, zone.y);
      const rxScreen =
        zone.baseRadius * perspective.scale * projector.getScale();
      const ryScreen = rxScreen * perspective.squashY;

      this.#ctx.save();
      this.#ctx.beginPath();
      this.#ctx.ellipse(
        centerScreen.x,
        centerScreen.y,
        rxScreen,
        ryScreen,
        0,
        0,
        Math.PI * 2,
      );

      this.#ctx.fillStyle = `rgba(200, 255, 100, ${opacity * 0.2})`; // Трохи приглушили
      this.#ctx.fill();
      this.#ctx.strokeStyle = `rgba(200, 255, 100, ${opacity * 0.5})`;
      this.#ctx.lineWidth = 2;
      this.#ctx.stroke();
      this.#ctx.restore();
    }
  }

  drawAimingZone(projector, virtualBottomY, maxDist, type = "chum") {
    if (maxDist === Infinity) return;

    // Рахуємо координату лінії у віртуальному світі
    const virtualLineY = virtualBottomY - maxDist;

    // Переводимо у екранні пікселі
    const screenPos = projector.virtualToScreen(0, virtualLineY);
    const lineScreenY = screenPos.y;

    // Знаходимо екранну координату берега для заливки
    const screenBottomPos = projector.virtualToScreen(0, virtualBottomY);
    const fillHeight = screenBottomPos.y - lineScreenY;

    this.#ctx.save();
    this.#ctx.beginPath();

    // Малюємо пунктирну лінію через увесь екран
    this.#ctx.moveTo(0, lineScreenY);
    this.#ctx.lineTo(this.#canvas.width, lineScreenY);

    if (type === "chum") {
      this.#ctx.strokeStyle = "rgba(255, 170, 0, 0.8)";
      this.#ctx.fillStyle = "rgba(255, 170, 0, 0.05)";
    } else {
      this.#ctx.strokeStyle = "rgba(0, 204, 255, 0.6)";
      this.#ctx.fillStyle = "rgba(0, 204, 255, 0.05)";
    }

    this.#ctx.lineWidth = 2;
    this.#ctx.setLineDash([15, 10]);
    this.#ctx.stroke();

    // Робимо заливку
    if (fillHeight > 0) {
      this.#ctx.fillRect(0, lineScreenY, this.#canvas.width, fillHeight);
    }

    this.#ctx.restore();
  }

  drawBoatWaypoints(chumManager, projector) {
    if (!chumManager) return;

    const boats = chumManager.getBoats();
    if (boats.length === 0) return;

    for (const boat of boats) {
      const waypoints = boat.getVisualWaypoints();

      for (let i = 0; i < waypoints.length; i++) {
        const wp = waypoints[i];
        const screenPos = projector.virtualToScreen(wp.x, wp.y);

        // --- ДОДАЄМО ПЕРСПЕКТИВУ ---
        const perspective = projector.getPerspective(wp.y);
        const scale = perspective.scale; // Використовуємо загальний масштаб

        this.#ctx.save();

        // Малюємо зовнішнє напівпрозоре кільце (масштабуємо радіус)
        this.#ctx.beginPath();
        this.#ctx.arc(screenPos.x, screenPos.y, 8 * scale, 0, Math.PI * 2);
        this.#ctx.strokeStyle = "rgba(255, 170, 0, 0.6)";
        this.#ctx.lineWidth = Math.max(1, 2 * scale); // Товщина лінії теж трохи зменшується
        this.#ctx.stroke();

        // Малюємо внутрішній яскравий кружечок (масштабуємо радіус)
        this.#ctx.beginPath();
        this.#ctx.arc(screenPos.x, screenPos.y, 3 * scale, 0, Math.PI * 2);
        this.#ctx.fillStyle = "#ffaa00";
        this.#ctx.fill();

        // Малюємо цифру ТІЛЬКИ якщо це автоматичний режим
        if (!boat.config.manualControl) {
          this.#ctx.fillStyle = "#ffffff";
          // Масштабуємо розмір шрифту
          const fontSize = Math.max(6, 10 * scale); // Мінімум 6px, щоб можна було прочитати
          this.#ctx.font = `bold ${fontSize}px Arial`;

          // Відступи для тексту теж масштабуємо
          this.#ctx.fillText(
            i + 1,
            screenPos.x + 10 * scale,
            screenPos.y + 4 * scale,
          );
        }

        this.#ctx.restore();
      }
    }
  }

  drawBoats(chumManager, projector) {
    // Видалено virtualTopY, virtualBottomY
    const boats = chumManager.getBoats();
    if (!boats || boats.length === 0) return;

    this.#ctx.save();
    this.#ctx.textAlign = "center";
    this.#ctx.textBaseline = "middle";

    for (const boat of boats) {
      const screenPos = projector.virtualToScreen(boat.pos.x, boat.pos.y);

      // --- ЄДИНА МАТЕМАТИЧНА ПЕРСПЕКТИВА ---
      const perspective = projector.getPerspective(boat.pos.y);
      // Для кораблика беремо тільки scale, бо він "стоїть" на воді, а не лежить плошмя
      const scale = perspective.scale;

      const fontSize = 40 * projector.getScale() * scale;
      this.#ctx.font = `${fontSize}px sans-serif`;

      this.#ctx.translate(screenPos.x, screenPos.y);
      this.#ctx.rotate(boat.angle + Math.PI);
      this.#ctx.fillText(boat.config.emoji, 0, 0);
      this.#ctx.rotate(-(boat.angle + Math.PI));

      const energyPct = boat.energy / boat.stats.maxEnergy;
      const barWidth = 40 * scale;
      const barHeight = 4 * scale;
      const barY = -fontSize / 1.5;

      this.#ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      this.#ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);

      if (energyPct > 0.5) this.#ctx.fillStyle = "#00ff80";
      else if (energyPct > 0.2) this.#ctx.fillStyle = "#ffaa00";
      else this.#ctx.fillStyle = "#ff4444";

      this.#ctx.fillRect(-barWidth / 2, barY, barWidth * energyPct, barHeight);

      this.#ctx.translate(-screenPos.x, -screenPos.y);
    }
    this.#ctx.restore();
  }

  drawFloat(screenPos, floatEntity, floatConfig, projector, equipped = {}) {
    const visualState = floatEntity.getVisualState();
    const perspective = projector.getPerspective(floatEntity.getPosition().y);
    const pScale = perspective.scale;

    this.#ctx.save();
    this.#ctx.translate(screenPos.x, screenPos.y);

    const eq = equipped;
    const rodType = eq.rod?.type || "float";
    const isFeeder = rodType === "feeder";
    const isSpinning = rodType === "spinning";

    if (floatEntity.isHooked()) {
      this.#ctx.fillStyle = visualState.color;
      this.#ctx.fillRect(-1.5 * pScale, -3 * pScale, 3 * pScale, 3 * pScale);
      this.#ctx.restore();
      return;
    }

    this.#ctx.fillStyle = visualState.color;

    if (visualState.color !== "#ffffff" && visualState.color !== "#00ff80") {
      this.#ctx.shadowColor = visualState.color;
      this.#ctx.shadowBlur = 8 * pScale;
    }

    if (isSpinning) {
      if (eq.baits?.[0]) {
        this.#ctx.beginPath();
        this.#ctx.arc(0, 0, 2.5 * pScale, 0, Math.PI * 2);
        this.#ctx.fill();
      }
    } else if (isFeeder) {
      if (eq.sinker) {
        this.#ctx.beginPath();
        this.#ctx.ellipse(0, 0, 6 * pScale, 3 * pScale, 0, 0, Math.PI * 2);
        this.#ctx.fill();
      }
    } else {
      if (eq.float) {
        const w =
          eq.float.width ||
          eq.float.engineStats?.width ||
          floatConfig.width ||
          3;
        const l =
          eq.float.length ||
          eq.float.engineStats?.length ||
          floatConfig.length ||
          15;

        const floatWidth = w * pScale;
        const floatLength = l * pScale;
        const scaleY = visualState.scaleY ?? 1;

        this.#ctx.rotate(((visualState.angle || 0) * Math.PI) / 180);
        const currentLength = floatLength * scaleY;

        this.#ctx.fillRect(
          -floatWidth / 2,
          -currentLength,
          floatWidth,
          currentLength,
        );
      }
    }

    this.#ctx.restore();
  }

  drawRodLine(
    floatPos,
    gameState,
    tension,
    lineLengthRatio,
    lineDropOffset,
    uiRodConfig,
    uiLineConfig,
  ) {
    const rodWidth = 3;
    const rodHeight = 200;

    let rodBaseX = this.#resolveX(uiRodConfig?.x, rodWidth);
    const rodBaseY = this.#canvas.height - (uiRodConfig?.yOffset || 0);
    const rodTopY = rodBaseY - rodHeight;

    this.#ctx.fillStyle = "#000000";
    this.#ctx.fillRect(rodBaseX - rodWidth / 2, rodTopY, rodWidth, rodHeight);

    if (uiLineConfig?.visible === false) return;

    let targetX = rodBaseX + (floatPos.x - rodBaseX) * lineLengthRatio;
    let targetY = rodTopY + (floatPos.y - rodTopY) * lineLengthRatio;

    targetY += lineDropOffset;

    let lineColor = uiLineConfig?.color || "rgba(255, 255, 255, 0.3)";
    let lineWidth = uiLineConfig?.width || 1;

    if (gameState === "playing") {
      if (tension >= 100) {
        const isRed = Math.floor(performance.now() / 80) % 2 === 0;
        lineColor = isRed ? "rgba(255, 0, 0, 0.9)" : "rgba(255, 255, 255, 0.9)";
        lineWidth = Math.max(lineWidth, 2);
      } else if (tension >= 90) {
        const intensity = (tension - 90) / 10;
        const r = Math.floor(150 + 105 * intensity);
        lineColor = `rgba(${r}, 0, 0, ${0.5 + 0.4 * intensity})`;
        lineWidth = Math.max(lineWidth, 1.5);
      }
    }

    this.#ctx.save();
    this.#ctx.beginPath();
    this.#ctx.moveTo(rodBaseX, rodTopY);

    const straightenThreshold = uiLineConfig?.straightenTension || 50;
    const sagOffset = uiLineConfig?.sagOffset || 60;

    let straightFactor = 0;
    if (gameState === "playing") {
      straightFactor = Math.min(1, Math.max(0, tension / straightenThreshold));
    }

    const cpX = (rodBaseX + targetX) / 2;
    const straightCpY = (rodTopY + targetY) / 2;
    const slackCpY = Math.max(rodTopY, targetY) + sagOffset;

    const currentCpY = slackCpY + (straightCpY - slackCpY) * straightFactor;

    this.#ctx.quadraticCurveTo(cpX, currentCpY, targetX, targetY);

    this.#ctx.strokeStyle = lineColor;
    this.#ctx.lineWidth = lineWidth;
    this.#ctx.stroke();
    this.#ctx.restore();
  }

  drawHoldCharges(holdState, canvasWidth, canvasHeight) {
    if (!holdState || !holdState.hasHold || holdState.max <= 0) return;

    const ctx = this.#ctx; // Припускаю, що твій контекст зберігається в this.#ctx
    ctx.save();

    const maxCharges = holdState.max;
    const currentCharges = holdState.current;
    const isActive = holdState.isActive;
    const restoringTimers = holdState.restoring; // Масив таймерів, які ще не дійшли до нуля
    const maxRestoreTime = holdState.restoreMaxTime;

    // Налаштування вигляду кружечків
    const radius = 8;
    const gap = 12;
    const totalWidth = radius * 2 * maxCharges + gap * (maxCharges - 1);

    // Позиція: по центру по горизонталі, і десь на 75% висоти екрану (над кнопкою чи шкалами)
    const startX = (canvasWidth - totalWidth) / 2 + radius;
    const startY = canvasHeight * 0.75;

    // Логіка підрахунку станів:
    // 1. Активні (зараз використовується) - максимум 1
    // 2. Доступні (можна використати)
    // 3. Відновлюються (розбиті)

    let availableToDraw = currentCharges;
    let activeToDraw = isActive ? 1 : 0;
    let restoringToDraw = restoringTimers.length;

    for (let i = 0; i < maxCharges; i++) {
      const cx = startX + i * (radius * 2 + gap);
      const cy = startY;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);

      if (activeToDraw > 0) {
        // --- СТАН: АКТИВНИЙ БЛОК (Пустий всередині, світиться) ---
        ctx.strokeStyle = "#00ff80";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Малюємо легке світіння (неоновий ефект)
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#00ff80";
        ctx.stroke();
        ctx.shadowBlur = 0; // Скидаємо тінь

        activeToDraw--;
      } else if (availableToDraw > 0) {
        // --- СТАН: ДОСТУПНИЙ БЛОК (Зафарбований зеленим) ---
        ctx.fillStyle = "#00ff80";
        ctx.fill();
        ctx.strokeStyle = "#00cc66";
        ctx.lineWidth = 1;
        ctx.stroke();

        availableToDraw--;
      } else if (restoringToDraw > 0) {
        // --- СТАН: ВІДНОВЛЮЄТЬСЯ (Розбитий) ---
        // Малюємо пустий червоний контур
        ctx.strokeStyle = "#ff0055";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Малюємо "заливку" знизу вверх залежно від таймера
        const timer = restoringTimers[restoringToDraw - 1]; // Беремо таймер для цього кружечка
        let progress = 1.0 - timer / maxRestoreTime; // Від 0 до 1
        progress = Math.max(0, Math.min(1, progress));

        if (progress > 0) {
          ctx.save();
          // Створюємо "маску" обрізки (щоб заливка не вилізла за краї круга)
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.clip();

          // Малюємо прямокутник заливки знизу
          const fillHeight = radius * 2 * progress;
          const fillY = cy + radius - fillHeight;

          ctx.fillStyle = "rgba(255, 0, 85, 0.5)"; // Напівпрозорий червоний
          ctx.fillRect(cx - radius, fillY, radius * 2, fillHeight);
          ctx.restore();
        }

        restoringToDraw--;
      }
    }

    // Якщо блок активний, можна намалювати маленьку підказку
    if (isActive) {
      ctx.fillStyle = "#00ff80";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.fillText("УТРИМАННЯ", canvasWidth / 2, startY - 20);
    }

    ctx.restore();
  }

  drawFishCondition(condition, uiIndicatorsConfig) {
    const barWidth = 200;
    const barHeight = 10;
    const barX = this.#resolveX(uiIndicatorsConfig?.x, barWidth);
    const barY = uiIndicatorsConfig?.y || 40;

    this.#ctx.fillStyle = "#0b1520";
    this.#ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

    if (condition.phase === "stamina") {
      const ratio = Math.max(
        0,
        Math.min(1, condition.currentStamina / condition.maxPoints),
      );
      this.#ctx.fillStyle = "#ffcc00";
      this.#ctx.fillRect(barX, barY, barWidth * ratio, barHeight);
      this.#ctx.fillStyle = "#ffffff";
      this.#ctx.font = "12px monospace";
      this.#ctx.textAlign = "center";
      this.#ctx.fillText(
        `STAMINA: ${Math.round(condition.currentStamina)}/${Math.round(condition.maxPoints)}`,
        barX + barWidth / 2,
        barY + barHeight + 12,
      );
    } else {
      const ratio = Math.max(
        0,
        Math.min(1, condition.currentExhaustion / condition.maxPoints),
      );
      this.#ctx.fillStyle = "#ff4444";
      this.#ctx.fillRect(barX, barY, barWidth * ratio, barHeight);
      this.#ctx.fillStyle = "#ffffff";
      this.#ctx.font = "12px monospace";
      this.#ctx.textAlign = "center";
      this.#ctx.fillText(
        `EXHAUSTING... ${Math.round(condition.currentExhaustion)}/${Math.round(condition.maxPoints)}`,
        barX + barWidth / 2,
        barY + barHeight + 12,
      );
    }

    this.#ctx.strokeStyle = "#333";
    this.#ctx.strokeRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
  }

  drawTensionBar(tensionMeter, tensionConfig, uiIndicatorsConfig) {
    const barWidth = tensionConfig.barWidth;
    const barHeight = tensionConfig.barHeight;
    const barX = this.#resolveX(uiIndicatorsConfig?.x, barWidth);
    const baseY = uiIndicatorsConfig?.y || 40;
    const spacing = uiIndicatorsConfig?.spacing || 40;
    const barY = baseY + spacing;

    const padding = tensionConfig.borderPadding;
    const tension = tensionMeter.getTension();
    const pulseIntensity = tensionMeter.getPulseIntensity({
      tension: tensionConfig,
    });

    this.#ctx.fillStyle = tensionConfig.backgroundColor;
    this.#ctx.fillRect(
      barX - padding,
      barY - padding,
      barWidth + padding * 2,
      barHeight + padding * 2,
    );

    this.#ctx.strokeStyle = tensionConfig.borderColor;
    this.#ctx.lineWidth = tensionConfig.barBorderWidth;
    this.#ctx.strokeRect(
      barX - padding,
      barY - padding,
      barWidth + padding * 2,
      barHeight + padding * 2,
    );

    const fillWidth = (tension / 100) * barWidth;
    const fillColor = tensionMeter.getCurrentColor();

    this.#ctx.fillStyle = fillColor;
    this.#ctx.fillRect(barX, barY, fillWidth, barHeight);

    const glowIntensity = pulseIntensity * tensionConfig.glowIntensity;
    this.#ctx.shadowColor = fillColor;
    this.#ctx.shadowBlur = 10 * glowIntensity;
    this.#ctx.strokeStyle = fillColor;
    this.#ctx.lineWidth = 2;
    this.#ctx.strokeRect(barX, barY, fillWidth, barHeight);
    this.#ctx.shadowBlur = 0;

    this.#ctx.fillStyle = tensionConfig.labelColor;
    this.#ctx.font = tensionConfig.labelFont;
    this.#ctx.textAlign = "left";
    this.#ctx.fillText(
      `TENSION: ${Math.round(tension)}%`,
      barX - tensionConfig.labelOffsetX,
      barY + tensionConfig.labelOffsetY,
    );

    const statusLabel = tensionMeter.getCurrentStatusLabel();
    const statusColor = tensionMeter.getCurrentStatusColor();

    this.#ctx.fillStyle = statusColor;
    this.#ctx.textAlign = "right";
    this.#ctx.fillText(
      statusLabel,
      barX + barWidth + tensionConfig.labelOffsetX,
      barY + tensionConfig.labelOffsetY,
    );

    if (tension >= tensionConfig.breakThreshold - 0.1) {
      const breakProgress = tensionMeter.getLineBreakProgress();
      this.#drawLineBreakWarning(barX, barY - 25, barWidth, breakProgress);
    }
  }

  #drawLineBreakWarning(x, y, width, progress) {
    this.#ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
    this.#ctx.fillRect(x, y, width * progress, 8);
    this.#ctx.strokeStyle = "#ff0000";
    this.#ctx.lineWidth = 1;
    this.#ctx.strokeRect(x, y, width, 8);
    this.#ctx.fillStyle = "#ff0000";
    this.#ctx.font = "bold 10px monospace";
    this.#ctx.textAlign = "center";
    this.#ctx.fillText("LINE BREAK", x + width / 2, y + 18);
  }

  drawGameOver(canvasWidth, canvasHeight, reason) {
    this.#ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    this.#ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    let title = "LINE SNAPPED";
    let titleColor = "#ff4444";
    let desc = "Tension exceeded line capacity.";

    if (reason === "rod") {
      title = "ROD BROKEN";
      titleColor = "#ff0000";
      desc = "Your equipment could not handle the stress.";
    } else if (reason === "hook" || reason === "net_escape") {
      title = "FISH ESCAPED";
      titleColor = "#ffaa00";
      desc =
        reason === "net_escape"
          ? "The fish was too heavy and broke out of the net!"
          : "The hook bent and the fish got away.";
    }

    this.#ctx.fillStyle = titleColor;
    this.#ctx.font = "bold 48px monospace";
    this.#ctx.textAlign = "center";
    this.#ctx.fillText(title, canvasWidth / 2, canvasHeight / 2 - 40);
    this.#ctx.fillStyle = "#ffaa00";
    this.#ctx.font = "bold 20px monospace";
    this.#ctx.fillText(desc, canvasWidth / 2, canvasHeight / 2 + 20);
    this.#ctx.fillStyle = "#00ccff";
    this.#ctx.font = "bold 16px monospace";
    this.#ctx.fillText(
      "Refresh page to try again",
      canvasWidth / 2,
      canvasHeight / 2 + 70,
    );
  }

  drawVictory(canvasWidth, canvasHeight) {
    this.#ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    this.#ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    this.#ctx.fillStyle = "#00ff80";
    this.#ctx.font = "bold 48px monospace";
    this.#ctx.textAlign = "center";
    this.#ctx.fillText(
      "FISH EXHAUSTED",
      canvasWidth / 2,
      canvasHeight / 2 - 40,
    );
    this.#ctx.fillStyle = "#8a9bac";
    this.#ctx.font = "bold 20px monospace";
    this.#ctx.fillText(
      "You wore the fish out — well played!",
      canvasWidth / 2,
      canvasHeight / 2 + 10,
    );
    this.#ctx.fillStyle = "#00ccff";
    this.#ctx.font = "bold 14px monospace";
    this.#ctx.fillText(
      "Refresh page to try again",
      canvasWidth / 2,
      canvasHeight / 2 + 60,
    );
  }
}
