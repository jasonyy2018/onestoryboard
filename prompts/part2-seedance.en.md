# Part 2 · Seedance 2.0 image-to-video (native audio)

## Reference image (role: reference_image)

Input: this row's 12-panel photoreal production sheet, passed as `reference_image`.
The reference image constrains visual style, composition direction, and character consistency — **NOT a first-frame lock**; video content is fully driven by the text script below.

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

## Negative prompts (strictly excluded)

cartoon, anime, 3D render, CGI, painting, blurry, low quality, modern objects, clean clothes, deformed hands, extra fingers, grid lines, nine-box overlay, board watermarks, reference UI, picture-in-picture artifacts.

## Deliverable lock

In-world photoreal footage, continuous time/space; coverage must look like live on-set photography — do not reproduce the reference sheet literally (avoid "photo of paper" or previz screenshot effect).

---

## Primary row script (narrative/visual truth lives here)

{{ROW_SCRIPT}}
