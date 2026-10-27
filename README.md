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

## Rules for the copy

The page is linked from the Play listing, so it follows the same rules as the store text: describe what Cryo does to the system, never
promise results (no "boost", "more FPS", "cooler", "smoother"), say which features need Shizuku, and show no FPS numbers in any image
or demo.

*Cryo is not affiliated with any game publisher or with Shizuku. All trademarks belong to their owners.*
