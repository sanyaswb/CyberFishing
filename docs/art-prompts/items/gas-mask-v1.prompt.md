# Gas mask v1 (spec 179)

Item art for the gas mask (`itemType: "gas_mask"`, slot `gasMask`). Target: 1024 × 1024 PNG with real transparent alpha,
converted afterwards with `utils/convert-images.js batch --masters` (WebP + `--low`, master to `asset-sources/items/`).
Style matches the location art (graphic novel, clean dark line art, cel-shading) and the existing item art.

## Prompt

```text
Use case: game inventory item icon, single isolated object.
Subject: a worn Soviet-style rubber gas mask (GP-5 type) with a full-face grey-green rubber hood, two round glass eyepieces
in dull steel rims, a short ribbed corrugated hose leading down to a cylindrical olive-drab filter canister with a dented
metal cap. Signs of long use in a post-industrial irradiated zone: scuffed rubber, a small hand-made patch of black tape
on one side, faint rust on the canister seam, a thin smear of dried mud. One eyepiece has a slight greenish reflection.
Style: 2D hand-drawn video game item art, graphic novel aesthetic, clean dark ink line art with consistent outline
weight, smooth layered cel-shading in 3-4 tones, 5/10 detail density, muted desaturated palette (grey-green rubber,
olive filter, dull steel), soft top-left key light.
Composition: three-quarter front view, the mask and its canister fully inside the frame, centred, about 80% of the
canvas height, nothing cropped. Square 1:1 canvas, 1024 x 1024.
Background: real transparent alpha background. No floor, no cast shadow, no glow, no vignette, no frame, no text, no
labels, no logos, no hands, no person wearing it.
```

## Notes

- If the generator cannot return transparency, ask for a flat pure white background and cut it out before converting;
  `--trim` removes empty edges (TK-222).
- A level/quality variant can reuse the prompt with "newer, clean rubber, intact canister" (high quality) or "cracked
  eyepiece, torn strap" (low quality).
