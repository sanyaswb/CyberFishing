class Renderer {
  #canvas;
  #ctx;
  #screenA = new Vector2(0, 0);
  #screenB = new Vector2(0, 0);
  #imageCache = new Map();

  constructor(canvas) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext("2d", { alpha: false });
  }

  #rgba(rgb, alpha = 1) {
    const source = Array.isArray(rgb) ? rgb : [255, 255, 255];
    return `rgba(${source[0] || 0}, ${source[1] || 0}, ${source[2] || 0}, ${alpha})`;
  }

  #mixRgb(a, b, t) {
    const ratio = Math.max(0, Math.min(1, t));
    return [
      Math.round(a[0] + (b[0] - a[0]) * ratio),
      Math.round(a[1] + (b[1] - a[1]) * ratio),
      Math.round(a[2] + (b[2] - a[2]) * ratio),
    ];
  }

  #roundedRect(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, radius);
      return;
    }
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }

  #getCachedImage(src) {
    if (!src || typeof Image === "undefined") return null;
    let entry = this.#imageCache.get(src);
    if (!entry) {
      const img = new Image();
      entry = { img, loaded: false, failed: false };
      img.onload = () => {
        entry.loaded = true;
      };
      img.onerror = () => {
        entry.failed = true;
      };
      img.src = src;
      this.#imageCache.set(src, entry);
    }
    return entry.loaded && !entry.failed ? entry.img : null;
  }

  #drawImageCover(img, x, y, w, h) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (img.naturalWidth - sw) / 2;
    const sy = (img.naturalHeight - sh) / 2;
    this.#ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  #drawFittedText(text, x, y, maxWidth, baseFont, color, align = "center") {
    const ctx = this.#ctx;
    let size = baseFont.size;
    const family = baseFont.family || "monospace";
    const weight = baseFont.weight || "bold";
    do {
      ctx.font = `${weight} ${size}px ${family}`;
      if (ctx.measureText(text).width <= maxWidth || size <= 10) break;
      size -= 1;
    } while (size > 10);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
  }

  #getVictoryTheme(fish, config) {
    const colors = config.levelColors || {};
    const gray = colors[1] || [145, 150, 160];
    const green = colors[2] || [0, 210, 120];
    const blue = colors[3] || [0, 160, 255];
    const purple = colors[4] || [170, 100, 255];
    const red = colors.preUnique || [255, 70, 70];
    const gold = colors.unique || [255, 205, 55];
    const level = Math.max(1, Math.round(fish?.level || 1));
    const maxLevel = Math.max(level, Math.round(fish?.maxLevel || level));

    if (fish?.isUnique) return { color: gold, isUnique: true };
    if (maxLevel > 2 && level === maxLevel - 1)
      return { color: red, isUnique: false };
    if (level <= 1) return { color: gray, isUnique: false };
    if (level === 2) return { color: green, isUnique: false };
    if (level === 3) return { color: blue, isUnique: false };
    if (level === 4) return { color: purple, isUnique: false };

    const span = Math.max(1, maxLevel - 5);
    return {
      color: this.#mixRgb(purple, red, (level - 4) / span),
      isUnique: false,
    };
  }

  #drawVictoryPill(x, y, w, h, label, color) {
    const ctx = this.#ctx;
    this.#roundedRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = "rgba(5, 10, 16, 0.48)";
    ctx.fill();
    ctx.strokeStyle = this.#rgba(color, 0.38);
    ctx.lineWidth = 1;
    ctx.stroke();
    this.#drawFittedText(
      label,
      x + w / 2,
      y + h / 2,
      w - 14,
      { size: 13, family: "sans-serif", weight: "bold" },
      "#e8edf5",
    );
  }

  #drawVictoryButton(x, y, w, h, label, color, filled = true) {
    const ctx = this.#ctx;
    this.#roundedRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = filled ? this.#rgba(color, 0.82) : "rgba(0, 0, 0, 0.28)";
    ctx.fill();
    ctx.strokeStyle = this.#rgba(color, 0.95);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    this.#drawFittedText(
      label,
      x + w / 2,
      y + h / 2,
      w - 20,
      { size: 15, family: "sans-serif", weight: "bold" },
      filled ? "#061014" : "#e8edf5",
    );
  }

  renderSensors(boat, projector) {
    if (!boat.config.showSensors) return;

    const rays = boat.sensorRays;
    if (!rays || rays.length === 0) return;

    this.#ctx.save();
    this.#ctx.lineWidth = 2;

    for (let i = 0; i < rays.length; i++) {
      const ray = rays[i];

      const startScreen = projector.virtualToScreen(
        ray.startX,
        ray.startY,
        this.#screenA,
      );
      const endScreen = projector.virtualToScreen(
        ray.endX,
        ray.endY,
        this.#screenB,
      );

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
      const pos = projector.virtualToScreen(0, 0, this.#screenA);
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
            const bPos = projector.virtualToScreen(b.x, b.y, this.#screenA);
            this.#ctx.fillRect(bPos.x, bPos.y, b.w * pScale, b.h * pScale);
            this.#ctx.strokeRect(bPos.x, bPos.y, b.w * pScale, b.h * pScale);
          }
        }
      }

      const pos = projector.virtualToScreen(
        dz.x * cellSize,
        dz.y * cellSize,
        this.#screenA,
      );
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
    const catchScreenY = projector.virtualToScreen(
      0,
      virtualCatchY,
      this.#screenA,
    ).y;

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
      const triggerScreenY = projector.virtualToScreen(
        0,
        virtualTriggerY,
        this.#screenB,
      ).y;
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

      let opacity = 1.0;
      if (zone.currentBonus < cfg.maxBonus) {
        opacity =
          0.3 +
          (0.7 * (zone.currentBonus - cfg.minBonus)) /
            Math.max(0.01, cfg.maxBonus - cfg.minBonus);
      }

      const perspective = projector.getPerspective(zone.y);
      const centerScreen = projector.virtualToScreen(
        zone.x,
        zone.y,
        this.#screenA,
      );
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

      this.#ctx.fillStyle = `rgba(200, 255, 100, ${opacity * 0.2})`;
      this.#ctx.fill();
      this.#ctx.strokeStyle = `rgba(200, 255, 100, ${opacity * 0.5})`;
      this.#ctx.lineWidth = 2;
      this.#ctx.stroke();
      this.#ctx.restore();
    }
  }

  drawAimingZone(projector, virtualBottomY, maxDist, type = "chum") {
    if (maxDist === Infinity) return;

    const virtualLineY = virtualBottomY - maxDist;

    const screenPos = projector.virtualToScreen(0, virtualLineY, this.#screenA);
    const lineScreenY = screenPos.y;

    const screenBottomPos = projector.virtualToScreen(
      0,
      virtualBottomY,
      this.#screenB,
    );
    const fillHeight = screenBottomPos.y - lineScreenY;

    this.#ctx.save();
    this.#ctx.beginPath();

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
        const screenPos = projector.virtualToScreen(wp.x, wp.y, this.#screenA);

        const perspective = projector.getPerspective(wp.y);
        const scale = perspective.scale;

        this.#ctx.save();

        this.#ctx.beginPath();
        this.#ctx.arc(screenPos.x, screenPos.y, 8 * scale, 0, Math.PI * 2);
        this.#ctx.strokeStyle = "rgba(255, 170, 0, 0.6)";
        this.#ctx.lineWidth = Math.max(1, 2 * scale);
        this.#ctx.stroke();

        this.#ctx.beginPath();
        this.#ctx.arc(screenPos.x, screenPos.y, 3 * scale, 0, Math.PI * 2);
        this.#ctx.fillStyle = "#ffaa00";
        this.#ctx.fill();

        if (!boat.config.manualControl) {
          this.#ctx.fillStyle = "#ffffff";
          const fontSize = Math.max(6, 10 * scale);
          this.#ctx.font = `bold ${fontSize}px Arial`;

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
    const boats = chumManager.getBoats();
    if (!boats || boats.length === 0) return;

    this.#ctx.save();
    this.#ctx.textAlign = "center";
    this.#ctx.textBaseline = "middle";

    for (const boat of boats) {
      const screenPos = projector.virtualToScreen(
        boat.pos.x,
        boat.pos.y,
        this.#screenA,
      );

      const perspective = projector.getPerspective(boat.pos.y);
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
    nowMs = 0,
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
        const isRed = Math.floor(nowMs / 80) % 2 === 0;
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

    const ctx = this.#ctx;
    ctx.save();

    const maxCharges = holdState.max;
    const currentCharges = holdState.current;
    const isActive = holdState.isActive;
    const restoringTimers = holdState.restoring;
    const maxRestoreTime = holdState.restoreMaxTime;

    const radius = 8;
    const gap = 12;
    const totalWidth = radius * 2 * maxCharges + gap * (maxCharges - 1);

    const startX = (canvasWidth - totalWidth) / 2 + radius;
    const startY = canvasHeight * 0.75;

    let availableToDraw = currentCharges;
    let activeToDraw = isActive ? 1 : 0;
    let restoringToDraw = restoringTimers.length;

    for (let i = 0; i < maxCharges; i++) {
      const cx = startX + i * (radius * 2 + gap);
      const cy = startY;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);

      if (activeToDraw > 0) {
        ctx.strokeStyle = "#00ff80";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowBlur = 10;
        ctx.shadowColor = "#00ff80";
        ctx.stroke();
        ctx.shadowBlur = 0;

        activeToDraw--;
      } else if (availableToDraw > 0) {
        ctx.fillStyle = "#00ff80";
        ctx.fill();
        ctx.strokeStyle = "#00cc66";
        ctx.lineWidth = 1;
        ctx.stroke();

        availableToDraw--;
      } else if (restoringToDraw > 0) {
        ctx.strokeStyle = "#ff0055";
        ctx.lineWidth = 2;
        ctx.stroke();

        const timer = restoringTimers[restoringToDraw - 1];
        let progress = 1.0 - timer / maxRestoreTime;
        progress = Math.max(0, Math.min(1, progress));

        if (progress > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.clip();

          const fillHeight = radius * 2 * progress;
          const fillY = cy + radius - fillHeight;

          ctx.fillStyle = "rgba(255, 0, 85, 0.5)";
          ctx.fillRect(cx - radius, fillY, radius * 2, fillHeight);
          ctx.restore();
        }

        restoringToDraw--;
      }
    }

    if (isActive) {
      ctx.fillStyle = "#00ff80";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.fillText("HOLD", canvasWidth / 2, startY - 20);
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

  drawVictory(canvasWidth, canvasHeight, fish = {}, victoryConfig = {}) {
    const defaults = {
      panelWidth: 540,
      panelMinHeight: 560,
      viewportMargin: 24,
      panelPadding: 24,
      panelRadius: 8,
      imageBoxSize: 260,
      imageBorderWidth: 3,
      statPillHeight: 42,
      buttonWidth: 150,
      buttonHeight: 42,
      buttonGap: 14,
      blurPx: 3,
      uniqueGlowPulseMs: 1200,
      levelColors: {
        1: [145, 150, 160],
        2: [0, 210, 120],
        3: [0, 160, 255],
        4: [170, 100, 255],
        preUnique: [255, 70, 70],
        unique: [255, 205, 55],
      },
    };
    const cfg = {
      ...defaults,
      ...victoryConfig,
      levelColors: {
        ...defaults.levelColors,
        ...(victoryConfig?.levelColors || {}),
      },
    };
    const ctx = this.#ctx;
    const theme = this.#getVictoryTheme(fish, cfg);
    const color = theme.color;
    const margin = Math.max(8, cfg.viewportMargin || 24);
    const maxPanelW = Math.max(260, canvasWidth - margin * 2);
    const panelW = Math.min(cfg.panelWidth, maxPanelW);
    const padding = Math.min(cfg.panelPadding, Math.max(14, panelW * 0.06));
    const maxPanelH = Math.max(320, canvasHeight - margin * 2);
    const titleH = 46;
    const gap = 16;
    const statH = cfg.statPillHeight;
    const buttonH = cfg.buttonHeight;
    const anomaly = fish?.anomaly || "none";
    const baseStats = [
      { label: `${Number(fish?.weight || 0).toFixed(3)} kg`, color },
      {
        label: fish?.isTrophy ? "✓ Trophy" : "○ Not trophy",
        color: fish?.isTrophy ? color : [145, 150, 160],
      },
      { label: `Anomaly: ${anomaly}`, color },
    ];
    const extraStats = Array.isArray(fish?.victoryStats)
      ? fish.victoryStats
      : [];
    const statItems = baseStats.concat(
      extraStats.map((stat) => ({
        label: String(stat.label || stat.value || ""),
        color: stat.color || color,
      })),
    );
    const statColumns = Math.min(3, Math.max(1, statItems.length));
    const statRows = Math.ceil(statItems.length / statColumns);
    const pillGap = 8;
    const statBlockH = statRows * statH + (statRows - 1) * pillGap;
    let imageSize = Math.min(
      cfg.imageBoxSize,
      panelW - padding * 2,
      Math.max(140, maxPanelH * 0.46),
    );
    let contentH =
      padding * 2 + titleH + gap + imageSize + gap + statBlockH + gap + buttonH;
    if (contentH > maxPanelH) {
      imageSize = Math.max(120, imageSize - (contentH - maxPanelH));
      contentH =
        padding * 2 +
        titleH +
        gap +
        imageSize +
        gap +
        statBlockH +
        gap +
        buttonH;
    }
    const panelH = Math.min(
      maxPanelH,
      Math.max(contentH, Math.min(cfg.panelMinHeight, maxPanelH)),
    );
    const panelX = (canvasWidth - panelW) / 2;
    const panelY = (canvasHeight - panelH) / 2;

    ctx.save();
    if (cfg.blurPx > 0) {
      ctx.filter = `blur(${cfg.blurPx}px)`;
      ctx.drawImage(this.#canvas, 0, 0, canvasWidth, canvasHeight);
      ctx.filter = "none";
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.48)";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.shadowColor = this.#rgba(color, 0.35);
    ctx.shadowBlur = theme.isUnique ? 34 : 20;
    this.#roundedRect(ctx, panelX, panelY, panelW, panelH, cfg.panelRadius);
    ctx.fillStyle = this.#rgba(color, theme.isUnique ? 0.2 : 0.15);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = this.#rgba(color, 0.75);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const fishName = fish?.name || "Unknown fish";
    this.#drawFittedText(
      "Caught",
      panelX + panelW / 2,
      panelY + padding + 10,
      panelW - padding * 2,
      { size: 14, family: "sans-serif", weight: "bold" },
      this.#rgba(color, 0.9),
    );
    this.#drawFittedText(
      fishName,
      panelX + panelW / 2,
      panelY + padding + 34,
      panelW - padding * 2,
      { size: 24, family: "sans-serif", weight: "bold" },
      "#ffffff",
    );

    const imageX = panelX + (panelW - imageSize) / 2;
    const imageY = panelY + padding + titleH + gap;
    const pulseNow =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const pulse =
      0.5 +
      Math.sin((pulseNow / Math.max(1, cfg.uniqueGlowPulseMs)) * Math.PI * 2) *
        0.5;

    ctx.fillStyle = "rgba(5, 10, 16, 0.75)";
    ctx.fillRect(imageX, imageY, imageSize, imageSize);
    const image = this.#getCachedImage(
      fish?.imagePath ||
        `assets/fish/${fish?.id || "unknown"}/${fish?.id || "unknown"}--${
          fish?.level || 1
        }.webp`,
    );
    if (image) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(imageX, imageY, imageSize, imageSize);
      ctx.clip();
      this.#drawImageCover(image, imageX, imageY, imageSize, imageSize);
      ctx.restore();
    } else {
      this.#drawFittedText(
        "loading...",
        imageX + imageSize / 2,
        imageY + imageSize / 2,
        imageSize - 20,
        { size: 14, family: "monospace", weight: "bold" },
        this.#rgba(color, 0.85),
      );
    }

    if (theme.isUnique) {
      ctx.shadowColor = this.#rgba(color, 0.95);
      ctx.shadowBlur = 14 + pulse * 18;
    }
    ctx.strokeStyle = this.#rgba(color, 1);
    ctx.lineWidth = cfg.imageBorderWidth;
    ctx.strokeRect(imageX, imageY, imageSize, imageSize);
    ctx.shadowBlur = 0;

    const badgeSize = Math.min(44, Math.max(34, imageSize * 0.17));
    ctx.fillStyle = "rgba(22, 24, 28, 0.9)";
    ctx.fillRect(imageX, imageY, badgeSize, badgeSize);
    ctx.strokeStyle = this.#rgba(color, 0.9);
    ctx.lineWidth = 1;
    ctx.strokeRect(imageX, imageY, badgeSize, badgeSize);
    this.#drawFittedText(
      String(fish?.level || 1),
      imageX + badgeSize / 2,
      imageY + badgeSize / 2,
      badgeSize - 8,
      { size: 22, family: "monospace", weight: "bold" },
      this.#rgba(color, 1),
    );

    const statsY = imageY + imageSize + gap;
    const pillW =
      (panelW - padding * 2 - pillGap * (statColumns - 1)) / statColumns;
    for (let i = 0; i < statItems.length; i++) {
      const col = i % statColumns;
      const row = Math.floor(i / statColumns);
      this.#drawVictoryPill(
        panelX + padding + col * (pillW + pillGap),
        statsY + row * (statH + pillGap),
        pillW,
        statH,
        statItems[i].label,
        statItems[i].color,
      );
    }

    const buttonsY = statsY + statBlockH + gap;
    const buttonW = Math.min(
      cfg.buttonWidth,
      (panelW - padding * 2 - cfg.buttonGap) / 2,
    );
    const buttonsX = panelX + (panelW - buttonW * 2 - cfg.buttonGap) / 2;
    this.#drawVictoryButton(
      buttonsX,
      buttonsY,
      buttonW,
      buttonH,
      "Claim",
      color,
      true,
    );
    this.#drawVictoryButton(
      buttonsX + buttonW + cfg.buttonGap,
      buttonsY,
      buttonW,
      buttonH,
      "Release",
      [145, 150, 160],
      false,
    );
    ctx.restore();
  }
}
