// Frame timing port (spec 101). The game loop, the render pipeline, the scene layer (spec 103) and the Spine rod
// renderer report into it; production composes this inactive probe (no clock reads, no work), DEV composes the
// FrameProfiler behind the overlay's performance module. Calls: beginFrame(timestampMs) once per animation frame,
// begin(id) / end(id) around a section, gauge(id, value) for a size worth seeing (pixels), endFrame().
export const FRAME_SECTIONS = Object.freeze({
  update: "update",
  draw: "draw",
  scene: "scene",
  rodSpine: "rod-spine",
});

export const FRAME_GAUGES = Object.freeze({
  glPixels: "gl-pixels",
  scenePixels: "scene-pixels",
});

export const FRAME_PROBE_METHODS = Object.freeze(["beginFrame", "begin", "end", "gauge", "endFrame"]);

export class InactiveFrameProbe {
  beginFrame() {}

  begin() {}

  end() {}

  gauge() {}

  endFrame() {}
}
