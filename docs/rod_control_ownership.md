# Rod lateral motion ownership

The rod offset calculation belongs to `game/application/fishing/rod_visual_offset_system.js`. It is stateful application motion, composed by bootstrap and injected into `GameViewportFacade`. Presentation reads its position and delegates update/projection through the existing application-facing viewport port; it does not construct its own movement state.

This ownership change preserves the class, calculations, update order, reset behavior, configuration and screen clamps. There is one canonical export and no compatibility bridge. `getRodAimFrame()` exposes its existing observation for application orchestration; it does not introduce a second writable movement owner.

The relocation is committed independently of new cast/fight mechanics. Validation of the staged source snapshot passed Architecture (4), Quick (27) and Full (53), with the existing game-cycle baseline unchanged. The temporary snapshot has its own Git index/HEAD because the Spine and immutable release fixtures verify tracked/committed assets. Focused viewport, platform-runtime and application-composition checks retain their original assertions. Visual acceptance remains with the owner.
