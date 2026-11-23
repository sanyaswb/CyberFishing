// DevTools «РАНДОМАЙЗЕР» (TK-321.1, owner 2026-11-14): runs the game's real random code many times in a row and shows a
// short report, so the balance can be tried with the parameters edited in DevTools. Each test is a probe
// ({ id, label, run({ count, seed }) → { rows: [[label, text]], histogram: [[label, share]] } }); the emission's start,
// rain, storm, fog and gusts (spec 180 stage F); the bite and others join later as probes.
const COUNTS = Object.freeze(["100", "1000", "5000"]);
const BAR_WIDTH = 20;

export class RandomizerModule {
  #probes;
  #randomSeed;
  #probeId;
  #count = "1000";
  #seedText = "";
  #report = null;
  #content = null;
  #context = null;

  // probes: the tests; randomSeed(): a fresh seed when the seed field is empty.
  constructor({ probes, randomSeed = () => Math.floor(Math.random() * 4294967296) }) {
    this.#probes = (Array.isArray(probes) ? probes : []).filter(Boolean);
    this.#randomSeed = randomSeed;
    this.#probeId = this.#probes[0]?.id ?? null;
  }

  mount(host, context) {
    if (!this.#probes.length) return;
    this.#context = context;
    this.#content = context.createSection("РАНДОМАЙЗЕР", host, ["RANDOMIZER"], { icon: "chart" });
    this.#fill();
  }

  dispose() {
    this.#content = null;
    this.#context = null;
  }

  #probe() {
    return this.#probes.find((probe) => probe.id === this.#probeId) ?? this.#probes[0];
  }

  // TK-387: redrawn through DevToolsUI.redraw (bindings, an open drill-in).
  #fill() {
    if (this.#content) this.#context.ui.redraw(this.#content, () => this.#draw(this.#content));
  }

  #draw(content) {
    const { ui, createSection } = this.#context;
    const labels = this.#probes.map((probe) => probe.label);
    ui.createSelectRow("тест", labels, this.#probe().label, content, (label) => {
      this.#probeId = this.#probes.find((probe) => probe.label === label)?.id ?? this.#probeId;
      this.#report = null;
      this.#fill();
    }, ["RANDOMIZER", "probe"]);
    ui.createSelectRow("кількість", COUNTS, this.#count, content, (value) => {
      this.#count = COUNTS.includes(value) ? value : this.#count;
    }, ["RANDOMIZER", "count"]);
    ui.createInputRow("сід (порожньо — випадковий)", this.#seedText, content, "text", (value) => {
      this.#seedText = String(value ?? "").trim();
    }, ["RANDOMIZER", "seed"]);
    ui.createButtonRow("Запустити", content, () => this.#run(), false, "", ["RANDOMIZER", "run"]);
    if (!this.#report) return;
    // TK-335 (agent, browser): the report shows right under «Запустити». It was a collapsed «Результат» whose rows were
    // info rows — those go to the section's hidden description («i»), so the numbers took three presses to see.
    for (const [label, text] of this.#report.rows) ui.createTextRow(label, text, content);
    if (this.#report.histogram.length) {
      const chart = createSection("Розподіл", content, ["RANDOMIZER", "histogram"], { inline: true });
      const peak = Math.max(...this.#report.histogram.map(([, share]) => share), 1e-9);
      for (const [label, share] of this.#report.histogram) {
        const bar = "█".repeat(Math.round((share / peak) * BAR_WIDTH));
        ui.createTextRow(label, `${bar} ${(share * 100).toFixed(1)}%`, chart);
      }
    }
  }

  #run() {
    const parsed = Number(this.#seedText);
    const seed = this.#seedText !== "" && Number.isFinite(parsed) ? parsed >>> 0 : this.#randomSeed();
    this.#report = this.#probe().run({ count: Number(this.#count), seed });
    this.#fill();
  }
}
