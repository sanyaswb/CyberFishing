import { Vector2 } from "../../../engine/math/vector2.js";

export class ViewportProjector {
  #locationsConfig;
  #locationId;
  #virtualWidth;
  #virtualHeight;
  #canvasWidth;
  #canvasHeight;
  #scale;
  #offsetX;
  #offsetY;

  #cameraX;
  #cameraY;
  #maxScrollX;
  #maxScrollY;

  #isFirstUpdate;
  #snapNextFocus;

  constructor(locationsConfig, locationId, getPerspective) {
    this.#locationsConfig = locationsConfig;
    this.#locationId = locationId;
    this.getPerspective = getPerspective;
    this.#virtualWidth = locationsConfig.baseResolution.width;
    this.#virtualHeight = locationsConfig.baseResolution.height;

    this.#scale = 1;
    this.#offsetX = 0;
    this.#offsetY = 0;
    this.#cameraX = 0;
    this.#cameraY = 0;
    this.#maxScrollX = 0;
    this.#maxScrollY = 0;
    this.#canvasWidth = 0;
    this.#canvasHeight = 0;
    this.#isFirstUpdate = true;
    this.#snapNextFocus = false;
  }

  update(canvasWidth, canvasHeight) {
    const mapConfig = this.#locationsConfig.map[this.#locationId];
    const safeZoneTop = mapConfig.safeZone.top;
    const safeZoneBottom = mapConfig.safeZone.bottom;
    const alignment = mapConfig.initialAlignment || {
      x: "center",
      y: "safeZone",
    };

    const resized = canvasWidth !== this.#canvasWidth || canvasHeight !== this.#canvasHeight;
    // A resize keeps the scene point at the centre of the screen horizontally (spec 105 D7): a phone turned to
    // landscape, where the whole width shows, and back opens centred instead of at the left edge.
    const centreVirtualX = this.#scale > 0 ? (this.#canvasWidth / 2 - this.#offsetX) / this.#scale : 0;
    this.#canvasWidth = canvasWidth;
    this.#canvasHeight = canvasHeight;

    const safeZoneHeight = safeZoneBottom - safeZoneTop;
    const scaleForWidth = this.#canvasWidth / this.#virtualWidth;
    const scaleForSafeHeight = this.#canvasHeight / safeZoneHeight;

    this.#scale = Math.max(scaleForWidth, scaleForSafeHeight);

    const scaledWidth = this.#virtualWidth * this.#scale;
    const scaledHeight = this.#virtualHeight * this.#scale;

    this.#maxScrollX = Math.max(0, scaledWidth - this.#canvasWidth);
    this.#maxScrollY = Math.max(0, scaledHeight - this.#canvasHeight);

    if (this.#isFirstUpdate) {
      if (this.#maxScrollX > 0) {
        if (alignment.x === "center") this.#cameraX = this.#maxScrollX / 2;
        else if (alignment.x === "right") this.#cameraX = this.#maxScrollX;
        else this.#cameraX = 0;
      } else {
        this.#cameraX = -(this.#canvasWidth - scaledWidth) / 2;
      }

      if (this.#maxScrollY > 0) {
        if (alignment.y === "top") this.#cameraY = 0;
        else if (alignment.y === "bottom") this.#cameraY = this.#maxScrollY;
        else if (alignment.y === "center") this.#cameraY = this.#maxScrollY / 2;
        else {
          const scaledSafeZoneTop = safeZoneTop * this.#scale;
          const scaledSafeZoneHeight = safeZoneHeight * this.#scale;
          this.#cameraY =
            scaledSafeZoneTop - (this.#canvasHeight - scaledSafeZoneHeight) / 2;
        }
      } else {
        this.#cameraY = -(this.#canvasHeight - scaledHeight) / 2;
      }

      this.#isFirstUpdate = false;
      this.#snapNextFocus = true;
    } else if (resized) {
      this.#cameraX = centreVirtualX * this.#scale - this.#canvasWidth / 2;
      this.#snapNextFocus = true;
    }

    if (this.#maxScrollX > 0) {
      this.#cameraX = Math.max(0, Math.min(this.#cameraX, this.#maxScrollX));
      this.#offsetX = -this.#cameraX;
    } else {
      this.#cameraX = 0;
      this.#offsetX = (this.#canvasWidth - scaledWidth) / 2;
    }

    if (this.#maxScrollY > 0) {
      this.#cameraY = Math.max(0, Math.min(this.#cameraY, this.#maxScrollY));
      this.#offsetY = -this.#cameraY;
    } else {
      this.#cameraY = 0;
      this.#offsetY = (this.#canvasHeight - scaledHeight) / 2;
    }

    return true;
  }

  pan(deltaX, deltaY = 0) {
    if (this.#maxScrollX > 0) {
      this.#cameraX = Math.max(
        0,
        Math.min(this.#cameraX + deltaX, this.#maxScrollX),
      );
      this.#offsetX = -this.#cameraX;
    }
    if (this.#maxScrollY > 0) {
      this.#cameraY = Math.max(
        0,
        Math.min(this.#cameraY + deltaY, this.#maxScrollY),
      );
      this.#offsetY = -this.#cameraY;
    }
  }


  // Follow the object smoothly along the Y axis only. The first focus after the camera is placed, and after the canvas
  // changes size (a phone turned, the browser bar shown), snaps to its target, so a new layout opens on the framing it
  // would otherwise ease into over the next seconds (spec 105 D7).
  focusOnVirtualPos(vY, dt, lerpSpeed = 0.05) {
    const snap = this.#snapNextFocus;
    this.#snapNextFocus = false;
    if (this.#maxScrollY <= 0) return;

    const targetPixelY = vY * this.#scale;


    const focusRatio = this.#locationsConfig.cameraFocusY ?? 0.7;

    let desiredCameraY = targetPixelY - this.#canvasHeight * focusRatio;

    desiredCameraY = Math.max(0, Math.min(desiredCameraY, this.#maxScrollY));

    const timeScale = dt / 16.66;
    const currentLerp = snap ? 1 : 1 - Math.pow(1 - lerpSpeed, timeScale);

    this.#cameraY += (desiredCameraY - this.#cameraY) * currentLerp;
    this.#offsetY = -this.#cameraY;
  }

  // Spec 153 (D1): along X the camera follows the tackle (targetX: the float, the fish in a fight) only when it enters
  // the edge band (marginShare of the canvas width on each side). priority (CONFIG.locations.cameraFollowPriority,
  // TK-260): "rod" never moves so far that keepX (the rod) leaves the band, so the tackle may go past the edge;
  // "tackle" keeps the tackle in view and lets the rod leave the screen. Eases like focusOnVirtualPos.
  followVirtualX(targetX, keepX, dt, marginShare = 0.15, priority = "rod", lerpSpeed = 0.08) {
    if (this.#maxScrollX <= 0 || !Number.isFinite(targetX)) return;
    const width = this.#canvasWidth;
    const margin = width * Math.min(0.45, Math.max(0, Number(marginShare) || 0));
    const targetPx = targetX * this.#scale;
    let desired = this.#cameraX;
    if (targetPx - desired < margin) desired = targetPx - margin;
    else if (targetPx - desired > width - margin) desired = targetPx - (width - margin);
    if (priority !== "tackle" && Number.isFinite(keepX)) {
      const keepPx = keepX * this.#scale;
      desired = Math.min(Math.max(desired, keepPx - (width - margin)), keepPx - margin);
    }
    desired = Math.max(0, Math.min(desired, this.#maxScrollX));
    if (desired === this.#cameraX) return;
    const timeScale = dt / 16.66;
    const lerp = 1 - Math.pow(1 - lerpSpeed, timeScale);
    this.#cameraX += (desired - this.#cameraX) * lerp;
    this.#offsetX = -this.#cameraX;
  }

  screenToVirtual(screenX, screenY, out = null) {
    const x = (screenX - this.#offsetX) / this.#scale;
    const y = (screenY - this.#offsetY) / this.#scale;
    return out ? out.set(x, y) : new Vector2(x, y);
  }

  virtualToScreen(vX, vY, out = null) {
    const x = vX * this.#scale + this.#offsetX;
    const y = vY * this.#scale + this.#offsetY;
    return out ? out.set(x, y) : new Vector2(x, y);
  }

  getScale() {
    return this.#scale;
  }
  getCanvasWidth() {
    return this.#canvasWidth;
  }
}
