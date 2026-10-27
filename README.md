# Cryo — official website (`sangbodoi2007.github.io`)

Landing page, privacy policy and `app-ads.txt` for **Cryo: Game Mode & FPS Meter** (`com.astvn.cryo`) by ASTVN Studios.

- Website: https://sangbodoi2007.github.io
- Google Play: https://play.google.com/store/apps/details?id=com.astvn.cryo
- Privacy policy: https://sangbodoi2007.github.io/privacy
- Authorized sellers: https://sangbodoi2007.github.io/app-ads.txt

## What is in this repo

| Path | What it is |
| --- | --- |
| `index.html` | The landing page, Vietnamese and English side by side (`lang` on `<html>` picks which one shows). |
| `assets/site.css`, `assets/site.js` | Styles and behaviour of the landing page. No build step, no framework; Lenis is the only script loaded from a CDN. |
| `assets/fx.js` | The expressive layer: inverted cursor, variable-font type, 3D shapes, scroll ticker, wavy progress. Pure decoration — the page reads fine without it. |
| `privacy.html`, `assets/cryo.css`, `assets/cryo.js` | Privacy policy page and its own styles. Linked from the Play Console, so its URL must keep working. |
| `app-ads.txt`, `.nojekyll` | Ad-seller declaration and the flag that makes GitHub Pages serve files as they are. Do not edit by hand. |

## How the landing page is built

- **Colors** are Cryo's own Material 3 dark scheme, generated with `@material/material-color-utilities` (`SchemeTonalSpot`) from the
  same seed that produced the app screenshots (`#34437A`). The color picker swaps in four more schemes made the same way, the way the
  app follows the phone's wallpaper.
- **Motion** uses the spring constants from the app's `ui/theme/Motion.kt` (spatial 0.6/420, quick 0.45/1400, effects 1.0/1600,
  sheet 0.72/300): a small spring solver in `site.js` for interactive parts, and the same springs sampled into CSS `linear()` easings
  for hover and press states.
- **App panels** on the page are the real Cryo screens rebuilt in HTML/CSS, not screenshots, so they can be dragged, toggled and
  re-themed. The game shown is Polar Run, a demo game made by ASTVN Studios for this purpose.
- **Type** is Google Sans Flex (with its roundness axis) and Material Symbols Rounded, both from Google Fonts.
- **M3 Expressive details**: page-level components use the official expressive springs (fast spatial 0.6/800, default 0.8/380,
  slow 0.8/200; effects 1.0/3800 · 1600 · 800). The resolution slider, the wavy RAM ring and Shizuku progress line, the connected
  button groups, the switch with its check icon and the shape-morphing loading indicator follow the M3 Expressive component specs.
- **Expressive layer (`fx.js`)**: on a mouse, the cursor is an inverted (`mix-blend-mode: difference`) dot that turns into the
  exact pill of transparent buttons and links; around colour-filled buttons and images (logo, the Google Play badge, which
  must not be recoloured) it becomes a ring that hugs the button's live shape; leaving a button it shrinks back without
  rotating; it becomes a lens over big headings; headings bloom from
  thin/condensed to their weight and swell with the `wght`/`wdth` axes near the cursor; the hero, the light "paper" section and
  the finale carry clay-like 3D M3 shapes drawn on canvas in the current color scheme. With reduced motion or on touch, the
  cursor and swelling are off and every word is visible.
- **Cost rules** (measured with Chrome traces against the previous version): nothing runs while the page is idle (Lenis only ticks
  while scrolling, the ticker drifts on a compositor animation, shapes morph at most ~30 times a second and only on screen);
  never read `scrollY` or layout inside a write pass (use `view.y` from `site.js`); variable-font axes are rounded to steps so
  font instances are reused; locked heading lines are layout roots (`contain: size layout`) with their measured width and height.

## Rules for the copy

The page is linked from the Play listing, so it follows the same rules as the store text: describe what Cryo does to the system, never
promise results (no "boost", "more FPS", "cooler", "smoother"), say which features need Shizuku, and show no FPS numbers in any image
or demo.

*Cryo is not affiliated with any game publisher or with Shizuku. All trademarks belong to their owners.*
