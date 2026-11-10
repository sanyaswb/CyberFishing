LOCATION PIPELINE SPECIFICATION & PROMPT TEMPLATE
Project: Cyber Fishing

Target Engine: Nanobana 2.1 / Generative 2D Background Pipeline

Standard Aspect Ratio: 16:9 Widescreen Landscape (--ar 16:9)

Reference Prompts & Examples: [test/prompts.md](test/prompts.md)

1. MASTER PRODUCTION RULES (LOCATION GUIDELINES)
   All location assets in this project must be generated according to the following strict architectural rules:

Aspect Ratio & Framing:

Every background asset must be generated in native 16:9 aspect ratio.

Perspective must remain a low-angle 2D side-view directly at water level, without vertical pitch or lens distortion.

Clean Layer Separation (Strict Zero-VFX Rule):

The master background generation must contain zero dynamic particle or weather effects.

Strictly Excluded: Fog, low-hanging mist, steam, chimney smoke plumes, chemical fumes, rain, water droplets, and toxic swirling circles/rings in the water.

All atmospheric effects, ripples, and toxic hazards are handled as independent programmatic sprites and dynamic particle layers inside the game engine.

Water Surface Integrity (No Cross-Section):

The water must strictly be depicted as a horizontal perspective surface seen from above the waterline.

Absolutely no aquarium profile views, no cross-sections, no underwater cutaways, and no subterranean slices.

The water begins flush at the bottom edge of the frame without any foreground concrete rims, railings, or catwalks. Depth is conveyed purely through surface reflection and perspective compression of ripples.

Modular Architecture & Time-of-Day Decoupling:

Physical structural geometry (columns, retaining walls, machines, ceiling beams, cooling towers) is completely time-agnostic.

Time-of-day changes must never rewrite the geometry blocks. They exist exclusively as a swappable Lighting, Atmosphere & Sky block that controls:

Sky gradient / cloud cover

Dome activation state (invisible, powering on, fully illuminated)

Direct and rim lighting on concrete and metal structures

Specular reflections and light paths across the water ripples

Ambient occlusion and cast shadows

Art Style Baseline (Cyber Fishing Standard):

Style: 2D hand-drawn video game background art, clean graphic novel line art, and layered cel-shading.

Detail Density: Fixed at 5/10 (balanced readability for game UI, rod mechanics, and floating inventory overlays; clean silhouette hierarchy with zero micro-texture visual noise).

Prohibitions: No 3D CGI plastic sheen, no photorealism, and no lens flares.

2. CAMERA PANNING & CONTINUITY EXTENSION RULES
   When generating camera shifts (e.g., 30% Pan Left, Center Default, 30% Pan Right), the world coordinates are locked. Shifting the frame must never morph existing geometry or regenerate cropped elements at the new center.

World-Locked Spatial Logic:

Objects that move off-camera must be cleanly cropped by the frame border.

Newly revealed canvas space must logically continue the established architectural environment.

The relative distance between key anchors (columns, retaining walls, distant towers) must remain mathematically consistent.

Pan 30% Left:

Left Wing Expansion: Reveals the flooded western wing of the facility—exposed twisted I-beams, a suspended ruined metal catwalk, a rusted access ladder descending into the water, and remnants of an overhead gantry crane.

Shifted Anchors: The center-left column moves into the right third of the frame.

Cropped Out: The right-side machinery cluster (tanks, piping, crane) is completely pushed outside the right frame edge.

Background: The Dome and cooling towers shift into the right half of the horizon; the left horizon exposes an expanded wasteland of drowned factory hulls.

Center (Default Baseline):

Balanced View: Exactly two (2) heavy vertical pillars (one center-left, one far-right).

Midground: Full horizontal retaining barrier; clustered industrial machinery on the right.

Background: Dome and two cooling towers positioned in the center-left horizon.

Pan 30% Right:

Right Wing Expansion: Fully exposes the industrial processing cluster—extended battery of rusted storage tanks, manifold piping, pump house ruins, and a collapsed heavy crane gantry.

Shifted Anchors: The center-left column shifts to the far-left border; the right column moves toward the center-left.

Cropped Out: The open gap and broken catwalks on the far left are pushed outside the left frame edge.

Background: The Dome shifts toward the far-left horizon, partially occluded by industrial cranes and midground pillars.

3. PRODUCTION PROMPTS REFERENCE
   Ready-to-use prompt templates and concrete examples implementing these rules across different times of day (Daytime Overcast, Clear Sunset / Twilight, Clear Deep Night) are located in:
   - [test/prompts.md](test/prompts.md) — Reference prompt definitions for location variants.

