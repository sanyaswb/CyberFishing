import { UiEventShield } from "../dom/ui_event_shield.js";

// Spec 181 D3 (stage C): the player's statuses as round badges in the HUD indicator column (the shared hud-indicator
// component). A timed status shows a fill that drains from the top down and turns from the full colour through the half
// to the low one (the degradation palette, resolved once per badge); a held status (no timer) has no fill. Debuffs get
// the danger outline (Q4). When a status ends the badge fades (~300 ms) and is removed. A tap shows the time left (Q6)
// in the counter; while a counter is open it is rewritten once a second.
// No work per frame: the fill and its colours are CSS animations (transform and opacity, on the compositor) started with
// the status's duration and a negative delay for the time already gone; the DOM is touched only on a status's start,
// update and end, on a tap and by the open counter's one-second timer. Only statuses whose description has badge: true.
const FADE_MS = 300;
const COUNTER_MS = 1000;

export class StatusHudBadges {
  #document;
  #mount;
  #statuses;
  #icons;
  #labels;
  #colors;
  #scheduler;
  #now;
  #badges = new Map();
  #unsubscribe;
  #counterTimer = null;

  // statuses: PlayerStatusEffects; icons: the HUD icon port ({ create(symbol, className) }); labels: STATUS_LABELS;
  // colors: () => ({ full, half, low }) CSS colours; scheduler: { setTimeout, setInterval, clearInterval } (the window);
  // now: () => the statuses' monotonic clock.
  constructor({ documentRef, mountNode, statuses, icons, labels, colors, scheduler, now }) {
    this.#document = documentRef;
    this.#mount = mountNode;
    this.#statuses = statuses;
    this.#icons = icons;
    this.#labels = labels;
    this.#colors = colors;
    this.#scheduler = scheduler;
    this.#now = now;
    this.#unsubscribe = statuses.subscribe((event) => this.#onEvent(event));
    for (const entry of statuses.list()) this.#start(entry);
  }

  dispose() {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#stopCounter();
    for (const badge of this.#badges.values()) badge.button.remove();
    this.#badges.clear();
  }

  #onEvent({ type, entry }) {
    if (type === "start") this.#start(entry);
    else if (type === "update") this.#refresh(entry);
    else if (type === "end") this.#end(entry.id);
  }

  #start(entry) {
    const definition = this.#statuses.definition(entry.id);
    if (definition?.badge !== true || this.#badges.has(entry.id)) return;
    const document = this.#document;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `hud-indicator hud-indicator--status hud-indicator--${entry.kind === "debuff" ? "debuff" : "buff"}`;
    UiEventShield.makeSolid(button);
    const name = this.#labels.names[entry.id] || entry.id;
    const title = this.#labels.badge(name, entry.kind);
    button.title = title;
    button.setAttribute("aria-label", title);
    const icon = this.#icons.create(definition.icon || "item", "hud-indicator__icon");
    const count = document.createElement("span");
    count.className = "hud-indicator__count";
    count.hidden = true;
    const badge = { id: entry.id, button, fill: null, count, icon, counting: false, ending: false };
    if (icon) button.append(icon);
    button.append(count);
    button.addEventListener("click", () => this.#toggleCounter(badge));
    this.#badges.set(entry.id, badge);
    this.#renderFill(badge, entry);
    this.#mount.appendChild(button);
  }

  #refresh(entry) {
    const badge = this.#badges.get(entry.id);
    if (!badge) return this.#start(entry);
    this.#renderFill(badge, entry);
    if (badge.counting) this.#writeCount(badge);
  }

  // A new fill restarts its animations: the whole duration, already gone by the time since the status (re)started.
  #renderFill(badge, entry) {
    badge.fill?.remove();
    badge.fill = null;
    const timed = !entry.held && Number.isFinite(entry.untilMs);
    badge.button.classList.toggle("hud-indicator--timed", timed);
    if (!timed) return;
    const colors = this.#colors();
    const style = badge.button.style;
    style.setProperty("--hud-indicator-duration", `${Math.max(1, Math.round(entry.untilMs - entry.startedAtMs))}ms`);
    style.setProperty("--hud-indicator-delay", `${-Math.max(0, Math.round(this.#now() - entry.startedAtMs))}ms`);
    style.setProperty("--hud-indicator-color-full", colors.full);
    style.setProperty("--hud-indicator-color-half", colors.half);
    style.setProperty("--hud-indicator-color-low", colors.low);
    const fill = this.#document.createElement("span");
    fill.className = "hud-indicator__fill";
    for (const tone of ["half", "low"]) {
      const layer = this.#document.createElement("span");
      layer.className = `hud-indicator__tone hud-indicator__tone--${tone}`;
      fill.append(layer);
    }
    badge.button.prepend(fill);
    badge.fill = fill;
  }

  #end(id) {
    const badge = this.#badges.get(id);
    if (!badge || badge.ending) return;
    badge.ending = true;
    badge.counting = false;
    this.#badges.delete(id);
    badge.button.classList.add("hud-indicator--ending");
    this.#scheduler.setTimeout(() => badge.button.remove(), FADE_MS);
    this.#syncCounter();
  }

  #toggleCounter(badge) {
    if (!badge.button.classList.contains("hud-indicator--timed")) return;
    badge.counting = !badge.counting;
    badge.count.hidden = !badge.counting;
    if (badge.counting) this.#writeCount(badge);
    this.#syncCounter();
  }

  #writeCount(badge) {
    const text = this.#labels.countdown(this.#statuses.remainingSec(badge.id));
    if (badge.count.textContent !== text) badge.count.textContent = text;
  }

  #syncCounter() {
    let any = false;
    for (const badge of this.#badges.values()) if (badge.counting) any = true;
    if (any && this.#counterTimer === null) {
      this.#counterTimer = this.#scheduler.setInterval(() => {
        for (const badge of this.#badges.values()) if (badge.counting) this.#writeCount(badge);
      }, COUNTER_MS);
    } else if (!any) this.#stopCounter();
  }

  #stopCounter() {
    if (this.#counterTimer !== null) this.#scheduler.clearInterval(this.#counterTimer);
    this.#counterTimer = null;
  }
}
