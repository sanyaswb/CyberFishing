# First rod skin: bamboo rod artwork

Owner instructions: 2026-10-14. The bamboo rod (`rod_test_float`, "Бамбукова Вудка") gets the first painted skin,
`assets/items/rods/bamboo-rod-ecip-v1.png` (rings and line) with its lineless variant
`assets/items/rods/bamboo-rod-unecip-v1.png` (rings, no line). Both are 1024 × 1536 transparent PNGs.
Their generation prompts are kept in [docs/art-prompts/rods](../../docs/art-prompts/rods/).

1. **Catalog skin.** The rod definition carries `skin`: the thumbnail framing and the two equipment images. Every
   path lives only there, so a later WebP conversion changes one entry.
2. **Thumbnails.** Item cards (backpack list, craft panel, saved loadouts, tooltips' card) show
   `bamboo-rod-ecip-v1` aligned to the bottom: only the lower half of the artwork fits the card (`visibleHeight` 0.5),
   centred on the drawn butt and lower shaft (`focusX`, the share of the image width placed at the card centre).
3. **Equipment cell.** The equipped rod's cell shows the whole artwork: without an equipped fishing line the lineless
   image, with one (`EquipmentReadModel.line`: terminal line or the reel's line) the image with line.
4. Items without a skin keep their emoji/icon; no gameplay, save or formula changes.

Verification: integration check for the rod cell image switching with the line; UI check for the cropped thumbnail;
Architecture, Quick, Full; unchanged game-cycle digest. Owner visual acceptance; no browser testing by Claude.
