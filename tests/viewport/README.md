# Browser viewport tests

The Track fixture renders `ShoeTracker` with in-memory callbacks so the browser
test can exercise the complete interaction without Firebase, App Check, or a
development account. It runs that workflow at the default text size and at a
200% root text scale as an early large-text regression barrier. The Analyze
fixture renders deterministic completed-run feedback and verifies both the
summary cards and the weekly-distance chart's accessible data table at those
same phone settings. The landing
fixture renders the signed-out production shell directly and covers both phone
(`390 × 844`) and desktop (`1440 × 900`) layout plus the existing login dialog.
The signed-in home fixture verifies that account controls, welcome content,
runner setup, next workout, and section navigation remain in readable order on
the phone while preserving the desktop header treatment. The isolated
recommendation-review fixture verifies that the internal preview notice,
narrative sequence, and both decision actions remain visible and operable at
phone width and 200% text without connecting the dormant component to the
application or Firebase.

Install Chromium once after `npm install`:

```sh
npx playwright install chromium
```

Run the focused test with:

```sh
npm run test:viewport
```

The tests check for both document-level horizontal scrolling and individual
visible elements whose bounds leave the viewport. Failure messages name the
workflow stage and offending elements so a mobile regression can be found
without first reproducing it manually. Landing and Track checks also enforce a
`44 × 44` CSS-pixel minimum for the critical interactive targets they exercise.
The 200% browser check does not replace the physical-iPhone Dynamic Type and
VoiceOver verification tracked by issue `#140`.
