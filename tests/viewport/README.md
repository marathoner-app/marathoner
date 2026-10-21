# Track viewport test

This fixture renders `ShoeTracker` with in-memory callbacks so the browser test
can exercise the complete Track interaction without Firebase, App Check, or a
development account. It intentionally tests one representative phone viewport
(`390 × 844`) rather than starting a broad end-to-end suite.

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
