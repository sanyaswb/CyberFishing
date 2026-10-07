"use strict";

const composition = require("./testing/runtime/game_application_test_composition");
const facade = require("./testing/runtime/game_facade_test_composition");

// GameApplication with and without DEV diagnostics (and with malformed diagnostics), then the Game facade.
composition.checkGameApplicationComposition().then(async () => {
  await composition.checkGameApplicationComposition(false);
  await composition.checkGameApplicationComposition("malformed");
  await facade.checkGameFacadeComposition();
  console.log("Game application composition checks passed.");
}).catch((error) => { console.error(error); process.exitCode = 1; });
