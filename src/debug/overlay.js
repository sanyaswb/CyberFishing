/**
 * Глобальні налаштування відображення блоків
 */
const OVERLAY_MODULES = {
  echo: true,
  chancesDetail: false,
  state: true,
  chum: true,
  fishBase: true,
  fishStates: true,
  worstCase: false,
  playerMax: true,
  liveY: true,
  liveX: true,
  debuffsLive: true,
};

/**
 * Базовий клас модуля
 */
class OverlayModule {
  constructor(configKey) {
    this.configKey = configKey;
  }
  isActive(data) {
    return OVERLAY_MODULES[this.configKey] && this.shouldRender(data);
  }
  shouldRender(data) {
    return true;
  }
  render(data) {
    return "";
  }

  formatHeader(title, color = "#00ccff") {
    return `<div style="color: ${color}; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">${title}</div>`;
  }

  getStateColor(state) {
    const colors = {
      dash: "#ff4444",
      lastdash: "#ff00ff",
      panic: "#ff0055",
      megadash: "#ff2222",
      surrender: "#888888",
      swim: "#ffaa00",
      rest: "#00ff80",
      idle: "#00ccff",
    };
    return colors[state?.toLowerCase()] || "#8a9bac";
  }
}

/**
 * 🧠 МОДУЛЬ ПОВЕДІНКИ РИБИ
 */
class FishBehaviorModule extends OverlayModule {
  constructor() {
    super("state");
  }
  shouldRender(d) {
    return d.gameState === "playing" && d.hookedFish;
  }

  render(d) {
    const stateColor = this.getStateColor(d.fishState);
    let html = this.formatHeader(
      `🧠 ПОВЕДІНКА (${d.hookedFish.name || "Риба"})`,
    );
    html += `<div style="margin-bottom: 4px;">Стан: <span style="color: ${stateColor}; text-transform: uppercase; font-weight: bold;">${d.fishState || "---"}</span></div>`;
    html += `<div style="margin-bottom: 4px;">Множник Тяги (Y): <span style="color: ${stateColor};">x${(d.pullMult || 0).toFixed(2)}</span></div>`;
    html += `<div style="margin-bottom: 12px;">Множник Втечі (X): <span style="color: ${stateColor};">x${(d.moveMult || 0).toFixed(2)}</span></div>`;
    return html;
  }
}

/**
 * 📡 МОДУЛЬ ЕХОЛОТА
 */
class EchoModule extends OverlayModule {
  constructor() {
    super("echo");
  }
  shouldRender(d) {
    return ["scouting", "waiting", "biting"].includes(d.gameState);
  }

  render(d) {
    let html = this.formatHeader("📡 ЕХОЛОТ", "#00ff80");
    html += `<div style="margin-bottom: 4px;">Стан: <span style="color: #00ccff; text-transform: uppercase;">${d.gameState}</span></div>`;

    if (d.gameState !== "scouting") {
      html += `<div style="margin-bottom: 4px;">
        Гачок: <span style="color: #ffaa00;">${(d.hookDepth || 0).toFixed(2)} м</span> / 
        Дно: <span style="color: #ffaa00;">${(d.bottomDepth || 0).toFixed(2)} м</span> / 
        Ліска: <span style="color: #00ccff;">${(d.lineLength || 0).toFixed(2)} м</span>
      </div>`;
      const weather = d.isRaining
        ? "🌧️ Дощ"
        : d.isFoggy
          ? "🌫️ Туман"
          : "☀️ Ясно";
      html += `<div style="margin-bottom: 4px;">Погода: <span style="color: #00ccff;">${weather}</span> | Фаза: <span style="color: #ffff00;">${d.phase}</span></div>`;

      if (d.liveChances?.length > 0) {
        html += `<div style="color: #8a9bac; font-size: 11px; margin-top: 5px;">Шанси:</div>`;
        d.liveChances.forEach((f) => {
          html += `<div style="display: flex; justify-content: space-between; font-size: 12px;">
            <span>${f.name}</span><span style="color: #00ff80;">${f.chance}</span>
          </div>`;
        });
      }
    }
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }
}

/**
 * 📊 МОДУЛЬ СИЛИ (Y та X)
 */
class LiveForcesModule extends OverlayModule {
  constructor() {
    super("liveY");
  }
  shouldRender(d) {
    return d.gameState === "playing";
  }
  render(d) {
    const pY = d.playerForceY || 0,
      fY = d.fishForceY || 0;
    const pX = d.playerForceX || 0,
      fX = d.fishForceX || 0;

    let html = this.formatHeader("⚖️ LIVE FORCES");
    html += `<div style="font-size: 12px;">Y: <span style="color:#00ff80">P:${pY.toFixed(2)}</span> vs <span style="color:#ff4444">F:${fY.toFixed(2)}</span></div>`;
    html += `<div style="font-size: 12px; margin-bottom: 10px;">X: <span style="color:#00ff80">P:${pX.toFixed(2)}</span> vs <span style="color:#ff4444">F:${fX.toFixed(2)}</span></div>`;
    return html;
  }
}

class DebugOverlay {
  #container;
  #content;
  #data = {};
  #userScale = 1.0;
  #modules = [];

  constructor() {
    this.#initModules();
    this.#initDOM();
    this.#initListener();
    this.#startTick();
  }

  #initModules() {
    this.#modules = [
      new EchoModule(),
      new FishBehaviorModule(),
      new LiveForcesModule(),
    ];
  }

  #initDOM() {
    this.#container = document.createElement("div");
    Object.assign(this.#container.style, {
      position: "absolute",
      bottom: "10px",
      left: "10px",
      background: "rgba(11, 21, 32, 0.95)",
      color: "#ffffff",
      padding: "15px 15px 50px 15px",
      fontFamily: "monospace",
      fontSize: "14px",
      border: "1px solid #4a5b6c",
      borderRadius: "8px",
      zIndex: "10000",
      display: "none",
      minWidth: "280px",
      transformOrigin: "bottom left",
    });

    this.#content = document.createElement("div");
    this.#container.appendChild(this.#content);

    const controls = document.createElement("div");
    controls.style.cssText =
      "position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px;";

    const bMin = this.#createBtn("-", () => this.#changeScale(-0.1));
    const bPlus = this.#createBtn("+", () => this.#changeScale(0.1));

    controls.append(bMin, bPlus);
    this.#container.appendChild(controls);
    document.body.appendChild(this.#container);
  }

  #createBtn(t, act) {
    const b = document.createElement("button");
    b.innerHTML = t;
    Object.assign(b.style, {
      width: "30px",
      height: "30px",
      cursor: "pointer",
      background: "#1a2a3a",
      color: "#00ccff",
      border: "1px solid #00ccff",
    });
    b.onclick = (e) => {
      e.stopPropagation();
      act();
    };
    return b;
  }

  #changeScale(s) {
    this.#userScale = Math.max(0.3, Math.min(3, this.#userScale + s));
    this.#applyScale();
  }

  #applyScale() {
    this.#container.style.transform = `scale(${this.#userScale})`;
  }

  #initListener() {
    document.addEventListener("debug-live-update", (e) => {
      this.#data = e.detail;
      if (this.#container.style.display === "none")
        this.#container.style.display = "block";
    });
  }

  #update() {
    if (!CONFIG?.debug?.overlay) {
      this.#container.style.display = "none";
      return;
    }

    const html = this.#modules
      .filter((m) => m.isActive(this.#data))
      .map((m) => m.render(this.#data))
      .join("");

    if (html) {
      this.#content.innerHTML = html;
      this.#applyScale();
    }
  }

  #startTick() {
    setInterval(() => this.#update(), 100);
  }
}

new DebugOverlay();
