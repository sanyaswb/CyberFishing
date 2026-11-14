// The contract of a DevTools panel module (spec 174 B3). A module owns one area of the panel and draws it into the
// host it is given; DevTools only orders the modules and gives each the same context.
//
//   module.mount(host, context)  draws the module's sections into host (called on every full redraw);
//   module.dispose()              optional: called once when DevTools is disposed (listeners, timers, open editors);
//                                 a module that keeps a section between draws disposes the old one in mount().
//
// context: { ui (DevToolsUI), createSection(label, parent, path, options) (a remembered disclosure),
//            tree (ConfigTreeRenderer), edits (DevConfigEditService) }.
//
// A module receives its own collaborators in its constructor (the game ports it shows or edits) and never reaches
// another module.
export function assertDevPanelModule(module) {
  if (typeof module?.mount !== "function") throw new TypeError("A DevTools panel module requires mount(host, context)");
  return module;
}
