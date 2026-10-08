export class TimeDisplay {
  constructor() {
    this.container = document.createElement("div");
    this.container.style.cssText = `
            position: fixed;
            top: 15px;
            left: 15px;
            background: rgba(11, 21, 32, 0.85);
            border: 2px solid #4a5b6c;
            border-radius: 8px;
            padding: 6px 16px;
            color: #fff;
            font-family: monospace;
            font-size: 20px;
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 9998;
            pointer-events: none;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        `;

    this.emojiSpan = document.createElement("span");
    this.timeSpan = document.createElement("span");
    this.timeSpan.style.color = "#00ccff";

    this.container.appendChild(this.emojiSpan);
    this.container.appendChild(this.timeSpan);
    document.body.appendChild(this.container);
  }

  update(gameTimeHours) {
    const h = Math.floor(gameTimeHours);
    const m = Math.floor((gameTimeHours % 1) * 60);
    const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;

    let emoji = "☀️";
    if (gameTimeHours >= 21 || gameTimeHours < 5) {
      emoji = "🌙";
    } else if (gameTimeHours >= 5 && gameTimeHours < 8) {
      emoji = "🌅";
    } else if (gameTimeHours >= 18 && gameTimeHours < 21) {
      emoji = "🌇";
    }

    if (this.timeSpan.innerText !== timeStr) {
      this.timeSpan.innerText = timeStr;
      this.emojiSpan.innerText = emoji;
    }
  }

  dispose() {
    this.container?.remove();
    this.container = null;
    this.emojiSpan = null;
    this.timeSpan = null;
  }
}
