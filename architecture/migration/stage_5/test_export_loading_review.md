# Explicit test export loading

Cluster 017 exposes only RenderFrameBuffer to classic production consumers; GameRenderFrame, ReusableRenderList and the order catalogs remain named ESM exports. The existing fish-rarity scenario requests GameRenderFrame through SourceRuntime, so its test-only loader must resolve that explicit request from the recorded target module.

Extend the existing StageThreeCompatibilityTestLoader, without production changes or new activation/global/bridge admissions. Resolve only requested missing names from the exact active/retired source targets, retaining existing bindings, unknown-name behavior and class identity. The runtime build still publishes only the registered production activation symbols. The storage scenario checks exact export identities and missing-name behavior; fish-rarity remains functional and stdout-identical. No test or guard is removed.
