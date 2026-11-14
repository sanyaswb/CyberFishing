# Vodka v1 (spec 179)

Item art for the vodka bottle (consumable, softens the emission's darkening and blur). Target: 1024 × 1024 PNG with real
transparent alpha, converted afterwards with `utils/convert-images.js batch --masters` (WebP + `--low`, master to
`asset-sources/items/`). Style matches the location art and the existing item art.

## Prompt

```text
Use case: game inventory item icon, single isolated object.
Subject: a half-litre clear glass vodka bottle of an old Eastern European shape: tall straight body, short narrow neck,
an aluminium tear-off cap slightly bent. The liquid inside is clear and fills about three quarters of the bottle, with a
faint cold highlight. A plain paper label, yellowed and partly peeled at one corner, with abstract simple stripes and an
emblem shape only (no readable letters or words). Small water droplets and a smudge of dirt on the glass, a thin crack in
the label paper.
Style: 2D hand-drawn video game item art, graphic novel aesthetic, clean dark ink line art with consistent outline
weight, smooth layered cel-shading in 3-4 tones, 5/10 detail density, muted desaturated palette (pale glass green, off-white
label, dull aluminium), soft top-left key light, glass rendered with simple cel highlights, not photorealistic.
Composition: upright bottle, slight three-quarter view, centred, about 85% of the canvas height, nothing cropped. Square
1:1 canvas, 1024 x 1024.
Background: real transparent alpha background (transparent also behind and through the glass where the background shows).
No table, no cast shadow, no glow, no glasses or shot cups, no hands, no text, no readable label lettering, no brand, no logo.
```

## Notes

- If the generator cannot return transparency, ask for a flat pure white background and cut it out before converting;
  keep the glass semi-transparent only if the cut-out keeps it clean, otherwise opaque glass is fine for an icon.
