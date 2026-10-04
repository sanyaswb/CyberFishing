# Standard typed-array projection

The original StarRatingRenderer uses two Float32Array scratch buffers created once per renderer. The architecture policy already classifies Float32Array as a language-runtime builtin (freeIdentifierClassification.builtins). The Stage 4/5 projector omitted it from its shorter language list.

Recognize that exact standard builtin in the shared projector so the class remains byte-identical; do not inject a platform port or replace allocations for a language operation. No architecture policy, exception, debt, provider or bridge admission changes. Add fixtures that allow the typed array and still reject a browser read combined with it. All existing negative fixtures remain.
