window.DEBUG_MODULES = {
  ...((typeof CONFIG !== "undefined" && CONFIG.debug?.consoleModules) || {}),
  ...(window.DEBUG_MODULES || {}),
};

const debugModuleRegistry = new DebugModuleRegistry();

[
  new BiteTicksDebugModule(),
  new LocationDebugModule(),
  new MapDebugModule(),
  new ForcesDebugModule(),
  new DeviationsDebugModule(),
  new TensionDebugModule(),
  new RodStrokeDebugModule(),
  new StaminaDebugModule(),
  new ExhaustionDebugModule(),
  new CatchTimeDebugModule(),
  new PredictionDebugModule(),
  new NetDebugModule(),
].forEach((module) => debugModuleRegistry.register(module));

const debugContext = new DebugContext();
const debugConsole = new window.DebugConsoleClass({
  context: debugContext,
  registry: debugModuleRegistry,
  debugModulesSource: () => window.DEBUG_MODULES || {},
});
const biteTickLogger = new BiteTickLogPrinter({
  debugModulesSource: () => window.DEBUG_MODULES || {},
});
const biteSequenceLogger = new BiteSequenceLogPrinter({
  debugModulesSource: () => window.DEBUG_MODULES || {},
});

new DebugEventBinder({
  debugConsole,
  debugModulesSource: () => window.DEBUG_MODULES || {},
  biteTickLogger,
  biteSequenceLogger,
}).bind();

function getActiveLocationDebugData() {
  return new LocationDebugDataProvider().getActiveData();
}

function getZoneBounds(zones, cellSize, baseRes) {
  return new LocationDebugDataProvider().getZoneBounds(
    zones,
    cellSize,
    baseRes,
  );
}

window.DEBUG_MODULE_REGISTRY = debugModuleRegistry;
window.DEBUG_CONSOLE_MODULES = debugModuleRegistry.toLegacyMap();
window.DebugConsole = debugConsole;
window.DebugRuntime = debugConsole;
window.getActiveLocationDebugData = getActiveLocationDebugData;
window.getZoneBounds = getZoneBounds;
window.printLocationMapDebug = () => new LocationDebugPrinter().print();
window.printBiteTickLog = (detail) => biteTickLogger.print(detail);
window.printBiteSequenceLog = (detail) => biteSequenceLogger.print(detail);
