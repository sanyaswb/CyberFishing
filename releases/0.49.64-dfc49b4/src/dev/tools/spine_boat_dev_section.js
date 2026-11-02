// DevTools "SPINE КОРАБЛИК" (spec 150 TK-145): Spine on/off (to see emoji fallback), clips list,
// live CONFIG.ui.boat values (displayScale and initial coordinates: x, xOffset, yOffset), bone editor and skeleton export.
const BONE_KEYS = Object.freeze(["x", "y", "rotation", "scaleX", "scaleY"]);
const DEFAULT_BONE = "root";

export class SpineBoatDevSection {
  #ui;
  #controller;
  #createSection;
  #renderConfigTree;
  #documentRef;
  #windowRef;
  #content = null;
  #selectedBone = DEFAULT_BONE;

  constructor({ ui, controller, createSection, renderConfigTree, documentRef = (typeof document !== "undefined" ? document : null), windowRef = (typeof window !== "undefined" ? window : null) }) {
    this.#ui = ui;
    this.#controller = controller?.controller ?? controller;
    this.#createSection = createSection;
    this.#renderConfigTree = renderConfigTree;
    this.#documentRef = documentRef;
    this.#windowRef = windowRef;
  }

  render(parent) {
    const skeletonName = this.#controller.exportSkeleton()?.fileName?.replace(/\.json$/i, "") || "boat-lvl--3";
    this.#content = this.#createSection(`Кораблик (${skeletonName})`, parent, ["SPINE_BOAT"]);
    this.#fill();
  }

  #fill() {
    const content = this.#content;
    if (!content) return;
    content.replaceChildren();
    const status = this.#controller.getStatus();
    this.#ui.createInfoRow("режим", status.mode, content);
    if (status.reason) this.#ui.createInfoRow("причина без Spine", status.reason, content);
    if (status.missingClips?.length) this.#ui.createInfoRow("немає кліпів", status.missingClips.join(", "), content);
    this.#ui.createInfoRow("текстура", status.mipmapped ? "mipmaps (трилінійна)" : "фільтр атласу (без mipmaps)", content);
    if (status.currentClip) this.#ui.createInfoRow("поточний кліп", status.currentClip, content);
    this.#ui.createInfoRow("нічні ліхтарі", status.lightsActive ? "увімкнено" : "вимкнено", content);
    this.#ui.createSwitcherRow("Spine увімкнено", this.#controller.isSpineEnabled(), content, (enabled) => {
      this.#controller.setSpineEnabled(enabled);
      this.#fill();
    }, ["SPINE_BOAT", "enabled"]);
    this.#ui.createButtonRow("↻ Оновити", content, () => this.#fill());
    this.#renderClips(content);
    this.#renderConfigTree(this.#createSection("Масштаб і початкові координати (CONFIG.ui.boat)", content,
      ["SPINE_BOAT", "config"]));
    this.#renderBones(content);
    this.#renderExport(content);
  }

  #renderClips(parent) {
    const section = this.#createSection("Анімації", parent, ["SPINE_BOAT", "clips"]);
    const clips = this.#controller.getClips();
    if (clips.length === 0) {
      this.#ui.createInfoRow("кліпи", "сцена ще не завантажена: спустіть кораблик на воду й натисніть ↻", section);
      return;
    }
    for (const clip of clips) {
      this.#ui.createSwitcherRow(`${clip.name} · ${clip.duration.toFixed(2)} с`, clip.enabled, section,
        (enabled) => this.#controller.setClipEnabled(clip.name, enabled), ["SPINE_BOAT", "clips", clip.name]);
    }
  }

  #renderBones(parent) {
    const section = this.#createSection("Кістки", parent, ["SPINE_BOAT", "bones"]);
    const bones = this.#controller.getBones();
    if (bones.length === 0) {
      this.#ui.createInfoRow("кістки", "сцена ще не завантажена: спустіть кораблик на воду й натисніть ↻", section);
      return;
    }
    if (!bones.some((bone) => bone.name === this.#selectedBone)) this.#selectedBone = bones[0].name;
    this.#ui.createSelectRow("кістка", bones.map((bone) => bone.name), this.#selectedBone, section, (name) => {
      this.#selectedBone = name;
      this.#fill();
    }, ["SPINE_BOAT", "bones", "selected"]);
    const bone = bones.find((entry) => entry.name === this.#selectedBone);
    this.#ui.createInfoRow("батьківська", bone.parent ?? "—", section);
    for (const key of BONE_KEYS) {
      this.#ui.createInputRow(key, bone[key], section, "number", (value) => {
        this.#controller.setBoneSetup(bone.name, { [key]: value });
        this.#fill();
      }, ["SPINE_BOAT", "bones", bone.name, key]);
    }
    const edited = Object.keys(this.#controller.getBoneEdits());
    this.#ui.createInfoRow("змінені кістки", edited.length ? edited.join(", ") : "немає", section);
  }

  #renderExport(parent) {
    const exported = this.#controller.exportSkeleton();
    if (!exported) {
      this.#ui.createInfoRow("експорт", "скелет не завантажено", parent);
      return;
    }
    this.#ui.createButtonRow(`Завантажити ${exported.fileName} із правками кісток`, parent, () => {
      const blob = new Blob([exported.text], { type: "application/json" });
      const url = this.#windowRef.URL.createObjectURL(blob);
      const link = this.#documentRef.createElement("a");
      link.href = url;
      link.download = exported.fileName;
      link.click();
      this.#windowRef.URL.revokeObjectURL(url);
    });
  }
}
