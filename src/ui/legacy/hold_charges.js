class HoldChargesUI {
  constructor() {
    this.container = document.createElement("div");
    this.container.style.cssText = `
      position: fixed;
      bottom: 25vh; /* Можеш змінити висоту, щоб не перекривало інші кнопки */
      left: 50%;
      transform: translateX(-50%);
      display: none; /* За замовчуванням приховано */
      gap: 12px;
      z-index: 9998;
      pointer-events: none;
      align-items: center;
      flex-direction: row;
    `;

    // Текст "УТРИМАННЯ", який з'являється при активації
    this.textLabel = document.createElement("div");
    this.textLabel.style.cssText = `
      position: absolute;
      top: -25px;
      left: 50%;
      transform: translateX(-50%);
      color: #00ff80;
      font-family: monospace;
      font-size: 14px;
      font-weight: bold;
      text-shadow: 0 0 5px #00ff80;
      display: none;
    `;

    this.container.appendChild(this.textLabel);
    document.body.appendChild(this.container);

    this.circles = [];
    this.maxCharges = 0;
  }

  update(holdState) {
    // Якщо стану немає, утримання немає або заряди = 0 -> ховаємо весь UI
    if (!holdState || !holdState.hasHold || holdState.max <= 0) {
      this.container.style.display = "none";
      return;
    }

    this.container.style.display = "flex";

    // Якщо змінилася максимальна кількість зарядів (наприклад, гравець змінив котушку)
    if (this.maxCharges !== holdState.max) {
      this.circles.forEach((c) => c.remove());
      this.circles = [];
      for (let i = 0; i < holdState.max; i++) {
        const circle = document.createElement("div");
        circle.style.cssText = `
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid #00ff80;
          transition: box-shadow 0.2s ease, border-color 0.2s ease;
          box-sizing: border-box;
          background: transparent;
        `;
        this.container.appendChild(circle);
        this.circles.push(circle);
      }
      this.maxCharges = holdState.max;
    }

    let available = holdState.current;
    let active = holdState.isActive ? 1 : 0;
    let restoringCount = holdState.restoring.length;

    // Показуємо або ховаємо текст
    if (holdState.isActive) {
      this.textLabel.innerText = "УТРИМАННЯ";
      this.textLabel.style.display = "block";
    } else {
      this.textLabel.style.display = "none";
    }

    // Оновлюємо стан кожного кружечка
    for (let i = 0; i < this.maxCharges; i++) {
      const circle = this.circles[i];

      if (active > 0) {
        // АКТИВНИЙ БЛОК: пустий всередині, світиться неоном
        circle.style.background = "transparent";
        circle.style.borderColor = "#00ff80";
        circle.style.boxShadow = "0 0 12px #00ff80, inset 0 0 8px #00ff80";
        active--;
      } else if (available > 0) {
        // ДОСТУПНИЙ БЛОК: повністю зафарбований зеленим
        circle.style.background = "#00ff80";
        circle.style.borderColor = "#00cc66";
        circle.style.boxShadow = "none";
        available--;
      } else if (restoringCount > 0) {
        // ВІДНОВЛЮЄТЬСЯ: червоний, заповнюється знизу
        const timer = holdState.restoring[restoringCount - 1];
        let progress = 1.0 - timer / holdState.restoreMaxTime;
        progress = Math.max(0, Math.min(1, progress));
        const percent = (progress * 100).toFixed(1); // До 1 знака після коми для плавності

        // Магія CSS: градієнт, який робить чітку межу заповнення
        circle.style.background = `linear-gradient(to top, rgba(255, 0, 85, 0.8) ${percent}%, transparent ${percent}%)`;
        circle.style.borderColor = "#ff0055";
        circle.style.boxShadow = "none";
        restoringCount--;
      }
    }
  }

  dispose() {
    this.circles.length = 0;
    this.container?.remove();
    this.container = null;
    this.textLabel = null;
  }
}
