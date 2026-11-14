import { clampNumber } from "../../../engine/math/number_normalization.js";

const MIN_SCALE = 0.3;
const MAX_SCALE = 3.0;
const KEY_STEP = 0.05;
const KEY_LARGE_STEP = 0.25;
const DEFAULT_DRAG_SPAN_PX = 180;
const MIN_DRAG_SPAN_PX = 140;
const TAP_JUMP_THRESHOLD_PX = 14;

const normalizeScale = (value) =>
  clampNumber(Math.round(value * 100) / 100, MIN_SCALE, MAX_SCALE);

// Top scale slider of an overlay window: dragging left or right scales smoothly using the pointer delta from
// pointerdown so zooming the container never feeds back into the slider geometry.
export class OverlayScaleControls {
  #documentTarget;
  #onScaleChanged;
  #onScaleCommitted;
  #onClose;
  #scale;
  #slider = null;
  #valueLabel = null;
  #closeButton = null;
  #pointerId = null;
  #startX = 0;
  #startScale = 1;
  #dragSpanPx = DEFAULT_DRAG_SPAN_PX;

  #onPointerDown = (event) => this.#handlePointerDown(event);
  #onPointerMove = (event) => this.#handlePointerMove(event);
  #onPointerUp = (event) => this.#handlePointerUp(event);
  #onKeyDown = (event) => this.#handleKeyDown(event);
  #onClosePointerDown = (event) => event?.stopPropagation?.();
  #onCloseClick = (event) => this.#handleCloseClick(event);

  constructor({
    documentTarget = document,
    scale = 1,
    onScaleChanged = null,
    onScaleCommitted = null,
    onClose = null,
  } = {}) {
    this.#documentTarget = documentTarget;
    this.#scale = normalizeScale(Number.isFinite(Number(scale)) ? Number(scale) : 1);
    this.#onScaleChanged = onScaleChanged;
    this.#onScaleCommitted = onScaleCommitted;
    this.#onClose = typeof onClose === "function" ? onClose : null;
  }

  create() {
    const controls = this.#documentTarget.createElement("div");
    controls.className = "debug-overlay__scale-controls";

    const slider = this.#documentTarget.createElement("div");
    slider.className = "debug-overlay__scale-slider";
    slider.setAttribute("role", "slider");
    slider.setAttribute("tabindex", "0");
    slider.setAttribute("aria-label", "Розмір вікна");
    slider.setAttribute("aria-valuemin", String(MIN_SCALE));
    slider.setAttribute("aria-valuemax", String(MAX_SCALE));

    const track = this.#documentTarget.createElement("div");
    track.className = "debug-overlay__scale-track";

    const fill = this.#documentTarget.createElement("div");
    fill.className = "debug-overlay__scale-fill";

    const thumb = this.#documentTarget.createElement("div");
    thumb.className = "debug-overlay__scale-thumb";

    track.append(fill, thumb);
    slider.appendChild(track);

    const valueLabel = this.#documentTarget.createElement("span");
    valueLabel.className = "debug-overlay__scale-value";

    this.#slider = slider;
    this.#valueLabel = valueLabel;
    this.#syncVisual();

    slider.addEventListener("pointerdown", this.#onPointerDown);
    slider.addEventListener("keydown", this.#onKeyDown);

    controls.append(slider, valueLabel);
    if (this.#onClose) {
      const closeButton = this.#documentTarget.createElement("button");
      closeButton.type = "button";
      closeButton.className = "ui-modal-close debug-overlay__close";
      closeButton.setAttribute("aria-label", "Закрити вікно");
      closeButton.addEventListener("pointerdown", this.#onClosePointerDown);
      closeButton.addEventListener("click", this.#onCloseClick);
      this.#closeButton = closeButton;
      controls.append(closeButton);
    }
    return controls;
  }

  setScale(scale) {
    const next = normalizeScale(Number(scale));
    if (!Number.isFinite(next) || next === this.#scale) return;
    this.#scale = next;
    this.#syncVisual();
  }

  dispose() {
    this.#stopDrag();
    if (this.#slider) {
      this.#slider.removeEventListener("pointerdown", this.#onPointerDown);
      this.#slider.removeEventListener("keydown", this.#onKeyDown);
    }
    if (this.#closeButton) {
      this.#closeButton.removeEventListener("pointerdown", this.#onClosePointerDown);
      this.#closeButton.removeEventListener("click", this.#onCloseClick);
    }
    this.#slider = null;
    this.#valueLabel = null;
    this.#closeButton = null;
  }

  #handleCloseClick(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.#onClose?.();
  }

  #handlePointerDown(event) {
    if (!this.#slider) return;
    if (event.button !== undefined && event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    event.stopPropagation();

    this.#slider.focus?.();
    this.#pointerId = event.pointerId ?? 1;
    this.#slider.setPointerCapture?.(this.#pointerId);

    const rect = this.#slider.getBoundingClientRect?.();
    const width = rect?.width > 0 ? rect.width : DEFAULT_DRAG_SPAN_PX;
    this.#dragSpanPx = Math.max(MIN_DRAG_SPAN_PX, width);

    const clientX = Number(event.clientX) || 0;
    if (rect && rect.width > 0) {
      const currentRatio = (this.#scale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE);
      const thumbX = rect.left + currentRatio * rect.width;
      if (Math.abs(clientX - thumbX) > TAP_JUMP_THRESHOLD_PX) {
        const tapRatio = clampNumber((clientX - rect.left) / rect.width, 0, 1);
        this.#applyScale(MIN_SCALE + tapRatio * (MAX_SCALE - MIN_SCALE));
      }
    }

    this.#startX = clientX;
    this.#startScale = this.#scale;

    this.#slider.addEventListener("pointermove", this.#onPointerMove);
    this.#slider.addEventListener("pointerup", this.#onPointerUp);
    this.#slider.addEventListener("pointercancel", this.#onPointerUp);
  }

  #handlePointerMove(event) {
    if (this.#pointerId === null) return;
    if (event.pointerId !== undefined && event.pointerId !== this.#pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    const deltaX = (Number(event.clientX) || 0) - this.#startX;
    const next = this.#startScale + (deltaX / this.#dragSpanPx) * (MAX_SCALE - MIN_SCALE);
    this.#applyScale(next);
  }

  #handlePointerUp(event) {
    if (this.#pointerId === null) return;
    if (event.pointerId !== undefined && event.pointerId !== this.#pointerId) return;
    event.stopPropagation();
    this.#stopDrag();
    this.#onScaleCommitted?.(this.#scale);
  }

  #stopDrag() {
    if (this.#slider) {
      if (this.#pointerId !== null && this.#slider.hasPointerCapture?.(this.#pointerId)) {
        this.#slider.releasePointerCapture(this.#pointerId);
      }
      this.#slider.removeEventListener("pointermove", this.#onPointerMove);
      this.#slider.removeEventListener("pointerup", this.#onPointerUp);
      this.#slider.removeEventListener("pointercancel", this.#onPointerUp);
    }
    this.#pointerId = null;
  }

  #handleKeyDown(event) {
    const step = event.shiftKey ? KEY_LARGE_STEP : KEY_STEP;
    let next = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = this.#scale - step;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") next = this.#scale + step;
    else if (event.key === "Home") next = MIN_SCALE;
    else if (event.key === "End") next = MAX_SCALE;
    if (next === null) return;

    event.preventDefault();
    event.stopPropagation();
    this.#applyScale(next);
    this.#onScaleCommitted?.(this.#scale);
  }

  #applyScale(rawScale) {
    const next = normalizeScale(rawScale);
    if (next === this.#scale) return;
    this.#scale = next;
    this.#syncVisual();
    this.#onScaleChanged?.(this.#scale);
  }

  #syncVisual() {
    const percent = ((this.#scale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE)) * 100;
    if (this.#slider) {
      this.#slider.setAttribute("aria-valuenow", String(this.#scale));
      this.#slider.style?.setProperty?.("--debug-overlay-scale-percent", `${percent.toFixed(2)}%`);
    }
    if (this.#valueLabel) {
      this.#valueLabel.textContent = `${Math.round(this.#scale * 100)}%`;
    }
  }
}
