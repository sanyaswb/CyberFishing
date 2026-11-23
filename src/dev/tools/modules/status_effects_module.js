// Spec 181 D5 (TK-344): DevTools «СТАТУСИ» on the page «Гра» — the player's active buffs and debuffs (time left and
// modifiers), «Видати» for every timed description, «Зняти» for each active one and «Зняти всі»; the descriptions
// (CONFIG.statusEffects) as a tree with live edits (the same values as in «Конфіг»). A status held by its source (the gas
// mask in its slot) is shown but not given or taken here: its source decides.
// statuses: the DEV port { list(), definition(id), remainingSec(id), apply(id, { source }), remove(id), clear() }.
import { STATUS_LABELS } from "../../../game/presentation/status/status_labels.js";
import { statusModifierShare } from "../../../game/domain/status/status_effect_rules.js";

const KIND_LABELS = Object.freeze({ buff: "баф", debuff: "дебаф" });

export class StatusEffectsModule {
  #config;
  #statuses;
  #ui = null;
  #active = null;

  constructor({ config, statuses }) {
    this.#config = config;
    this.#statuses = statuses;
  }

  mount(host, { ui, createSection, tree }) {
    this.#ui = ui;
    const content = createSection("СТАТУСИ", host, ["STATUSES"], { icon: "stack" });
    ui.createInfoRow("що це", "Бафи й дебафи гравця (spec 181): горілка, протигаз у слоті, далі — радіація.", content);
    this.#active = createSection("Активні", content, ["STATUSES", "active"]);
    this.#renderActive();
    const definitions = this.#config.statusEffects;
    if (definitions) {
      const path = ["CONFIG", "statusEffects"];
      tree.render(definitions, createSection("Описи (CONFIG.statusEffects)", content, path), path);
    }
  }

  // The active statuses with their time left and modifiers, the give / take buttons; redrawn after each button.
  #renderActive() {
    const ui = this.#ui;
    const section = this.#active;
    if (!ui || !section) return;
    // TK-387: the one redraw path (bindings, an open drill-in).
    ui.redraw(section, () => this.#drawActive(ui, section));
  }

  #drawActive(ui, section) {
    const active = this.#statuses.list();
    if (active.length === 0) ui.createTextRow("активні", "немає", section);
    for (const entry of active) {
      ui.createTextRow(entry.id, this.#describe(entry), section);
      if (!entry.held) ui.createButtonRow(`Зняти: ${entry.id}`, section, () => this.#act(() => this.#statuses.remove(entry.id)));
    }
    for (const [id, definition] of Object.entries(this.#config.statusEffects || {})) {
      if (Number(definition?.durationSec) > 0) {
        ui.createButtonRow(`Видати: ${id}`, section, () => this.#act(() => this.#statuses.apply(id, { source: "devtools" })));
      }
    }
    ui.createButtonRow("Зняти всі", section, () => this.#act(() => this.#statuses.clear()));
    ui.createButtonRow("↻ Оновити", section, () => this.#renderActive());
  }

  #act(command) {
    command();
    this.#renderActive();
  }

  #describe(entry) {
    const definition = this.#statuses.definition(entry.id);
    const time = entry.held ? `без таймера (${entry.source || "джерело"})` : `ще ${STATUS_LABELS.countdown(this.#statuses.remainingSec(entry.id))}`;
    // TK-378: the level in effect now (the stacks worn off by the time left).
    const level = this.#statuses.stacks(entry.id);
    const stacks = level > 1 ? ` · ×${level}` : "";
    const modifiers = [];
    // Spec 185 D11: a status held with its source's own modifiers (the gas mask's filter) shows those.
    const source = entry.sourceModifiers ?? definition;
    for (const [system, keys] of Object.entries(source?.modifiers || {})) {
      // TK-374: the share in effect now (by the stacks: a list of shares, or a share per stack), rounded for reading.
      for (const key of Object.keys(keys || {})) {
        const share = statusModifierShare(source, system, key, level);
        modifiers.push(`${system}.${key} ${Math.round(share * 1000) / 1000}`);
      }
    }
    return `${KIND_LABELS[entry.kind] ?? entry.kind} · ${time}${stacks}${modifiers.length ? ` · ${modifiers.join(", ")}` : ""}`;
  }
}
