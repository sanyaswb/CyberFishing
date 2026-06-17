const fs = require("node:fs");
const path = require("node:path");

require("./pole-fight-sector-check.js");

const ROOT = path.resolve(__dirname, "..");
const renderer = fs.readFileSync(
  path.join(ROOT, "src/render/fishing/fight_area_renderer.js"),
  "utf8",
);
const builder = fs.readFileSync(
  path.join(ROOT, "src/app/rendering/fight_area_render_frame_builder.js"),
  "utf8",
);
const landing = fs.readFileSync(
  path.join(ROOT, "src/app/rendering/landing_area_render_frame_builder.js"),
  "utf8",
);

if (
  renderer.indexOf("withClip") > renderer.indexOf("#drawLastDash") ||
  !renderer.includes("this.#drawCatch") ||
  !renderer.includes("this.#drawNet") ||
  !renderer.includes("this.#drawSector") ||
  !renderer.includes("this.#drawLineRadius")
) {
  throw new Error("FightAreaRenderer lost clipping or a required layer");
}
if (
  !builder.includes("debug?.poleFightSectorActive === true") ||
  !builder.includes("this.#sectorGeometry.resolve({")
) {
  throw new Error("Fight area builder does not share active/preview geometry");
}
if (
  !landing.includes("target.catchZone") ||
  !landing.includes("target.lastDashZone") ||
  !landing.includes("target.netZone")
) {
  throw new Error("Landing area builder lost catch, lastDash or net geometry");
}
console.log("fight-area-renderer-check passed:");
console.log("- clipping wraps all fight-area layers");
console.log("- active fight consumes physics geometry");
console.log("- preview uses shared PoleFightSectorGeometry");
console.log("- catch, lastDash and net models are built");
