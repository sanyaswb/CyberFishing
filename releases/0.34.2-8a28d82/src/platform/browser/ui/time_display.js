export class TimeDisplay {
  constructor({ documentRef = document, mount = documentRef.body } = {}) {
    this.container = documentRef.createElement("div");
    this.container.className = "time-display";

    this.emojiSpan = documentRef.createElement("span");
    this.timeSpan = documentRef.createElement("span");
    this.timeSpan.className = "time-display__time";

    this.container.appendChild(this.emojiSpan);
    this.container.appendChild(this.timeSpan);
    mount.appendChild(this.container);
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
