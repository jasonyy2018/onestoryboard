# Part 2 · Seedance 2.0 image-to-video (native audio)

## Reference image (role: reference_image)

The input image is a 12-panel storyboard previz sheet for this shot. **Extract only**:
- Character appearance, makeup, costume, and body type
- Scene spatial layout, lighting direction, and color mood
- Composition framing and shot-size reference per panel

**Strictly forbidden**: filming the reference image itself (no "photo of paper", previz screenshot, production board frame, or grid watermark in the output).
Video content is entirely driven by the text script below — the reference image is a visual specification document, not a subject to be filmed.

## Visual style & quality

Photoreal cinematic rendering, ultra-realistic textures, IMAX quality, vertical portrait framing (9:16), dramatic emotionally-driven lighting, volumetric fog, realistic atmospheric scattering, shallow depth of field, high emotional tension visual language.

## Motion & camera sequence (15-second timeline, strictly enforced)

The row script below provides **timestamped segments** (00:00–00:03 / 00:03–00:06 / …), each corresponding to one camera action.
Execute them in strict order; Speed Ramp transitions must be smooth and beat-synchronized.

## Technical details (required)

- **Physics simulation**: realistic fire propagation, cloth dynamics in wind, smoke/ash particle flow, water ripples, real-time light/shadow.
- **Camera movement**: smooth cinematic push-pull, speed ramping (slow to fast), 35mm anamorphic, shallow depth of field.
- **Color grading**: derived from scene emotion — high contrast, gritty texture, desaturated palette.

## Native audio (required)

`generate_audio: true`. **Keep only**: sync dialogue, on-set ambience (wind/rain/crowd/room tone), and diegetic SFX (footsteps/impacts/object sounds). **Strictly forbid**: background music (BGM), cinematic score, stock music beds. Audio must be in sync with picture; do not produce silent footage unless the script explicitly demands silence.

## Subtitle ban (absolute)

The final video **must never contain any text** — including but not limited to: dialogue subtitles, title cards, scene headers, character name labels, timestamps, watermarks, or any written on-screen text. All information must be conveyed exclusively through audio (dialogue, ambience) and visual action. Text exists only in the storyboard reference image, never in the final video output.

## Negative prompts (strictly excluded)

cartoon, anime, 3D render, CGI, painting, blurry, low quality, modern objects, clean clothes, deformed hands, extra fingers, grid lines, nine-box overlay, board watermarks, reference UI, picture-in-picture artifacts, **subtitles**, **on-screen text**, **dialogue captions**, **title text**, **burned-in text**.

## Deliverable lock

In-world photoreal footage, continuous time/space; coverage must look like live on-set photography. **The output must never show storyboard grid lines, production board borders, reference image overlays, or any "photo of paper / screenshot" texture.** Every frame must be a real scene with real characters in motion.

---

## Primary row script (narrative/visual truth lives here)

{{ROW_SCRIPT}}
