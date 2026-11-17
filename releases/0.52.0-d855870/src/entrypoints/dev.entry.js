import { enlargeResourceTimingBuffer } from "../bootstrap/development/resource_timing_capacity.js";

// Spec 157 R9: the buffer grows before the startup graph is requested; static imports would load first.
enlargeResourceTimingBuffer();
const { startDevelopmentGame } = await import("../bootstrap/development/development_game_startup.js");
startDevelopmentGame();
