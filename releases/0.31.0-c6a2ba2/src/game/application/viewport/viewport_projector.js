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
  }

  update(canvasWidth, canvasHeight) {
    const mapConfig = this.#locationsConfig.map[this.#locationId];
    const safeZoneTop = mapConfig.safeZone.top;
    const safeZoneBottom = mapConfig.safeZone.bottom;
    const alignment = mapConfig.initialAlignment || {
      x: "center",
      y: "safeZone",
    };

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


  // Follow the object smoothly along the Y axis only.
  focusOnVirtualPos(vY, dt, lerpSpeed = 0.05) {
    if (this.#maxScrollY <= 0) return;

    const targetPixelY = vY * this.#scale;


    const focusRatio = this.#locationsConfig.cameraFocusY ?? 0.7;

    let desiredCameraY = targetPixelY - this.#canvasHeight * focusRatio;

    desiredCameraY = Math.max(0, Math.min(desiredCameraY, this.#maxScrollY));

    const timeScale = dt / 16.66;
    const currentLerp = 1 - Math.pow(1 - lerpSpeed, timeScale);

    this.#cameraY += (desiredCameraY - this.#cameraY) * currentLerp;
    this.#offsetY = -this.#cameraY;
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
