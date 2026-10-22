# Plan

Consumers inspected: ZoneEditorSection creates and displays authored records; ZoneEditorConfigEdits projects accepted edits from LocationMap; DynamicZone owns live geometry; ZoneEditorGeometryBuilder supplies reusable annotation commands to PixiAnnotationRenderer and WorldDebugRenderer; zone_export_format validates and serializes both UI and CLI zone files.

1. Add optional shape to live records and file validation, retaining absent-shape legacy semantics.
2. Add creation choice and selected shape controls using existing select components. New shapes use equal sides; empty-list creation supplies valid motion and bounds.
3. Add circle annotation commands using the existing reused records/cache and draw them with native ellipse primitives in both backends.
4. Match circular pointer contours and cardinal handles; keep uniform resize and current-position command ownership/constraints.
5. Extend deterministic zone-editor/export scenarios, run focused checks and Full, patch version and changelog. Owner acceptance remains separate.

No production-to-DEV dependency, new mutable gameplay owner, texture or per-frame DOM work is needed. No unrelated architecture changes.
