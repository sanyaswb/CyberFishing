class Renderer {
  #canvas;
  #ctx;
  #screenA = new Vector2(0, 0);
  #screenB = new Vector2(0, 0);
  #imageCache = new Map();
  #hudStyleResolver;
  #hudBarRenderer;

  constructor(canvas) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext("2d", { alpha: false });
    this.#hudStyleResolver = typeof HudStyleResolver !== "undefined"
      ? new HudStyleResolver()
      : null;
    this.#hudBarRenderer = typeof HudBarRenderer !== "undefined"
      ? new HudBarRenderer(this.#ctx)
      : null;
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

  #resolveHudBarStyle(path, overrides = null) {
    if (this.#hudStyleResolver) {
      return this.#hudStyleResolver.resolveBarStyle(path, { overrides });
    }
    return { ...(overrides || {}) };
  }

  #getHudBarsLayout() {
    return this.#resolveHudBarStyle("layout");
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
    zoneContext = null,
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
    const showLastDash = locationsConfig.showLastDashZone === true;
    const showNet = locationsConfig.showNetZone !== false;
    const landingDistanceMeters = Math.max(
      0,
      Number(zoneContext?.landingDistanceMeters) || 0,
    );
    const lastDashDistanceMeters = Math.max(
      0,
      Number(zoneContext?.lastDashTriggerDistanceMeters) || 0,
    );
    const pixelsPerMeter = Math.max(
      1,
      Number(zoneContext?.pixelsPerMeter) || 50,
    );
    const hasLandingCircle =
      landingDistanceMeters > 0 &&
      Number.isFinite(Number(zoneContext?.rodVirtualX)) &&
      Number.isFinite(Number(zoneContext?.rodVirtualY));

    if (showLastDash && hasLandingCircle && lastDashDistanceMeters > 0) {
      this.#withCastableClip(projector, locationsConfig, () => {
        const virtualTriggerY =
          zoneContext.rodVirtualY - lastDashDistanceMeters * pixelsPerMeter;
        const triggerScreenY = projector.virtualToScreen(
          0,
          virtualTriggerY,
          this.#screenB,
        ).y;
        const zoneTopY = Math.max(0, Math.min(triggerScreenY, catchScreenY));
        const zoneHeight = Math.max(0, catchScreenY - zoneTopY);
        if (zoneHeight > 0) {
          this.#ctx.fillStyle =
            catchZoneUIConfig?.lastDashFillColor ||
            "rgba(170, 80, 255, 0.12)";
          this.#ctx.fillRect(0, zoneTopY, this.#canvas.width, zoneHeight);
        }

        this.#ctx.strokeStyle =
          catchZoneUIConfig?.lastDashStrokeColor || "rgba(190, 90, 255, 0.9)";
        this.#ctx.lineWidth = 2;
        this.#ctx.setLineDash(catchZoneUIConfig?.lastDashDash || [9, 7]);
        this.#ctx.beginPath();
        this.#ctx.moveTo(0, zoneTopY);
        this.#ctx.lineTo(this.#canvas.width, zoneTopY);
        this.#ctx.stroke();
        this.#ctx.setLineDash([]);
      });
    }

    if (showCatch) {
      if (hasLandingCircle) {
        this.#withCastableClip(projector, locationsConfig, () => {
          this.#drawDistanceZoneEllipse(projector, {
            centerVirtualX: zoneContext.rodVirtualX,
            centerVirtualY: zoneContext.rodVirtualY,
            radiusMeters: landingDistanceMeters,
            pixelsPerMeter,
            fillColor: catchZoneUIConfig?.color || "rgba(0, 150, 255, 0.3)",
            strokeColor:
              catchZoneUIConfig?.strokeColor || "rgba(0, 200, 255, 0.8)",
            lineWidth: 2,
          });
        });
      } else {
        this.#withCastableClip(projector, locationsConfig, () => {
          const heightToDraw = this.#canvas.height - catchScreenY;

          if (heightToDraw > 0) {
            this.#ctx.fillStyle =
              catchZoneUIConfig?.color || "rgba(0, 150, 255, 0.3)";
            this.#ctx.fillRect(0, catchScreenY, this.#canvas.width, heightToDraw);
          }

          const lineDrawY = Math.min(catchScreenY, this.#canvas.height - 2);
          this.#ctx.strokeStyle =
            catchZoneUIConfig?.strokeColor || "rgba(0, 200, 255, 0.8)";
          this.#ctx.lineWidth = 2;
          this.#ctx.beginPath();
          this.#ctx.moveTo(0, lineDrawY);
          this.#ctx.lineTo(this.#canvas.width, lineDrawY);
          this.#ctx.stroke();
        });
      }
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

  drawPoleFightSector(projector, locationsConfig, sectorFrame) {
    if (!locationsConfig?.debugVisuals) return;

    const showSector = locationsConfig.showPoleFightSector === true;
    const showLineRadius = locationsConfig.showFightLineRadius === true;
    if (!showSector && !showLineRadius) return;

    const originX = Number(sectorFrame?.poleFightSectorOriginX);
    const originY = Number(sectorFrame?.poleFightSectorOriginY);
    const apexX = Number(
      sectorFrame?.poleFightSectorApexX ??
      sectorFrame?.poleFightSectorOriginX,
    );
    const apexY = Number(
      sectorFrame?.poleFightSectorApexY ??
      sectorFrame?.poleFightSectorOriginY,
    );
    const leftIntersectionX = Number(
      sectorFrame?.poleFightSectorLeftBoundaryRadiusIntersectionX,
    );
    const leftIntersectionY = Number(
      sectorFrame?.poleFightSectorLeftBoundaryRadiusIntersectionY,
    );
    const rightIntersectionX = Number(
      sectorFrame?.poleFightSectorRightBoundaryRadiusIntersectionX,
    );
    const rightIntersectionY = Number(
      sectorFrame?.poleFightSectorRightBoundaryRadiusIntersectionY,
    );
    const radiusVirtualPx = Math.max(
      0,
      Number(sectorFrame?.poleFightSectorLimitRadiusPx) || 0,
    );
    const maxAngleDeg = Math.max(
      0,
      Math.min(
        89.9,
        Number(sectorFrame?.poleFightSectorMaxAngleDeg) || 0,
      ),
    );
    const hasGeometry =
      Number.isFinite(originX) &&
      Number.isFinite(originY) &&
      Number.isFinite(apexX) &&
      Number.isFinite(apexY) &&
      radiusVirtualPx > 0.000001;
    if (!hasGeometry) return;

    const centerScreen = projector.virtualToScreen(
      originX,
      originY,
      this.#screenA,
    );
    const centerX = centerScreen.x;
    const centerY = centerScreen.y;
    const apexScreen = projector.virtualToScreen(
      apexX,
      apexY,
      this.#screenB,
    );
    const apexScreenX = apexScreen.x;
    const apexScreenY = apexScreen.y;
    const clamped = sectorFrame?.poleFightSectorClamped === true;
    const arcSegments = 64;

    this.#withCastableClip(projector, locationsConfig, () => {
      this.#ctx.save();

      if (showSector && maxAngleDeg > 0) {
        const hasBoundaryIntersections =
          Number.isFinite(leftIntersectionX) &&
          Number.isFinite(leftIntersectionY) &&
          Number.isFinite(rightIntersectionX) &&
          Number.isFinite(rightIntersectionY);
        const leftAngleDeg = hasBoundaryIntersections
          ? Math.atan2(
              leftIntersectionX - originX,
              -(leftIntersectionY - originY),
            ) * 180 / Math.PI
          : -maxAngleDeg;
        const rightAngleDeg = hasBoundaryIntersections
          ? Math.atan2(
              rightIntersectionX - originX,
              -(rightIntersectionY - originY),
            ) * 180 / Math.PI
          : maxAngleDeg;
        this.#ctx.beginPath();
        this.#ctx.moveTo(apexScreenX, apexScreenY);
        for (let index = 0; index <= arcSegments; index += 1) {
          const ratio = index / arcSegments;
          const angleDeg =
            leftAngleDeg + (rightAngleDeg - leftAngleDeg) * ratio;
          const angleRad = angleDeg * Math.PI / 180;
          const virtualX = originX + Math.sin(angleRad) * radiusVirtualPx;
          const virtualY = originY - Math.cos(angleRad) * radiusVirtualPx;
          const point = projector.virtualToScreen(
            virtualX,
            virtualY,
            this.#screenA,
          );
          this.#ctx.lineTo(point.x, point.y);
        }
        this.#ctx.closePath();
        this.#ctx.fillStyle = clamped
          ? "rgba(210, 35, 25, 0.32)"
          : "rgba(175, 0, 35, 0.28)";
        this.#ctx.fill();

        this.#ctx.strokeStyle = clamped
          ? "rgba(255, 145, 35, 1)"
          : "rgba(255, 70, 70, 0.98)";
        this.#ctx.lineWidth = 3;
        this.#ctx.setLineDash([]);
        this.#ctx.stroke();

        this.#ctx.beginPath();
        this.#ctx.moveTo(apexScreenX, apexScreenY);
        const centerEnd = projector.virtualToScreen(
          originX,
          originY - radiusVirtualPx,
          this.#screenA,
        );
        this.#ctx.lineTo(centerEnd.x, centerEnd.y);
        this.#ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
        this.#ctx.lineWidth = 2;
        this.#ctx.setLineDash([6, 8]);
        this.#ctx.stroke();
        this.#ctx.setLineDash([]);
      }

      if (showLineRadius) {
        this.#ctx.beginPath();
        for (let index = 0; index <= arcSegments; index += 1) {
          const ratio = index / arcSegments;
          const angleDeg = -90 + 180 * ratio;
          const angleRad = angleDeg * Math.PI / 180;
          const virtualX = originX + Math.sin(angleRad) * radiusVirtualPx;
          const virtualY = originY - Math.cos(angleRad) * radiusVirtualPx;
          const point = projector.virtualToScreen(
            virtualX,
            virtualY,
            this.#screenA,
          );
          if (index === 0) this.#ctx.moveTo(point.x, point.y);
          else this.#ctx.lineTo(point.x, point.y);
        }
        this.#ctx.strokeStyle = "rgba(255, 230, 0, 0.98)";
        this.#ctx.lineWidth = 4;
        this.#ctx.setLineDash([]);
        this.#ctx.stroke();
      }

      this.#ctx.restore();
    });
  }

  #drawDistanceZoneEllipse(
    projector,
    {
      centerVirtualX,
      centerVirtualY,
      radiusMeters,
      pixelsPerMeter,
      fillColor,
      strokeColor,
      lineWidth = 2,
      dash = null,
    },
  ) {
    const center = projector.virtualToScreen(
      centerVirtualX,
      centerVirtualY,
      this.#screenA,
    );
    const radiusX =
      Math.max(0, Number(radiusMeters) || 0) *
      Math.max(1, Number(pixelsPerMeter) || 50) *
      projector.getScale();
    const radiusY = radiusX;
    if (radiusX <= 0 || radiusY <= 0) return;

    this.#ctx.save();
    if (Array.isArray(dash)) this.#ctx.setLineDash(dash);
    this.#ctx.beginPath();
    this.#ctx.ellipse(center.x, center.y, radiusX, radiusY, 0, 0, Math.PI * 2);
    if (fillColor) {
      this.#ctx.fillStyle = fillColor;
      this.#ctx.fill();
    }
    if (strokeColor) {
      this.#ctx.strokeStyle = strokeColor;
      this.#ctx.lineWidth = lineWidth;
      this.#ctx.stroke();
    }
    this.#ctx.restore();
  }

  #withCastableClip(projector, locationsConfig, drawFn) {
    if (!locationsConfig) {
      drawFn();
      return;
    }

    const zones = this.#getCastableZones(locationsConfig);
    if (!zones.length) {
      drawFn();
      return;
    }

    this.#ctx.save();
    this.#ctx.beginPath();
    for (const zone of zones) {
      const rect = this.#getCastableZoneScreenRect(
        projector,
        zone,
        locationsConfig.cellSize,
      );
      if (!rect || rect.width <= 0 || rect.height <= 0) continue;
      this.#ctx.rect(rect.x, rect.y, rect.width, rect.height);
    }
    this.#ctx.clip();
    drawFn();
    this.#ctx.restore();
  }

  #getCastableZones(locationsConfig) {
    const maps = locationsConfig.map || {};
    const locationId = locationsConfig.currentLocationId || Object.keys(maps)[0];
    return maps[locationId]?.zones?.castable || [];
  }

  #getCastableZoneScreenRect(projector, zone, cellSize = 40) {
    const size = Math.max(1, Number(cellSize) || 40);
    let left = Number(zone.x) * size;
    let right = (Number(zone.x) + Number(zone.w)) * size;

    if (zone.adaptiveX) {
      left = projector.screenToVirtual(0, 0, this.#screenA).x;
      right = projector.screenToVirtual(this.#canvas.width, 0, this.#screenB).x;
    }

    const top = Number(zone.y) * size;
    const bottom = (Number(zone.y) + Number(zone.h)) * size;
    if (![left, right, top, bottom].every(Number.isFinite)) return null;

    const screenA = projector.virtualToScreen(left, top, this.#screenA);
    const x1 = screenA.x;
    const y1 = screenA.y;
    const screenB = projector.virtualToScreen(right, bottom, this.#screenB);
    const x2 = screenB.x;
    const y2 = screenB.y;

    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  }

  drawChumZones(chumManager, projector, locationsConfig = null) {
    const zones = chumManager.getZones();

    this.#withCastableClip(projector, locationsConfig, () => {
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
    });
  }

  drawAimingZone(
    projector,
    virtualBottomY,
    maxDist,
    type = "chum",
    locationsConfig = null,
  ) {
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

    this.#withCastableClip(projector, locationsConfig, () => {
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
    });
  }

  drawCastPowerAim(
    projector,
    bounds,
    visual,
    castingConfig,
    tensionConfig,
    nowMs = 0,
    maxDistancePx = null,
  ) {
    if (!visual?.active) return;
    const lineCfg = castingConfig?.aimLine || {};
    const power = Math.max(0, Math.min(1, visual.power || 0));
    const tensionStyle = this.#resolveHudBarStyle("tension");
    const color = this.#ratioGradientColor(
      power * 100,
      tensionStyle.gradient,
    );
    const lineColor =
      visual.mode === "chum"
        ? lineCfg.chumColor || "rgba(255, 180, 0, 0.9)"
        : lineCfg.color || "rgba(0, 220, 255, 0.85)";

    this.#drawCastAimLine(
      projector,
      bounds,
      visual.screenX,
      lineCfg,
      lineColor,
      nowMs,
      maxDistancePx,
      power,
    );
    this.#drawCastPowerBar(power, color, visual.mode);
  }

  drawCastAccuracyPreview(preview, debugConfig) {
    const radiusX = preview?.radiusX ?? preview?.radiusPx ?? 0;
    const radiusY = preview?.radiusY ?? preview?.radiusPx ?? 0;
    if (!preview?.active || radiusX <= 0 || radiusY <= 0) return;
    this.#ctx.save();
    this.#ctx.beginPath();
    this.#ctx.ellipse(preview.x, preview.y, radiusX, radiusY, 0, 0, Math.PI * 2);
    this.#ctx.fillStyle =
      debugConfig?.accuracyAreaFill || "rgba(255, 255, 255, 0.08)";
    this.#ctx.strokeStyle =
      debugConfig?.accuracyAreaStroke || "rgba(255, 255, 255, 0.55)";
    this.#ctx.lineWidth = debugConfig?.accuracyAreaLineWidth || 1;
    this.#ctx.setLineDash(debugConfig?.accuracyAreaDash || [6, 6]);
    this.#ctx.fill();
    this.#ctx.stroke();
    this.#ctx.restore();
  }

  #drawCastAimLine(
    projector,
    bounds,
    screenX,
    lineCfg,
    color,
    nowMs,
    maxDistancePx,
    power,
  ) {
    const mapHeightPx = Math.max(0, bounds.bottom - bounds.top);
    let resolvedMaxDistancePx = Number(maxDistancePx);
    if (!Number.isFinite(resolvedMaxDistancePx)) {
      resolvedMaxDistancePx = mapHeightPx;
    }

    const linePower =
      lineCfg.fullDistance === false ? Math.max(0, Math.min(1, power || 0)) : 1;
    const distancePx = Math.max(
      0,
      Math.min(resolvedMaxDistancePx, mapHeightPx) *
        linePower,
    );
    const bottomScreenY = projector.virtualToScreen(
      0,
      bounds.bottom,
      this.#screenB,
    ).y;
    const targetVirtualY = Math.max(bounds.top, bounds.bottom - distancePx);
    const targetScreenY = projector.virtualToScreen(
      0,
      targetVirtualY,
      this.#screenA,
    ).y;
    const dash = Array.isArray(lineCfg.dash) ? lineCfg.dash : [12, 10];
    const dashSpeed = lineCfg.dashSpeedPxPerSecond ?? 42;
    const dashCycle = Math.max(1, dash[0] + (dash[1] || 0));

    this.#ctx.save();
    this.#ctx.beginPath();
    this.#ctx.moveTo(screenX, bottomScreenY);
    this.#ctx.lineTo(screenX, targetScreenY);
    this.#ctx.strokeStyle = color;
    this.#ctx.lineWidth = lineCfg.width || 2;
    this.#ctx.setLineDash(dash);
    this.#ctx.lineDashOffset = -(((nowMs / 1000) * dashSpeed) % dashCycle);
    this.#ctx.shadowColor = color;
    this.#ctx.shadowBlur = lineCfg.glowBlur || 0;
    this.#ctx.stroke();
    this.#ctx.restore();
  }

  #drawCastPowerBar(power, fillColor, mode) {
    const style = this.#resolveHudBarStyle("castPower");
    const barWidth = style.width || 300;
    const barHeight = style.height || 12;
    const barX = this.#resolveX(style.x || "center", barWidth);
    const barY = style.y || 18;

    if (this.#hudBarRenderer) {
      this.#hudBarRenderer.drawFramedRatioBar({
        ratio: power,
        x: barX,
        y: barY,
        width: barWidth,
      height: barHeight,
      style,
      fillColor,
      topLabel: mode === "chum" ? "CHUM" : "CAST",
      rightValue: `${Math.round(power * 100)}%`,
    });
  }
  }

  #ratioGradientColor(value, gradient) {
    if (!gradient) return "#00ccff";
    const tension = Math.max(0, Math.min(100, value));
    const lowPoint = gradient.breakpoints?.low ?? 33;
    const midPoint = gradient.breakpoints?.mid ?? 66;

    if (tension < lowPoint) {
      return this.#interpolateRgb(
        gradient.low?.start || [0, 0, 255],
        gradient.low?.end || [255, 255, 0],
        tension / lowPoint,
      );
    }
    if (tension < midPoint) {
      return this.#interpolateRgb(
        gradient.mid?.start || [255, 255, 0],
        gradient.mid?.end || [255, 128, 0],
        (tension - lowPoint) / Math.max(1, midPoint - lowPoint),
      );
    }
    return this.#interpolateRgb(
      gradient.high?.start || [255, 128, 0],
      gradient.high?.end || [255, 0, 0],
      (tension - midPoint) / Math.max(1, 100 - midPoint),
    );
  }

  #interpolateRgb(start, end, ratio) {
    const t = Math.max(0, Math.min(1, ratio));
    const r = Math.round(start[0] + (end[0] - start[0]) * t);
    const g = Math.round(start[1] + (end[1] - start[1]) * t);
    const b = Math.round(start[2] + (end[2] - start[2]) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  #getTensionStatus(tension, statuses = []) {
    if (!Array.isArray(statuses) || statuses.length === 0) {
      return { label: "Idle", color: "#4a5b6c" };
    }

    let current = statuses[0];
    for (const status of statuses) {
      if (tension >= status.threshold) current = status;
    }
    return {
      label: current?.label || "Idle",
      color: current?.color || "#4a5b6c",
    };
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
    lineStraightFactor = null,
    rodScreenXOverride = null,
  ) {
    const rodWidth = 3;
    const rodHeight = 200;

    let rodBaseX = Number.isFinite(rodScreenXOverride)
      ? rodScreenXOverride
      : this.#resolveX(uiRodConfig?.x, rodWidth);
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

    let straightFactor =
      lineStraightFactor === null || lineStraightFactor === undefined
        ? 0
        : Math.min(1, Math.max(0, lineStraightFactor));
    if (lineStraightFactor === null && gameState === "playing") {
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

  drawFishCondition(condition) {
    const layout = this.#getHudBarsLayout();
    const conditionStyle = this.#resolveHudBarStyle("fishCondition");
    const barWidth = conditionStyle.width || 220;
    const barHeight = conditionStyle.height || 10;
    const barX = this.#resolveX(layout.x, barWidth);
    const barY = layout.y || 40;
    const gap = conditionStyle.gap || 22;
    const maxStamina = Math.max(
      0.001,
      Number(condition.maxStamina ?? condition.maxPoints) || 0,
    );
    const maxEndurance = Math.max(
      0.001,
      Number(condition.maxEndurance ?? condition.maxPoints) || 0,
    );
    const staminaRatio = Math.max(
      0,
      Math.min(1, condition.currentStamina / maxStamina),
    );
    const exhaustionRatio = Math.max(
      0,
      Math.min(1, condition.currentExhaustion / maxEndurance),
    );

    this.#drawConditionBar({
      x: barX,
      y: barY,
      width: barWidth,
      height: barHeight,
      ratio: staminaRatio,
      style: this.#resolveHudBarStyle("fishCondition.stamina", conditionStyle),
      label: "STAMINA",
      value: `${Math.round(condition.currentStamina)}/${Math.round(maxStamina)}`,
      isActive: condition.phase === "stamina",
    });

    this.#drawConditionBar({
      x: barX,
      y: barY + gap,
      width: barWidth,
      height: barHeight,
      ratio: exhaustionRatio,
      style: this.#resolveHudBarStyle("fishCondition.exhaustion", conditionStyle),
      label: "ENDURANCE",
      value: `${Math.round(condition.currentExhaustion)}/${Math.round(maxEndurance)}`,
      isActive: condition.phase === "exhaustion",
    });
  }

  #drawConditionBar({
    x,
    y,
    width,
    height,
    ratio,
    style,
    label,
    value,
    isActive,
  }) {
    const fillColor = style.fillColor || "#ffcc00";
    const drawStyle = {
      ...style,
      borderColor: isActive ? fillColor : style.borderColor || "#333",
      borderWidth: isActive
        ? style.activeBorderWidth ?? 2
        : style.inactiveBorderWidth ?? style.borderWidth ?? 1,
      labelColor: isActive
        ? style.activeLabelColor || "#ffffff"
        : style.labelColor || "#8a9bac",
      valueColor: isActive
        ? style.activeLabelColor || "#ffffff"
        : style.valueColor || style.labelColor || "#8a9bac",
    };
    this.#hudBarRenderer.drawFramedRatioBar({
      x,
      y,
      width,
      height,
      ratio,
      style: drawStyle,
      fillColor,
      topLabel: label,
      rightValue: value,
    });
  }

  drawDragBar(dragRatio, dragConfig, tensionConfig) {
    const fightLayout = this.#getFightBarLayout();
    const tensionStyle = this.#resolveHudBarStyle("tension");
    const dragStyle = this.#resolveHudBarStyle("drag", {
      fillColor: dragConfig?.barColor,
    });
    const width = fightLayout.width;
    const height = dragStyle.height ||
      Math.max(dragStyle.minHeight ?? 8, Math.round((tensionStyle.height || 20) * (dragStyle.heightRatio ?? 0.65)));
    const x = fightLayout.x;
    const y = fightLayout.tensionY + (tensionStyle.height || 20) + (dragStyle.yOffset ?? 14);
    this.#drawSimpleRatioBar({
      ratio: dragRatio,
      x,
      y,
      width,
      height,
      label: "DRAG",
      style: {
        ...dragStyle,
      },
    });
  }

  #getFightBarLayout() {
    const layout = this.#getHudBarsLayout();
    const tensionStyle = this.#resolveHudBarStyle("tension");
    const rodStrokeStyle = this.#resolveHudBarStyle("rodStroke");
    const rodControlStyle = this.#resolveHudBarStyle("rodControl");
    const width = tensionStyle.width || 300;
    const x = this.#resolveX(layout.x, width);
    const baseY = layout.y || 40;
    const spacing = layout.spacing || 40;
    const strokeHeight = rodStrokeStyle.height || 3;
    const controlHeight = rodControlStyle.height || strokeHeight;
    const strokeY = baseY + spacing;
    const controlY = strokeY - controlHeight + (rodControlStyle.yOffset ?? -28);
    return {
      x,
      width,
      strokeHeight,
      controlHeight,
      controlY,
      strokeY,
      tensionY: strokeY + strokeHeight + (layout.tensionGapFromStroke ?? 34),
    };
  }

  drawRodStrokeBar(fightDebug) {
    const layout = this.#getFightBarLayout();
    this.#drawRodControlBar(fightDebug, layout);
    const ratio = Math.max(0, Math.min(1, Number(fightDebug?.rodStrokeRatio) || 0));
    const unrecovered = Number(fightDebug?.rodStrokeUnrecoveredMeters) || 0;
    const capacity = Number(fightDebug?.rodStrokeCapacityMeters) || 0;
    const label = "Хід вудки";
    const value = `${unrecovered.toFixed(1)}м / ${capacity.toFixed(1)}м`;
    const style = this.#resolveHudBarStyle("rodStroke", {
    });

    this.#drawThinLabeledRatioBar({
      ratio,
      x: layout.x,
      y: layout.strokeY,
      width: layout.width,
      height: layout.strokeHeight,
      label,
      value,
      style,
    });
  }

  #drawRodControlBar(fightDebug, layout) {
    const ratio = Math.max(
      0,
      Math.min(1, Number(fightDebug?.rodControlDeliveredForceRatio) || 0),
    );
    const direction = Math.sign(
      Number(fightDebug?.rodControlInputDirectionX) ||
        Number(fightDebug?.rodControlDirectionX) ||
        0,
    );
    const active = !!fightDebug?.rodControlActive;
    const label = "Контроль вудки";
    const directionLabel = direction < 0 ? "L" : direction > 0 ? "R" : "-";
    const value = `${directionLabel} ${(ratio * 100).toFixed(0)}%`;
    const style = this.#resolveHudBarStyle("rodControl", {
    });
    this.#drawThinLabeledRatioBar({
      ratio,
      x: layout.x,
      y: layout.controlY,
      width: layout.width,
      height: layout.controlHeight,
      label,
      value,
      style: {
        ...style,
        fillColor: active
          ? style.activeColor || "#00d4ff"
          : style.inactiveColor || "#5c7d99",
      },
    });
  }

  drawRodPullBar(fightDebug) {
    this.drawRodStrokeBar(fightDebug);
  }

  #drawSimpleRatioBar({
    ratio,
    x,
    y,
    width,
    height,
    label,
    style,
  }) {
    const clampedRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
    this.#hudBarRenderer.drawFramedRatioBar({
      ratio: clampedRatio,
      x,
      y,
      width,
      height,
      style,
      fillColor: style.fillColor,
      topLabel: label,
      rightValue: `${Math.round(clampedRatio * 100)}%`,
    });
  }

  #drawThinLabeledRatioBar({
    ratio,
    x,
    y,
    width,
    height,
    label,
    value,
    style,
  }) {
    const clampedRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
    this.#ctx.save();
    this.#ctx.fillStyle = style.backgroundColor || "rgba(58, 126, 210, 0.26)";
    this.#ctx.fillRect(x, y, width, height);
    this.#ctx.fillStyle = style.fillColor || "#4aa3ff";
    this.#ctx.fillRect(x, y, width * clampedRatio, height);

    this.#ctx.fillStyle = style.labelColor || "#8a9bac";
    this.#ctx.font = style.labelFont || "bold 12px monospace";
    this.#ctx.textAlign = "center";
    this.#ctx.textBaseline = "bottom";
    this.#ctx.fillText(
      label,
      x + width / 2,
      y - (style.labelGap ?? 5),
    );
    this.#ctx.fillStyle = style.valueColor || style.labelColor || "#8a9bac";
    this.#ctx.font = style.valueFont || style.labelFont || "bold 12px monospace";
    const valuePlacement = style.valuePlacement === "center" ? "center" : "rightInside";
    this.#ctx.textAlign = valuePlacement === "center" ? "center" : "right";
    this.#ctx.textBaseline = "middle";
    this.#ctx.fillText(
      value,
      valuePlacement === "center" ? x + width / 2 : x + width - (style.valueGap ?? 6),
      y + height / 2,
    );
    this.#ctx.restore();
  }

  drawTensionBar(tensionMeter, tensionConfig, fightDebug = null) {
    const layout = this.#getFightBarLayout();
    const barWidth = layout.width;
    const tensionStyle = this.#resolveHudBarStyle("tension");
    const barHeight = tensionStyle.height || 20;
    const barX = layout.x;
    const barY = layout.tensionY;

    const tension = tensionMeter.getTension();
    const pulseIntensity = tensionMeter.getPulseIntensity(tensionConfig);
    const tensionKg = tensionMeter.getTensionKg?.();
    const maxLoadKg = tensionMeter.getEffectiveMaxTackleLoadKg?.();
    const fillColor = this.#ratioGradientColor(
      tension,
      tensionStyle.gradient,
    );
    const dragLimitKg = Number(fightDebug?.dragLimitKg);
    const maxLoadForMarker = Number(maxLoadKg);
    const shouldDrawDragMarker = fightDebug?.dragSupported === true;
    const kgPrecision = Number.isFinite(maxLoadKg) && maxLoadKg <= 3 ? 2 : 1;
    const tensionValue = Number.isFinite(tensionKg) && Number.isFinite(maxLoadKg)
      ? `${tensionKg.toFixed(kgPrecision)}/${maxLoadKg.toFixed(kgPrecision)}кг`
      : Number.isFinite(tensionKg)
        ? `${tensionKg.toFixed(kgPrecision)}кг`
        : `${Math.round(tension)}%`;

    const status = this.#getTensionStatus(
      tension,
      tensionStyle.statuses,
    );
    const statusColor = status.color || tensionStyle.labelColor;
    this.#hudBarRenderer.drawFramedRatioBar({
      ratio: tension / 100,
      x: barX,
      y: barY,
      width: barWidth,
      height: barHeight,
      style: {
        ...tensionStyle,
        glowIntensity: pulseIntensity * (tensionStyle.glowIntensity ?? 0.6),
        labelColor: tensionStyle.labelColor,
        valueColor: statusColor,
      },
      fillColor,
      topLabel: "НАТЯГ",
      rightValue: tensionValue,
      marker: {
        enabled: shouldDrawDragMarker &&
          Number.isFinite(dragLimitKg) &&
          Number.isFinite(maxLoadForMarker) &&
          maxLoadForMarker > 0,
        ratio: Number.isFinite(maxLoadForMarker) && maxLoadForMarker > 0
          ? dragLimitKg / maxLoadForMarker
          : 0,
        color: tensionStyle.dragMarkerColor || tensionStyle.markerColor || "#73c2fb",
        width: 2,
        extendPx: 4,
      },
    });

    const stressRatio = Math.max(
      0,
      Math.min(1, Number(tensionMeter.getStressRatio?.()) || 0),
    );
    if (stressRatio > 0 || tension >= tensionConfig.breakThreshold - 0.1) {
      const breakReason =
        tensionMeter.getBreakTargetReason?.() ||
        tensionMeter.getBreakReason?.() ||
        "line";
      const stressStyle = this.#resolveHudBarStyle("tackleStress");
      this.#drawTackleStressBar(
        barX,
        barY + (stressStyle.yOffset ?? -25),
        barWidth,
        stressRatio,
        breakReason,
      );
    }
  }

  #drawTackleStressBar(x, y, width, progress, reason = "line") {
    const style = this.#resolveHudBarStyle("tackleStress");
    this.#hudBarRenderer.drawThinProgressBar({
      x,
      y,
      width,
      height: style.height || 8,
      ratio: progress,
      style,
      label: this.#tackleStressLabel(reason, style),
      value: `${Math.round(progress * 100)}%`,
    });
  }

  #tackleStressLabel(reason, style = {}) {
    const prefix = style.labelPrefix || "STRESS";
    if (reason === "rod") return `${prefix}: ROD`;
    if (reason === "leader") return `${prefix}: LEADER`;
    return `${prefix}: LINE`;
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
      desc = "Your rod could not handle the stress.";
    } else if (reason === "leader") {
      title = "LEADER SNAPPED";
      titleColor = "#ff6644";
      desc = "The leader was the weakest part of the rig.";
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
        label: fish?.isTrophy ? "✓ Trophy" : "❌ Not trophy",
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
