# Balance Scale

Kids' (K-2) balance scale game in plain HTML, CSS and JavaScript. Drag pictures (weight 1-6) onto the left or right pan. The beam tilts toward the heavier side and the dial shows the difference (green = right heavier, red = left heavier, max 10). Free play: no score, timer or goal. A **Reset** button puts everything back.

## Files

| File | Purpose |
|---|---|
| `index.html` | Stage markup: beam, pans, needle, reset button |
| `style.css` | Layout in stage pixels (1256 x 936), faded-tile style |
| `script.js` | `ITEMS` data array, state, drag/drop, tweening, stage scaling |
| `assets/images/background.jpg` | Frame, post and dial with all moving parts removed |
| `assets/images/beam.png`, `pan-left.png`, `pan-right.png`, `needle.png`, `pivot-cap.png` | Moving parts, cut from the client screenshot |
| `assets/images/tiles/` | Tray tiles (sticker + number badge), cut from the screenshot |
| `assets/images/items/` | Draggable pictures, trimmed copies of the client's `Assets/` PNGs |
| `tools/extract-art.py` | Script that cut the screenshot into the images above (needs pillow, numpy, opencv, scipy) |

## Change a weight

Edit `weight` in the `ITEMS` array in `script.js`. The number printed on the tray tile is part of its image, so change that image too.

## Tuning

Constants at the top of `script.js`: `DEG_PER_UNIT` (1.5), `MAX_TILT` (15), `DIAL_MAX_ANGLE` (80, measured on the dial art), `BEAM_MS`, `NEEDLE_MS`, `PIECE_SCALE`.

## Storyline 360

1. Insert > Web Object, choose this folder (`index.html` at its root).
2. Publish > Review 360 and open the link in a private window. Web Objects do not run in Storyline Preview.
3. Audio (a soft chime when the scale balances) starts after the first tap, as browsers require.

## Known limits

- The cut-out art comes from a screenshot, so it is only as sharp as that screenshot. Replace the images in `assets/images/` with the client's originals if they send them (keep file names and sizes).
- Several of the client's item PNGs are low-resolution.
