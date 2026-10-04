class UIDraggableButton {
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
  #id; // Унікальний ідентифікатор для кешу

  constructor(element, onClickCallback, config, options = {}) {
    this.#element = element;
    this.#onClickCallback = onClickCallback;
    this.#config = config;
    this.#options = options;

    // Визначаємо ID (пріоритет: options.id -> element.id -> дефолтна назва)
    this.#id = options.id || element.id || "default_draggable";

    this.#holdTimer = null;
    this.#isDragging = false;

    UIUtils.makeSolid(this.#element);

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    this.#initEvents();
    this.#restorePosition(); // Відновлюємо позицію при створенні
  }

  // --- МАГІЯ КЕШУ ---
  #restorePosition() {
    if (!this.#options.cache) return;

    const savedPos = this.#options.cache.get(`drag_pos_${this.#id}`);
    if (savedPos) {
      this.#element.style.position = "absolute";
      this.#element.style.margin = "0";
      this.#element.style.transition = "none";

      // Якщо це старий кеш (де ми зберігали x та y), для сумісності
      if (savedPos.x !== undefined) {
        this.#element.style.left = savedPos.x;
        this.#element.style.top = savedPos.y;
        this.#element.style.right = "auto";
        this.#element.style.bottom = "auto";
      } else {
        // Новий розумний кеш з прив'язкою до країв
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

    // Рахуємо відстань до всіх чотирьох країв екрана
    const distLeft = rect.left;
    const distRight = winWidth - rect.right;
    const distTop = rect.top;
    const distBottom = winHeight - rect.bottom;

    const pos = {};

    // По горизонталі: прив'язуємо до того краю, який ближче
    if (distLeft <= distRight) {
      pos.left = `${Math.max(0, distLeft)}px`;
      pos.right = "auto";
    } else {
      pos.right = `${Math.max(0, distRight)}px`;
      pos.left = "auto";
    }

    // По вертикалі: прив'язуємо до верху або до низу
    if (distTop <= distBottom) {
      pos.top = `${Math.max(0, distTop)}px`;
      pos.bottom = "auto";
    } else {
      pos.bottom = `${Math.max(0, distBottom)}px`;
      pos.top = "auto";
    }

    // Застосовуємо ці "розумні" координати одразу до елемента
    this.#element.style.left = pos.left;
    this.#element.style.right = pos.right;
    this.#element.style.top = pos.top;
    this.#element.style.bottom = pos.bottom;

    // Зберігаємо в кеш
    this.#options.cache.set(`drag_pos_${this.#id}`, pos);
  }
  // -------------------

  #initEvents() {
    this.#element.addEventListener("pointerdown", this.onPointerDown);

    this.#element.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  onPointerDown(e) {
    e.stopPropagation();

    if (e.button !== 0 && e.pointerType === "mouse") return;

    this.#element.setPointerCapture(e.pointerId);

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
      // Зберігаємо позицію після того, як кинули кнопку
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

