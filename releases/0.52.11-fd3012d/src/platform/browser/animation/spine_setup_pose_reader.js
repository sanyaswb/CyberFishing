// The static rod picture without the runtime (spec 099, D9): the skeleton JSON header bounds, the line point in the
// setup pose and the one drawn region. Only plain bones (translate, rotate, scale; normal inherit, no shear) are
// followed; otherwise the line point is null and the caller uses the top centre of the bounds. A skeleton with more
// than one drawn slot has no single picture (region null), so the caller keeps the rectangle.
export class SpineSetupPoseReader {
  static read(skeletonJson, atlas, { skin = null, linePoint = null } = {}) {
    const header = skeletonJson?.skeleton ?? {};
    const bounds = Object.freeze({
      x: Number(header.x) || 0, y: Number(header.y) || 0,
      width: Number(header.width) || 0, height: Number(header.height) || 0,
    });
    return Object.freeze({
      bounds,
      linePoint: linePoint ? SpineSetupPoseReader.#linePoint(skeletonJson, skin, linePoint) : null,
      region: SpineSetupPoseReader.#region(skeletonJson, atlas, skin),
    });
  }

  static #linePoint(json, skinName, name) {
    const bones = Array.isArray(json?.bones) ? json.bones : [];
    let bone = bones.find((entry) => entry.name === name);
    let local = { x: 0, y: 0 };
    if (!bone) {
      const point = SpineSetupPoseReader.#pointAttachment(json, skinName, name);
      if (!point) return null;
      bone = bones.find((entry) => entry.name === point.boneName);
      local = { x: Number(point.attachment.x) || 0, y: Number(point.attachment.y) || 0 };
    }
    const world = SpineSetupPoseReader.#worldTransform(bones, bone);
    if (!world) return null;
    return Object.freeze({ x: world.a * local.x + world.b * local.y + world.x, y: world.c * local.x + world.d * local.y + world.y });
  }

  static #pointAttachment(json, skinName, name) {
    const slots = Array.isArray(json?.slots) ? json.slots : [];
    for (const skin of SpineSetupPoseReader.#skins(json, skinName)) {
      for (const [slotName, attachments] of Object.entries(skin.attachments ?? {})) {
        const attachment = attachments?.[name];
        if (attachment?.type === "point") {
          return { attachment, boneName: slots.find((slot) => slot.name === slotName)?.bone };
        }
      }
    }
    return null;
  }

  static #worldTransform(bones, bone) {
    if (!bone) return null;
    const chain = [];
    for (let current = bone; current; current = bones.find((entry) => entry.name === current.parent)) {
      if ((current.inherit ?? "normal") !== "normal" || Number(current.shearX) || Number(current.shearY)) return null;
      chain.unshift(current);
      if (chain.length > bones.length) return null;
    }
    let world = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
    for (const entry of chain) {
      const radians = ((Number(entry.rotation) || 0) * Math.PI) / 180;
      const scaleX = entry.scaleX ?? 1;
      const scaleY = entry.scaleY ?? 1;
      const la = Math.cos(radians) * scaleX;
      const lb = -Math.sin(radians) * scaleY;
      const lc = Math.sin(radians) * scaleX;
      const ld = Math.cos(radians) * scaleY;
      const x = Number(entry.x) || 0;
      const y = Number(entry.y) || 0;
      world = {
        a: world.a * la + world.b * lc, b: world.a * lb + world.b * ld,
        c: world.c * la + world.d * lc, d: world.c * lb + world.d * ld,
        x: world.a * x + world.b * y + world.x, y: world.c * x + world.d * y + world.y,
      };
    }
    return world;
  }

  static #region(json, atlas, skinName) {
    const drawn = [];
    for (const slot of Array.isArray(json?.slots) ? json.slots : []) {
      if (!slot.attachment) continue;
      for (const skin of SpineSetupPoseReader.#skins(json, skinName)) {
        const attachment = skin.attachments?.[slot.name]?.[slot.attachment];
        if (!attachment) continue;
        if ((attachment.type ?? "region") === "region" || attachment.type === "mesh") {
          drawn.push(attachment.path ?? slot.attachment);
        }
        break;
      }
    }
    if (drawn.length !== 1) return null;
    for (const page of atlas?.pages ?? []) {
      const region = page.regions.find((entry) => entry.name === drawn[0]);
      if (region) return Object.freeze({ pageName: page.name, ...region });
    }
    return null;
  }

  // The named skin first, then "default" (its attachments apply to every skin).
  static #skins(json, skinName) {
    const skins = Array.isArray(json?.skins) ? json.skins : [];
    return [skins.find((skin) => skin.name === skinName), skins.find((skin) => skin.name === "default")].filter(Boolean);
  }
}
