"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MARKUP_MODULE = "src/game/presentation/house/house_screen_markup.js";

// The House screen markup as authored (spec 084), for checks that parse it into their fake documents.
function readHouseMarkup(projectRoot = path.resolve(__dirname, "../../..")) {
  const source = fs.readFileSync(path.join(projectRoot, MARKUP_MODULE), "utf8");
  const match = source.match(/export const HOUSE_SCREEN_MARKUP = `([\s\S]*?)`;/u);
  if (!match) throw new Error(`${MARKUP_MODULE} must export HOUSE_SCREEN_MARKUP as one template literal`);
  return match[1];
}

module.exports = { readHouseMarkup, MARKUP_MODULE };
