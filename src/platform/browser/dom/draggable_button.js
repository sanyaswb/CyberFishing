import { UiEventShield } from "./ui_event_shield.js";

export class DraggableButton {
  #element;
  #onClickCallback;
  #config;
  #options;
  #holdTimer;
  #isDragging;
  #startX;
  #startY;
  #offsetX;
  #offsetY;
  #id; // Unique key for the cached position.
  #onClickShield = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  #pointerId = null;

  constructor(element, onClickCallback, config, options = {}) {
    this.#element = element;
    this.#onClickCallback = onClickCallback;
    this.#config = config;
    this.#options = options;

    // Prefer the explicit ID, then the element ID, then the default name.
    this.#id = options.id || element.id || "default_draggable";

    this.#holdTimer = null;
    this.#isDragging = false;

    UiEventShield.makeSolid(this.#element);

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    this.#initEvents();
    this.#restorePosition();
  }


  #restorePosition() {
    if (!this.#options.cache) return;

    const savedPos = this.#options.cache.get(`drag_pos_${this.#id}`);
    if (savedPos) {
      this.#element.style.position = "absolute";
      this.#element.style.margin = "0";
      this.#element.style.transition = "none";

      // Support the previous cache format with absolute x/y coordinates.
      if (savedPos.x !== undefined) {
        this.#element.style.left = savedPos.x;
        this.#element.style.top = savedPos.y;
        this.#element.style.right = "auto";
        this.#element.style.bottom = "auto";
      } else {
        // Restore the position relative to its nearest viewport edges.
        this.#element.style.left = savedPos.left || "auto";
        this.#element.style.right = savedPos.right || "auto";
        this.#element.style.top = savedPos.top || "auto";
        this.#element.style.bottom = savedPos.bottom || "auto";
      }
    }
  }

  #savePosition() {
    if (!this.#options.cache) return;

    const rect = this.#element.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;


    const distLeft = rect.left;
    const distRight = winWidth - rect.right;
    const distTop = rect.top;
    const distBottom = winHeight - rect.bottom;

    const pos = {};

    // Anchor horizontally to the nearer edge.
    if (distLeft <= distRight) {
      pos.left = `${Math.max(0, distLeft)}px`;
      pos.right = "auto";
    } else {
      pos.right = `${Math.max(0, distRight)}px`;
      pos.left = "auto";
    }

    // Anchor vertically to the nearer edge.
    if (distTop <= distBottom) {
      pos.top = `${Math.max(0, distTop)}px`;
      pos.bottom = "auto";
    } else {
      pos.bottom = `${Math.max(0, distBottom)}px`;
      pos.top = "auto";
    }


    this.#element.style.left = pos.left;
    this.#element.style.right = pos.right;
    this.#element.style.top = pos.top;
    this.#element.style.bottom = pos.bottom;


    this.#options.cache.set(`drag_pos_${this.#id}`, pos);
  }
  // -------------------

  #initEvents() {
    this.#element.addEventListener("pointerdown", this.onPointerDown);

    this.#element.addEventListener("click", this.#onClickShield);
  }

  dispose() {
    if (this.#holdTimer !== null) clearTimeout(this.#holdTimer);
    this.#holdTimer = null;
    this.#element.removeEventListener("pointerdown", this.onPointerDown);
    this.#element.removeEventListener("click", this.#onClickShield);
    this.#element.removeEventListener("pointermove", this.onPointerMove);
    this.#element.removeEventListener("pointerup", this.onPointerUp);
    this.#element.removeEventListener("pointercancel", this.onPointerUp);
    if (this.#pointerId !== null && this.#element.hasPointerCapture?.(this.#pointerId))
      this.#element.releasePointerCapture(this.#pointerId);
    this.#pointerId = null;
    this.#isDragging = false;
    this.#onClickCallback = null;
  }

  onPointerDown(e) {
    e.stopPropagation();

    if (e.button !== 0 && e.pointerType === "mouse") return;

    this.#element.setPointerCapture(e.pointerId);
    this.#pointerId = e.pointerId;

    this.#isDragging = false;
    this.#startX = e.clientX;
    this.#startY = e.clientY;

    const rect = this.#element.getBoundingClientRect();
    this.#offsetX = e.clientX - rect.left;
    this.#offsetY = e.clientY - rect.top;

    if (this.#config.ui?.draggableButtons) {
      this.#holdTimer = setTimeout(() => {
        this.#startDrag();
      }, this.#config.ui?.dragHoldTimeMs || 1500);
    }

    this.#element.addEventListener("pointermove", this.onPointerMove);
    this.#element.addEventListener("pointerup", this.onPointerUp);
    this.#element.addEventListener("pointercancel", this.onPointerUp);
  }

  #startDrag() {
    this.#isDragging = true;
    if (!this.#options.noTransform) {
      this.#element.style.transform = "scale(1.1)";
      this.#element.style.boxShadow = "0 10px 25px rgba(0,0,0,0.5)";
      this.#element.style.transition = "none";
    }
    this.#element.style.position = "absolute";
    this.#element.style.margin = "0";
    this.#element.style.right = "auto";
    this.#element.style.bottom = "auto";
    this.#updatePosition(this.#startX, this.#startY);
  }

  onPointerMove(e) {
    if (!this.#isDragging) {
      const dist = Math.hypot(
        e.clientX - this.#startX,
        e.clientY - this.#startY,
      );
      if (dist > 10 && this.#holdTimer) {
        clearTimeout(this.#holdTimer);
        this.#holdTimer = null;
      }
      return;
    }
    this.#updatePosition(e.clientX, e.clientY);
  }

  #updatePosition(clientX, clientY) {
    let x = clientX - this.#offsetX;
    let y = clientY - this.#offsetY;
    const rect = this.#element.getBoundingClientRect();
    x = Math.max(0, Math.min(x, window.innerWidth - rect.width));
    y = Math.max(0, Math.min(y, window.innerHeight - rect.height));
    this.#element.style.left = `${x}px`;
    this.#element.style.top = `${y}px`;
  }

  onPointerUp(e) {
    this.#element.releasePointerCapture(e.pointerId);
    this.#pointerId = null;
    this.#element.removeEventListener("pointermove", this.onPointerMove, {
      capture: true,
    });
    this.#element.removeEventListener("pointerup", this.onPointerUp, {
      capture: true,
    });
    this.#element.removeEventListener("pointercancel", this.onPointerUp, {
      capture: true,
    });

    if (this.#holdTimer) {
      clearTimeout(this.#holdTimer);
      this.#holdTimer = null;
    }

    if (this.#isDragging) {
      this.#isDragging = false;
      if (!this.#options.noTransform) {
        this.#element.style.transform = "";
        this.#element.style.boxShadow = "";
        this.#element.style.transition = "";
      }
      // Save the position when the drag ends.
      this.#savePosition();
    } else {
      const dist = Math.hypot(
        e.clientX - this.#startX,
        e.clientY - this.#startY,
      );
      if (dist < 10 && this.#onClickCallback) this.#onClickCallback(e);
    }
  }
}

