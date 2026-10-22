import { Vector2 } from "../../engine/math/vector2.js";

// The zone editor's world layer (spec 129, Revision 2): the editor's geometry, its drag layer and, while the editor
// is on with the depth numbers switched on, the location's depth map at the editor's depth opacity. Without the
// editor nothing is drawn: zones, fills and cell lines are the editor's own geometry.
export class LocationDebugRenderFrameBuilder {
  #map;
  #projector;
  #config;
  #debugMapBuilder;
  #screen = new Vector2(0, 0);
  #debugCanvas = null;
  #lastDebugKey = "";
  #zoneEditor;
  #zoneEditorTool;
  #editorState;

  // zoneEditor: { buildInto(target) } geometry; zoneEditorTool: optional { sync() } kept in step with the editor's
  // switches once per frame (the drag layer); editorState: ZoneEditorState (enabled, depth, depthOpacity).
  constructor({ map, projector, config, debugMapBuilder, zoneEditor = null, zoneEditorTool = null, editorState = null }) {
    if (!debugMapBuilder || typeof debugMapBuilder.build !== "function") {
      throw new TypeError(
        "LocationDebugRenderFrameBuilder requires debugMapBuilder",
      );
    }
    this.#map = map;
    this.#projector = projector;
    this.#config = config;
    this.#debugMapBuilder = debugMapBuilder;
    this.#zoneEditor = zoneEditor;
    this.#zoneEditorTool = zoneEditorTool;
    this.#editorState = editorState;
  }

  buildInto(target) {
    this.#zoneEditor?.buildInto(target);
    this.#zoneEditorTool?.sync();
    const state = this.#editorState;
    if (!state?.enabled || !state.depth || !(state.depthOpacity > 0)) return;
    const debugCanvas = this.#getDebugCanvas(this.#config.locations || {});
    if (!debugCanvas) return;
    const position = this.#projector.virtualToScreen(0, 0, this.#screen);
    const scale = this.#projector.getScale();
    target.debugImage.visible = true;
    target.debugImage.image = debugCanvas;
    target.debugImage.x = position.x;
    target.debugImage.y = position.y;
    target.debugImage.width = debugCanvas.width * scale;
    target.debugImage.height = debugCanvas.height * scale;
    target.debugImage.alpha = state.depthOpacity;
  }

  #getDebugCanvas(locations) {
    const key = `${this.#map.getRevision()}|${locations.cellSize}`;
    if (key !== this.#lastDebugKey || !this.#debugCanvas) {
      this.#lastDebugKey = key;
      this.#debugCanvas = this.#debugMapBuilder.build({
        map: this.#map,
        locationsConfig: locations,
      });
    }
    return this.#debugCanvas;
  }
}
