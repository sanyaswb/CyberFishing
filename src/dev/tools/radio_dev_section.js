// DevTools «📻 РАДІО» (spec 142 stage 5): the radio's status (power, station, country, stations, signal, the battery's
// charge), discharging its battery to 20 / 5 / 0 % through the ordinary consumption path (DEV never raises a charge:
// a new battery comes from the free shop), and the live CONFIG.radio values (signal, rack, ducking, mirrors).
export class RadioDevSection {
  #ui;
  #radio;
  #createSection;
  #renderConfigTree;
  #content = null;

  // radio: { getStatus(), batteryPercent(), discharge(percent) }; createSection(label, parent, path) and
  // renderConfigTree(parent) come from DevTools.
  constructor({ ui, radio, createSection, renderConfigTree }) {
    this.#ui = ui;
    this.#radio = radio;
    this.#createSection = createSection;
    this.#renderConfigTree = renderConfigTree;
  }

  render(parent) {
    this.#content = this.#createSection("📻 РАДІО", parent, ["RADIO"]);
    this.#fill();
  }

  #fill() {
    const content = this.#content;
    if (!content) return;
    content.replaceChildren();
    const status = this.#radio.getStatus();
    const charge = this.#radio.batteryPercent();
    this.#ui.createInfoRow("стан", `${status.powered ? "увімкнено" : "вимкнено"} · ${status.status}`, content);
    this.#ui.createInfoRow("станція", status.station?.name || "—", content);
    this.#ui.createInfoRow("країна · станцій", `${status.country} · ${status.stationCount}`, content);
    this.#ui.createInfoRow("сигнал", `${Math.round((status.signal ?? 1) * 100)}%`, content);
    this.#ui.createInfoRow("заряд батарейки", charge === null ? "немає батарейки" : `${charge.toFixed(1)}%`, content);
    this.#ui.createButtonRow("↻ Оновити", content, () => this.#fill());
    for (const target of [20, 5, 0]) {
      this.#ui.createButtonRow(`Розрядити до ${target}%`, content, () => {
        this.#radio.discharge(target);
        this.#fill();
      });
    }
    this.#renderConfigTree(this.#createSection("Параметри (CONFIG.radio)", content, ["RADIO", "config"]));
  }
}
