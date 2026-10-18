# DEV zone editor and metre grid

Owner, 2026-10-18: compose existing zone/debug tools into a live WebGL editor; optional black background, all zones,
perspective metre grid, bounded redraw. The grid uses the actual WaterMetric (spec 109); it never owns physics.

DEV-only `ZoneEditorState` owns diagnostic visibility and grid spacing. `ZoneEditorGeometryBuilder` reads the actual
LocationMap and metric, projects ground metres through WaterMetric and ViewportProjector and caches one reusable
annotation model. Static geometry rebuilds only on map revision, metric identity, camera transform or editor edits;
moving zones invalidate only while shown. Grid spacing is at least .25 m, at most 96 rows/columns, sampled curves
at 24 segments: bounded CPU/GPU work. No extra animation loop, event listener or per-frame texture upload.

`ZoneEditorSection` reuses DevToolsUI controls and the authoritative runtime override setter. Select a category/zone,
edit its existing geometry tree, add/delete a zone, or edit the location's distanceProfile. Changes use the same
config validation/refresh path and Export overrides as the rest of DevTools. Visibility controls are independent
of physics zone-enable switches. Location geometry stays in its existing design-cell units and save format.

Production has no DEV import or editor state: the ordinary frame carries an optional generic annotation model.
`PixiAnnotationRenderer` retains separate static/moving Graphics and redraws each on its own model revision; moving
zones never rebuild the grid. Canvas WorldDebugRenderer consumes
the same geometry during no-WebGL/context-loss fallback. Hidden background removes its layers and the water's
background copy, clears black on both renderers, and leaves world objects visible. The rod is never rescaled.

Acceptance: deterministic grid<->metre round trips, exact camera pan/zoom, zone visibility without physics mutation,
unchanged frames produce no geometry rebuild or Graphics writes, moving zones invalidate, runtime edits/add/delete
use exact config paths and preserve validation, WebGL and Canvas consume identical commands, context restore
redraws once, lifecycle disposal. Focused + Architecture + Quick + Full. No new CSS, markup, library or vendor build.

Owner visual check (not performed by agent): dev.html -> DevTools -> РЕДАКТОР ЗОН, enable, hide/show background,
toggle every zone, change grid step, edit/add/remove a zone and Export overrides; pan/resize portrait/landscape;
compare float/boat scale to grid and check FPS with water on/off. Repeat with ?scene=canvas and context loss/restore.
No old tool becomes unused: the existing map/depth raster remains the fallback diagnostic when the editor is off.

Implementation evidence: `zone-editor` checks 120 stable producer frames with zero rebuilds and 120 stable renderer
frames with zero Graphics writes, camera/metric/map changes, moving zones without a static-grid rebuild, hidden zones, in-place geometry identity,
black background and restore, no duplicate Canvas/WebGL annotation draw, scoped UI binding cleanup and exact
runtime paths for add/remove. The metre rows round-trip through the actual metric; grid work is capped.
Removed the now-unread location `perspective.angleTop/angleBottom` config and corresponding obsolete fixture data
after checking every source/test consumer. DEV's old angle-copy diagnostic now reads the session's actual metric.
No utility, live check, baseline, whitelist, dependency, vendor export or package script was removed or weakened.

Final validation for v0.41.7: focused line-limit/grid/viewport checks, Architecture 4, Quick 36 and Full 62 pass;
game-cycle baseline unchanged. The line check runs the real FloatEntity current integration, real CastRodControl
(enabled and disabled), both idle states and uniform/profiled water. Visual and phone/GPU performance acceptance
remain with the owner; automated bounded-work counters are not an FPS measurement.
