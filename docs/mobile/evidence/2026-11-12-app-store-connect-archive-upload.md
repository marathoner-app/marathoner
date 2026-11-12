# 2026-11-12 App Store Connect archive and upload

- **Tracking issue:** [#702](https://github.com/marathoner-app/marathoner/issues/702)
- **Parent TestFlight issue:** [#122](https://github.com/marathoner-app/marathoner/issues/122)
- **Outcome:** The App Store Connect record exists and Marathoner 1.0 build 2
  archived, exported, and uploaded successfully. Apple reports the uploaded
  package as processing. TestFlight review, tester access, and a non-owner
  journey remain open.

## Boundary exercised

The record uses the App Store name `Marathoner: First Marathon` and the
canonical iOS bundle identifier. The installed app name remains `Marathoner`.
The archive was created from the beta environment after the development and
beta iOS boundary checks passed in sequence.

The Apple team selection, beta Firebase configuration, signing material, and
build outputs remained local and ignored. No Apple credentials, certificate
fingerprints, provisioning-profile identifiers, device identifiers, Firebase
credentials, or App Check tokens were retained in the repository or this
evidence record.

## Results

1. App Store Connect accepted the new iOS app record.
2. The first archive attempt reached Apple validation but was rejected because
   a HealthKit-enabled app also requires `NSHealthUpdateUsageDescription`.
3. The tracked privacy declaration now states that Marathoner does not write
   Health data and only reads completed workouts the runner chooses to share.
4. The iOS boundary policy now rejects a project missing either HealthKit
   privacy-purpose key, with a focused regression test for the update key.
5. The corrected candidate advanced to version 1.0 build 2.
6. `npm run check:ios` and `npm run check:ios:beta` passed, with the beta bundle
   selected last for the archive.
7. Xcode created and exported a Release archive for App Store Connect.
8. The exported IPA contained both HealthKit privacy strings, production App
   Attest, HealthKit, HealthKit background delivery, TestFlight reporting, and
   no debug entitlement.
9. Apple completed the upload and reported that the package is processing.
10. `npm run lint`, `npm test`, and `npm run build` passed.

After the successful upload result, Xcode also reported that an account
credential used for an additional validation request had expired and skipped
that non-upload validation. The package transfer still ended with `Upload
succeeded` and `Uploaded package is processing`. Re-authenticate Xcode before
the next archive workflow if the warning recurs.

## Remaining boundary

Upload acceptance is not TestFlight availability. Apple must finish processing
build 2 before it can be selected for testing. This evidence does not claim
export-compliance completion, beta App Review approval, tester invitation,
installation from TestFlight, or a non-owner end-to-end journey.

Issue #122 remains open for those distribution and human-journey gates. The
repository change that records this proof does not submit the build for review
or grant tester access.
