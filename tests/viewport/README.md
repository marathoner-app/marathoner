# Browser viewport tests

The Track fixture renders `ShoeTracker` with in-memory callbacks so the browser
test can exercise the complete interaction without Firebase, App Check, or a
development account. The landing fixture renders the signed-out production
shell directly and covers both phone (`390 × 844`) and desktop (`1440 × 900`)
layout plus the existing login dialog.

Install Chromium once after `npm install`:

```sh
npx playwright install chromium
```

Run the focused test with:

```sh
npm run test:viewport
```

The test checks for both document-level horizontal scrolling and individual
visible elements whose bounds leave the viewport. Its failure message names the
workflow stage and offending elements so a mobile regression can be found
without first reproducing it manually.
