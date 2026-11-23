// DevTools «SPINE» → the rod (spec 099 Phase 4, owner 2026-10-17) or the bait boat (spec 150 TK-145): Spine on/off (to
// see the static picture), every clip with an on/off switch, the live CONFIG values (kept by the override store), a bone
// editor and the export of the edited skeleton JSON for Import Data in the Spine editor.
// TK-389: one class for both; what differs is the subject (SpineDevSection.ROD / .BOAT). The file goes through the DEV
// file port (files.download), the same one radio, weather and the zone editor use.
const BONE_KEYS = Object.freeze(["x", "y", "rotation", "scaleX", "scaleY"]);

export class SpineDevSection {
  static ROD = Object.freeze({
    id: "SPINE_ROD",
    title: (skeletonName) => skeletonName,
    fallbackName: "rod",
    defaultBone: "rod",
    configLabel: "Масштаб і параметри (CONFIG.ui.rod.spine)",
    notLoaded: "сцена ще не завантажена: закиньте вудку й натисніть «Оновити»",
    exportMissing: "бандл ще не завантажено",
    exportLabel: (fileName) => `Експорт ${fileName}`,
    statusRows: (status) => [["pixel ratio", String(status.pixelRatio)]],
    // The rod's bones on the canvas, and the line's tip beside the chosen bone.
    canvasPoints: true,
    tipBone: "line-tip",
  });

  static BOAT = Object.freeze({
    id: "SPINE_BOAT",
    title: (skeletonName) => `Кораблик (${skeletonName})`,
    fallbackName: "boat-lvl--3",
    defaultBone: "root",
    configLabel: "Масштаб і початкові координати (CONFIG.ui.boat)",
    notLoaded: "сцена ще не завантажена: спустіть кораблик на воду й натисніть «Оновити»",
    exportMissing: "скелет не завантажено",
    exportLabel: (fileName) => `Завантажити ${fileName} із правками кісток`,
    statusRows: (status) => [
      ...(status.currentClip ? [["поточний кліп", status.currentClip]] : []),
      ["нічні ліхтарі", status.lightsActive ? "увімкнено" : "вимкнено"],
    ],
    canvasPoints: false,
    tipBone: "",
  });

  #ui;
  #subject;
  #controller;
  #createSection;
  #renderConfigTree;
  #files;
  #content = null;
  #selectedBone;

  // createSection(label, parent, path) and renderConfigTree(parent) come from DevTools, so the section reuses its
  // collapsible state and the live config editor; files: the DEV file port ({ download(name, text) }) or null.
  constructor({ ui, subject, controller, createSection, renderConfigTree, files = null }) {
    this.#ui = ui;
    this.#subject = subject;
    this.#controller = controller;
    this.#createSection = createSection;
    this.#renderConfigTree = renderConfigTree;
    this.#files = files;
    this.#selectedBone = subject.defaultBone;
  }

  render(parent) {
    const subject = this.#subject;
    const skeletonName = this.#controller.exportSkeleton()?.fileName?.replace(/\.json$/i, "") || subject.fallbackName;
    this.#content = this.#createSection(subject.title(skeletonName), parent, [subject.id]);
    this.#fill();
  }

  // TK-387: redrawn through DevToolsUI.redraw — «Кістки» opens as a drill-in and a bone's choice or edit redraws this
  // section, so the drill-in is reopened with the rebuilt bones.
  #fill() {
    if (this.#content) this.#ui.redraw(this.#content, () => this.#draw(this.#content));
  }

  #draw(content) {
    const { id, configLabel, statusRows } = this.#subject;
    const status = this.#controller.getStatus();
    this.#ui.createInfoRow("режим", status.mode, content);
    if (status.reason) this.#ui.createInfoRow("причина без Spine", status.reason, content);
    if (status.missingClips?.length) this.#ui.createInfoRow("немає кліпів", status.missingClips.join(", "), content);
    this.#ui.createInfoRow("текстура", status.mipmapped ? "mipmaps (трилінійна)" : "фільтр атласу (без mipmaps)", content);
    for (const [label, value] of statusRows(status)) this.#ui.createInfoRow(label, value, content);
    this.#ui.createSwitcherRow("Spine увімкнено", this.#controller.isSpineEnabled(), content, (enabled) => {
      this.#controller.setSpineEnabled(enabled);
      this.#fill();
    }, [id, "enabled"]);
    this.#ui.createButtonRow("Оновити", content, () => this.#fill(), false, "", null, { icon: "refresh" });
    this.#renderClips(content);
    this.#renderConfigTree(this.#createSection(configLabel, content, [id, "config"]));
    this.#renderBones(content);
    this.#renderExport(content);
  }

  #renderClips(parent) {
    const { id, notLoaded } = this.#subject;
    const section = this.#createSection("Анімації", parent, [id, "clips"]);
    const clips = this.#controller.getClips();
    if (clips.length === 0) {
      this.#ui.createInfoRow("кліпи", notLoaded, section);
      return;
    }
    for (const clip of clips) {
      this.#ui.createSwitcherRow(`${clip.name} · ${clip.duration.toFixed(2)} с`, clip.enabled, section,
        (enabled) => this.#controller.setClipEnabled(clip.name, enabled), [id, "clips", clip.name]);
    }
  }

  #renderBones(parent) {
    const { id, notLoaded, canvasPoints, tipBone } = this.#subject;
    const section = this.#createSection("Кістки", parent, [id, "bones"]);
    const bones = this.#controller.getBones();
    if (bones.length === 0) {
      this.#ui.createInfoRow("кістки", notLoaded, section);
      return;
    }
    if (!bones.some((bone) => bone.name === this.#selectedBone)) this.#selectedBone = bones[0].name;
    this.#ui.createSelectRow("кістка", bones.map((bone) => bone.name), this.#selectedBone, section, (name) => {
      this.#selectedBone = name;
      this.#fill();
    }, [id, "bones", "selected"]);
    const bone = bones.find((entry) => entry.name === this.#selectedBone);
    this.#ui.createInfoRow("батьківська", bone.parent ?? "—", section);
    for (const key of BONE_KEYS) {
      this.#ui.createInputRow(key, bone[key], section, "number", (value) => {
        this.#controller.setBoneSetup(bone.name, { [key]: value });
        this.#fill();
      }, [id, "bones", bone.name, key]);
    }
    if (canvasPoints) {
      this.#ui.createInfoRow("на канвасі x, y", SpineDevSection.#pair(bone.canvasX, bone.canvasY), section);
      const tip = bones.find((entry) => entry.name === tipBone);
      if (tip && tip !== bone) {
        this.#ui.createInfoRow(`${tipBone} на канвасі`, SpineDevSection.#pair(tip.canvasX, tip.canvasY), section);
      }
    }
    const edited = Object.keys(this.#controller.getBoneEdits());
    this.#ui.createInfoRow("змінені кістки", edited.length ? edited.join(", ") : "немає", section);
  }

  #renderExport(parent) {
    const { exportMissing, exportLabel } = this.#subject;
    const exported = this.#controller.exportSkeleton();
    if (!exported) {
      this.#ui.createInfoRow("експорт", exportMissing, parent);
      return;
    }
    if (!this.#files) return;
    this.#ui.createButtonRow(exportLabel(exported.fileName), parent, () => {
      // The skeleton as it is at the press (bone edits made after the section was drawn included).
      const current = this.#controller.exportSkeleton();
      if (current) this.#files.download(current.fileName, current.text);
    });
  }

  static #pair(x, y) {
    return Number.isFinite(x) && Number.isFinite(y) ? `${x.toFixed(1)}, ${y.toFixed(1)}` : "—";
  }
}
