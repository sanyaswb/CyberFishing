// DevTools "SPINE ВУДКА" (spec 099 Phase 4, owner 2026-10-17): Spine on/off (to see the static picture), every clip
// with an on/off switch, the live CONFIG.ui.rod.spine values (scale and timing, kept by the override store), a bone
// editor with canvas coordinates, and the export of the edited skeleton JSON for Import Data in the Spine editor.
const BONE_KEYS = Object.freeze(["x", "y", "rotation", "scaleX", "scaleY"]);
const DEFAULT_BONE = "rod";

export class SpineRodDevSection {
  #ui;
  #controller;
  #createSection;
  #renderConfigTree;
  #documentRef;
  #windowRef;
  #content = null;
  #selectedBone = DEFAULT_BONE;

  // createSection(label, parent, path) and renderConfigTree(parent) come from DevTools, so the section reuses its
  // collapsible state and the live config editor.
  constructor({ ui, controller, createSection, renderConfigTree, documentRef = document, windowRef = window }) {
    this.#ui = ui;
    this.#controller = controller?.controller ?? controller;
    this.#createSection = createSection;
    this.#renderConfigTree = renderConfigTree;
    this.#documentRef = documentRef;
    this.#windowRef = windowRef;
  }

  render(parent) {
    const skeletonName = this.#controller.exportSkeleton()?.fileName?.replace(/\.json$/i, "") || "rod";
    this.#content = this.#createSection(skeletonName, parent, ["SPINE_ROD"]);
    this.#fill();
  }

  #fill() {
    const content = this.#content;
    if (!content) return;
    content.replaceChildren();
    const status = this.#controller.getStatus();
    this.#ui.createInfoRow("режим", status.mode, content);
    if (status.reason) this.#ui.createInfoRow("причина без Spine", status.reason, content);
    if (status.missingClips.length) this.#ui.createInfoRow("немає кліпів", status.missingClips.join(", "), content);
    this.#ui.createInfoRow("текстура", status.mipmapped ? "mipmaps (трилінійна)" : "фільтр атласу (без mipmaps)", content);
    this.#ui.createInfoRow("pixel ratio", String(status.pixelRatio), content);
    this.#ui.createSwitcherRow("Spine увімкнено", this.#controller.isSpineEnabled(), content, (enabled) => {
      this.#controller.setSpineEnabled(enabled);
      this.#fill();
    }, ["SPINE_ROD", "enabled"]);
    this.#ui.createButtonRow("↻ Оновити", content, () => this.#fill());
    this.#renderClips(content);
    this.#renderConfigTree(this.#createSection("Масштаб і параметри (CONFIG.ui.rod.spine)", content,
      ["SPINE_ROD", "config"]));
    this.#renderBones(content);
    this.#renderExport(content);
  }

  #renderClips(parent) {
    const section = this.#createSection("Анімації", parent, ["SPINE_ROD", "clips"]);
    const clips = this.#controller.getClips();
    if (clips.length === 0) {
      this.#ui.createInfoRow("кліпи", "сцена ще не завантажена: закиньте вудку й натисніть ↻", section);
      return;
    }
    for (const clip of clips) {
      this.#ui.createSwitcherRow(`${clip.name} · ${clip.duration.toFixed(2)} с`, clip.enabled, section,
        (enabled) => this.#controller.setClipEnabled(clip.name, enabled), ["SPINE_ROD", "clips", clip.name]);
    }
  }

  #renderBones(parent) {
    const section = this.#createSection("Кістки", parent, ["SPINE_ROD", "bones"]);
    const bones = this.#controller.getBones();
    if (bones.length === 0) {
      this.#ui.createInfoRow("кістки", "сцена ще не завантажена: закиньте вудку й натисніть ↻", section);
      return;
    }
    if (!bones.some((bone) => bone.name === this.#selectedBone)) this.#selectedBone = bones[0].name;
    this.#ui.createSelectRow("кістка", bones.map((bone) => bone.name), this.#selectedBone, section, (name) => {
      this.#selectedBone = name;
      this.#fill();
    }, ["SPINE_ROD", "bones", "selected"]);
    const bone = bones.find((entry) => entry.name === this.#selectedBone);
    this.#ui.createInfoRow("батьківська", bone.parent ?? "—", section);
    for (const key of BONE_KEYS) {
      this.#ui.createInputRow(key, bone[key], section, "number", (value) => {
        this.#controller.setBoneSetup(bone.name, { [key]: value });
        this.#fill();
      }, ["SPINE_ROD", "bones", bone.name, key]);
    }
    this.#ui.createInfoRow("на канвасі x, y", SpineRodDevSection.#pair(bone.canvasX, bone.canvasY), section);
    const tip = bones.find((entry) => entry.name === "line-tip");
    if (tip && tip !== bone) {
      this.#ui.createInfoRow("line-tip на канвасі", SpineRodDevSection.#pair(tip.canvasX, tip.canvasY), section);
    }
    const edited = Object.keys(this.#controller.getBoneEdits());
    this.#ui.createInfoRow("змінені кістки", edited.length ? edited.join(", ") : "немає", section);
  }

  #renderExport(parent) {
    const exported = this.#controller.exportSkeleton();
    if (!exported) {
      this.#ui.createInfoRow("експорт", "бандл ще не завантажено", parent);
      return;
    }
    this.#ui.createButtonRow(`⬇ Експорт ${exported.fileName}`, parent, () => {
      const current = this.#controller.exportSkeleton();
      if (current) this.#download(current.fileName, current.text);
    });
  }

  #download(fileName, text) {
    const url = this.#windowRef.URL.createObjectURL(new this.#windowRef.Blob([text], { type: "application/json" }));
    const link = this.#documentRef.createElement("a");
    link.href = url;
    link.download = fileName;
    this.#documentRef.body.appendChild(link);
    link.click();
    link.remove();
    this.#windowRef.setTimeout(() => this.#windowRef.URL.revokeObjectURL(url), 0);
  }

  static #pair(x, y) {
    return Number.isFinite(x) && Number.isFinite(y) ? `${x.toFixed(1)}, ${y.toFixed(1)}` : "—";
  }
}
