# Mobile architecture spike closeout

- **Issue:** [#88](https://github.com/marathoner-app/marathoner/issues/88)
- **Parent spike:** [#33](https://github.com/marathoner-app/marathoner/issues/33)
- **Decision owner:** [#83](https://github.com/marathoner-app/marathoner/issues/83)
- **Evidence date:** October 2, 2026
- **Recommendation:** **Revise and advance Capacitor**

## Executive conclusion

Marathoner should advance the Vite application inside a Capacitor iOS shell as
the founding-beta architecture. Keep Expo plus the Firebase JavaScript SDK as a
documented fallback in the evidence record and Git history rather than a
maintained second application. Do not build the Expo plus React Native Firebase
option unless a hard requirement emerges for native Firebase behavior that the
accepted online-only, memory-cache product contract cannot meet.

This is a recommendation to select an architecture, not a claim that the iOS
app is ready for beta. The evidence is strong enough for #83 to choose a stack,
repository boundary, and release path because both active candidates passed the
same physical-iPhone Auth and typed Firestore vertical. Capacitor achieved that
without creating a second presentation layer. The evidence is not strong enough
to claim TestFlight, accessibility, network-loss recovery, production mobile
configuration, App Check, or observability readiness. Those gates remain owned
and scheduled below.

The word **revise** is intentional:

1. Promote only the winning Capacitor boundary; do not migrate the repository
   into a speculative monorepo or continue three implementations.
2. Replace the spike's direct Firestore write with the already accepted
   server-confirmed material-command and live-read contracts before a training
   write reaches iOS.
3. Treat external distribution, accessibility, production environment
   selection, and failure-state testing as release gates, not inferred results.
4. Delete the temporary mobile key exception and proof-only Firestore path when
   #83 no longer needs the comparison environment.

Decision confidence is **medium for framework selection** and **low for
participant readiness**. Capacitor's native Apple App Check path is a material
unproven integration, described below. That is the honest boundary supported by
the tests.

## Evidence ledger

Every claim in this closeout traces to committed evidence rather than a planned
capability.

| Evidence | Result | Pull request and merge commit |
| --- | --- | --- |
| Isolated Capacitor and Expo JS scaffolds (#152) | Both candidates type-checked, bundled, and remained separated from normal web behavior. | [PR #154](https://github.com/marathoner-app/marathoner/pull/154), [`0c164bc`](https://github.com/marathoner-app/marathoner/commit/0c164bc25a636434d9a027d3a346bb5e03725f7c) |
| Portable training contract (#85) | Web and Expo consumed the same runtime-validated identifiers and canonical units. | [PR #155](https://github.com/marathoner-app/marathoner/pull/155), [`3737d53`](https://github.com/marathoner-app/marathoner/commit/3737d53222581a7fb669fc6ee2a2db57fd2ceed7) |
| Cross-client fixtures (#89) | Canonical JSON cases passed through web domain code and the Expo boundary. | [PR #156](https://github.com/marathoner-app/marathoner/pull/156), [`4157c67`](https://github.com/marathoner-app/marathoner/commit/4157c6710c1a15b530c29f7eb8e019eb94b77f58) |
| Expo dependency disposition (#153) | Runtime reachability was bounded for the disposable spike; production acceptance was explicitly withheld. | [PR #157](https://github.com/marathoner-app/marathoner/pull/157), [`5f776a0`](https://github.com/marathoner-app/marathoner/commit/5f776a04ccd443ce219423bbf44dc10d1f4a95c6) |
| Signed physical-device shells (#84) | Both candidates built, installed or bundled, launched, and rendered on the same iPhone. | [PR #172](https://github.com/marathoner-app/marathoner/pull/172), [`181ddc8`](https://github.com/marathoner-app/marathoner/commit/181ddc89839c6a8854a04f2e144bbe31d1e3938e) |
| Firebase Auth proof (#86) | Both candidates passed sign-in, force-quit restoration, logout, and durable signed-out state. | [PR #174](https://github.com/marathoner-app/marathoner/pull/174), [`8a30b2b`](https://github.com/marathoner-app/marathoner/commit/8a30b2ba7c7f60a00380d8b487d8cbcd25eef62e) |
| Shared Firestore proof (#87) | Both candidates completed iOS-to-web and web-to-iOS typed round trips, then deleted the deterministic proof record. | [PR #175](https://github.com/marathoner-app/marathoner/pull/175), [`e019d1c`](https://github.com/marathoner-app/marathoner/commit/e019d1cc7ad725474478cafc2202912183e8ffc7) |

The detailed device, Auth, shared-record, and dependency observations are in
[`device-evidence.md`](./device-evidence.md),
[`auth-evidence.md`](./auth-evidence.md),
[`shared-record-evidence.md`](./shared-record-evidence.md), and
[`dependency-audit.md`](./dependency-audit.md).

### Reproducible command surface

The proof commits passed the following repository-owned command families. The
candidate commands are intentionally explicit because neither mobile candidate
is part of the normal root install or pull-request workflow yet.

```sh
# Preserved web and shared contract
npm ci
npm run lint
npm test
npm run build
npm run test:firestore

# Capacitor candidate
npm --prefix spikes/mobile/capacitor ci
npm --prefix spikes/mobile/capacitor run typecheck
npm --prefix spikes/mobile/capacitor run build:web
npm --prefix spikes/mobile/capacitor test
npm --prefix spikes/mobile/capacitor run sync:ios

# Expo plus Firebase JS candidate, under supported Node 22
npm --prefix spikes/mobile/expo-js ci
npm --prefix spikes/mobile/expo-js run typecheck
npm --prefix spikes/mobile/expo-js test
npm --prefix spikes/mobile/expo-js run export:ios
```

The Auth and shared-record modes additionally require the ignored development
configuration described in the evidence documents. Never print or commit those
files.

## Confirmed behavior versus unknowns

| Area | Confirmed | Not confirmed and must not be implied |
| --- | --- | --- |
| Local iOS build | Capacitor completed an unsigned generic compile and a Personal Team signed physical-device build in Xcode. Expo completed an iOS export and a physical Expo Go bundle. | Neither candidate produced a distribution-signed archive from a clean checkout. |
| Physical device | Both rendered on an iPhone 15 running iOS 26.6.2 using Node 22.22.0 and Xcode 27.0. | No second device, non-owner device, older supported iOS version, iPad, or performance run was tested. |
| Simulator | The documented toolchains support simulator workflows. | No simulator launch is part of the recorded proof. Physical-device success must not be rewritten as simulator evidence. |
| Authentication | Email/Password loading, sign-in, persisted session, logout, and persisted logout passed for both candidates. | Account creation, password reset, verified-email enforcement, token expiry, revocation, account switching, and old-session callback isolation did not pass here. |
| Firestore | One exact owner-scoped typed development record completed both directions for both candidates; anonymous, cross-owner, malformed, and alternate-path emulator cases were denied. | Production training schemas, live listeners, material commands, beta data, concurrent conflicts, retries, timeouts, and participant-scale behavior were not tested. |
| Offline behavior | The proof used online direct Firestore calls. One Capacitor read was slow and eventually returned correctly without manual retry. | Airplane-mode launch/read/write, loss during a request, reconnect, cache provenance, timeout, ambiguous completion, and conflict handling were not deliberately exercised. |
| Training-data cache | The current web and spike Firestore clients do not configure a durable training-data cache. Auth persistence is separate and passed. | Process-memory inspection, operating-system snapshots, logout memory clearing, and native-cache disabling were not tested. |
| Environment boundary | Both mobile candidates fail closed without complete development configuration, reject the beta project, and used ignored local files. Normal web and beta configuration remained unchanged. | A representative distribution iOS build selecting `marathonerapp-beta` has not passed; #125 remains open. |
| Accessibility | The simple proof screens were visually usable for the owner. | VoiceOver, Dynamic Type, contrast, keyboard, reduced motion, touch targets, focus order, and a non-owner rehearsal were not tested. |
| External distribution | A local Personal Team signed Capacitor build installed on the owner's phone. | Apple Developer Program enrollment, App Store Connect record, distribution certificate, archive upload, TestFlight processing/review, and non-owner install were not tested. |
| Monitoring | Xcode and TestFlight-compatible crash paths are available in principle. | No production crash reporting, telemetry, alert ownership, privacy filtering, or support workflow was configured for either candidate. |
| Android | The shared contract and fixtures are JavaScript-runtime independent, and both frameworks advertise Android targets. | No Android project generation, package registration, signed build, runtime, persistence, App Check, accessibility, or store path was tested. |

## Candidate comparison

| Criterion | Capacitor plus Firebase JS | Expo plus Firebase JS | Expo plus React Native Firebase |
| --- | --- | --- | --- |
| Physical-iPhone vertical | Passed shell, Auth, and shared record. | Passed shell, Auth, and shared record. | Not built because no accepted requirement justified a third implementation. |
| UI reuse | Reused the responsive React proof UI and Firestore adapter inside the WebView. | Required a separate React Native presentation and adapter while sharing the portable contract. | Would retain Expo UI duplication and add native Firebase modules/configuration. |
| Auth detail | Required explicit IndexedDB-first WebView persistence with local-storage fallback. | Used React Native AsyncStorage persistence. | Unproven in this repository. |
| Local workflow | Uses the owner's installed Xcode and a normal native iOS project. | Expo Go worked only after account alignment and an authenticated tunnel; the LAN development path returned empty responses. | Would require a generated/development native client rather than Expo Go for native modules. |
| Distribution path | Standard Xcode archive and App Store Connect path; a third-party build service is optional. | EAS Build is the documented managed path, or the project can be generated and built through Xcode with more locally owned native operations. | Requires the Expo native-build path plus native Firebase configuration. |
| Dependency posture | No candidate-specific production advisory blocker was recorded. | Sixteen time-bounded audit entries remain acceptable only for the disposable spike; the Expo production choice is blocked by #153's conditions. | Inherits Expo build complexity and introduces another native SDK surface that was not audited here. |
| App Check and native telemetry | The JavaScript proof did not exercise Apple App Attest. A native bridge or custom provider would add a new audited dependency and must pass #161. | The JavaScript proof has the same native-attestation gap. | Native Firebase integrations directly expose Apple App Check and Crashlytics, but were not built or audited here. |
| Offline fit | Matches the accepted memory-only reads and server-confirmed material-write design without a second client model. | Can implement the same contract, but does not gain enough accepted beta capability to offset the demonstrated UI duplication. | Native persistence would have to be deliberately disabled for the founding-beta contract; its principal advantage is not currently required. |
| Android implication | The same wrapped web application can later add the official Capacitor Android target, but it still requires a separately proven Android project. | A React Native presentation can target Android, but platform behavior and signing remain unproven. | Strong native Firebase reach is possible, but no Marathoner requirement currently pays for its added boundary. |
| Exit cost | The web application remains canonical; the native shell can be replaced without moving product/domain ownership. | Shared contracts survive, but React Native screens and adapters become a second application to maintain or discard. | Highest exit cost of the three because presentation and native Firebase bindings both diverge. |

The comparison does not assert that a WebView is inherently better than React
Native. It concludes that the observed Marathoner requirement set does not yet
justify a second UI implementation. A future native-only capability can reopen
the ADR with evidence instead of being prepaid now.

## Local, distribution, and build-service path

### Shared Apple requirements

Local installation on the owner's phone does not prove external distribution.
The production path for either candidate still requires:

1. an owned Apple Developer Program membership and recovery path;
2. the final bundle identifier and an App Store Connect app record;
3. distribution signing credentials and a matching provisioning profile;
4. a clean archive/build linked to the reviewed source revision;
5. export-compliance and TestFlight test information; and
6. an uploaded build that Apple processes before internal or external testing.

Apple's current documentation says TestFlight starts with an App Store Connect
record and an uploaded build; external testers additionally require beta test
information and an initial TestFlight review. Issue
[#122](https://github.com/marathoner-app/marathoner/issues/122) owns proof of
that path and a non-owner journey.

### Recommended Capacitor path

Use the Mac and Xcode already proven by #84 for the first clean archive and
TestFlight submission. Capacitor produces a normal native iOS application, so
EAS is neither required nor recommended for the selected path. Keep automatic
signing or distribution credentials in the Apple account and local keychain;
do not commit a team identifier, certificate, provisioning profile, or App
Store Connect private key.

Automate native distribution only after the manual clean-checkout archive is
repeatable. The later automation options are a narrowly permissioned macOS CI
job, Xcode Cloud, or a mobile build service. Choosing one is an operations and
credential-custody decision, not a prerequisite for #83.

### Expo fallback path

The fallback would need a real development build and production profile rather
than treating Expo Go as release evidence. EAS Build requires an Expo account,
EAS CLI configuration, build profiles, environment configuration, an Apple
Developer Program account for store builds, and either EAS-managed or locally
supplied signing credentials. EAS uploads the source archive to its build
service, runs native generation when applicable, restores signing credentials,
and produces a binary for submission. That adds a vendor account, remote
credential and environment ownership, build-queue/credit policy, and an exit
procedure to Marathoner's operations surface.

No EAS project, `eas.json`, distribution credential, EAS build, or EAS Submit
run exists in this repository. The Expo login and tunnel used for #84 were
development transport only. EAS therefore remains a documented option, not a
confirmed result.

## Offline, cache, and conflict findings

The spike did not simulate network loss, and the proof's direct `setDoc` calls
must not be promoted into production. What it established is that both
candidates can reach the same typed Firebase boundary while online. The
production behavior is already decided in
[`training-data-synchronization.md`](../../docs/architecture/training-data-synchronization.md):

- participant training reads use an explicit memory-only cache;
- cached data is labeled stale until a server snapshot establishes freshness;
- material writes go through an online server command, not the client
  Firestore mutation queue;
- a failed or timed-out command is visibly not saved or outcome-unknown;
- reconnect refreshes committed state before a participant resubmits;
- command IDs, revision preconditions, and transactions prevent duplicates,
  stale replacement, and partial multi-record state; and
- logout detaches listeners, invalidates old callbacks, clears participant
  state, and ends Auth.

This contract removes the offline-persistence rationale for React Native
Firebase now. Durable offline mutation is expressly rejected for the founding
beta. Native attestation and native crash telemetry remain legitimate reasons
to reconsider a native Firebase boundary; they are not proven requirements or
implementations in this spike. If a future product decision requires durable
offline training data, that is an ADR reopen with privacy, conflict, migration,
and account-isolation evidence—not a silent SDK swap.

The physical network-loss proof belongs where the production behavior exists:
[#158](https://github.com/marathoner-app/marathoner/issues/158) owns the command
and ambiguous-response boundary,
[#159](https://github.com/marathoner-app/marathoner/issues/159) owns freshness,
memory caching, and stale-callback isolation, and
[#138](https://github.com/marathoner-app/marathoner/issues/138) exercises the
selected iOS loop online, offline, after expiry, and from a second client.

## Environment, keys, and secret handling

The comparison used only the legacy development project. Both candidates reject
incomplete configuration and the beta project. Firebase public client values
live in ignored local files; Apple and Expo credentials are neither required by
the normal web build nor committed.

The temporary `marathoner-ios-auth-spike` key is deliberately exceptional. It
currently permits only Cloud Firestore API, Identity Toolkit API, and Token
Service API, but it has no application restriction because the comparison
needed both a Capacitor WebView and React Native runtime. Its value remains
uncommitted, yet API restriction alone is not the intended production posture.

Under the accepted ADR's implementation sequence:

1. delete the temporary key and remove the proof-only development Firestore
   path and rule;
2. register the selected production bundle and environment boundary;
3. prove a representative iOS build selects development or beta intentionally
   and never by fallback;
4. document which Firebase client values are public configuration and which
   Apple, CI, App Store Connect, or service credentials are secrets; and
5. complete App Check before external beta through
   [#161](https://github.com/marathoner-app/marathoner/issues/161).

Issue [#125](https://github.com/marathoner-app/marathoner/issues/125) remains
open specifically because the beta project's iOS selection has not passed.

### App Check compatibility gap

Issue #161 requires the selected iOS app to present Apple-platform attestation
before external beta. Firebase's built-in providers are platform-specific:
App Attest or DeviceCheck for an Apple native SDK, and reCAPTCHA Enterprise for
the Web SDK. The JavaScript SDK also supports a custom provider, but that path
requires owned proof collection and a secure token-exchange service.

An actively maintained but unofficial Capacitor Firebase plugin advertises
Capacitor 8 support and native App Attest or DeviceCheck. Marathoner has not
installed, audited, built, or exercised it, and its own documentation states
that it is not affiliated with or endorsed by Google. The repository therefore
must not present App Check as a solved Capacitor capability.

The ADR may still select Capacitor because this integration is bounded and does
not justify duplicating the entire application in advance. It must name the
allowed approach—audited native plugin, a deliberately owned bridge/custom
provider, or a revised client SDK—and make physical-iPhone App Check evidence in
#161 a go/no-go gate. Failure to produce valid Apple attestation without an
unacceptable dependency or operations burden reopens #83 and may justify the
native Firebase option.

## CI cost and complexity

The current pull-request workflow runs four bounded Ubuntu jobs: lint, unit
tests, production build, and Firestore emulator tests. It does not install
either isolated candidate or compile iOS. That was appropriate for disposable
spikes but is not sufficient after a production mobile shell exists.

The least-cost credible progression is:

| Stage | Trigger | Expected runner/service | Purpose |
| --- | --- | --- | --- |
| Shared checks | Every pull request | Existing Ubuntu jobs | Root lint, tests, web build, contracts, fixtures, rules, and server boundaries. |
| Mobile JavaScript boundary | Changes to shared/mobile configuration or dependencies | One bounded Ubuntu job | Clean mobile install, type-check, unit tests, safe bundle, and Capacitor sync/config validation that does not require signing. |
| Native compile | Changes to the iOS shell, native dependencies, release configuration, or a scheduled rehearsal | macOS runner or controlled local Mac | Resolve SPM, compile the selected target, and catch Xcode drift. |
| Signed archive and TestFlight | Explicit release workflow only | Initially the owner's controlled Mac; later a reviewed macOS or Apple build service | Protect distribution credentials and make each uploaded artifact traceable to a reviewed commit. |

Do not run a signed iOS build on every documentation or server-only pull
request. macOS capacity is scarcer and, for private repositories, consumes
billed or allotted GitHub Actions usage. A path-filtered native job and explicit
release workflow contain that cost without weakening the JavaScript and contract
gates.

Capacitor therefore adds one native toolchain and release lane but keeps the
application tests and presentation in the existing root. Expo would add a
second install/test graph plus EAS account, quota/credit, credential, remote
environment, and service-availability considerations. Its current dependency
audit would also remain a release gate. Exact vendor prices and quotas are
operational values to verify when #122 configures the release path, not constants
to encode in the architecture.

## Recommended repository boundary

The accepted issue #83 ADR uses this minimal shape:

- keep the existing root Vite application, `src/` UI, domain, and services as
  the canonical product implementation;
- keep `packages/training-contract` limited to portable runtime schemas,
  identifiers, canonical units, and cross-client fixtures that have an actual
  second consumer;
- promote the Capacitor configuration and native iOS project out of
  `spikes/mobile/` into a production shell owned by the root application;
- place platform bootstrap, persistence selection, and native bridges behind
  small service adapters instead of forking feature components;
- keep Firebase, Capacitor, React, and platform types out of portable domain
  contracts;
- retain the spike evidence documents, but remove disposable candidate runtime
  code and proof-only cloud access after the ADR; and
- add Android only through [#90](https://github.com/marathoner-app/marathoner/issues/90)
  after the iOS boundary is stable. Do not create an Android release or claim
  parity from the shared JavaScript contract alone.

This is a root application with native shells, not a new multi-application
monorepo. If later evidence demands a React Native client, the portable contract
and fixtures are already the exit seam.

## Risk register and mitigations

| Priority | Risk or doubt | Implication | Required mitigation and owner |
| --- | --- | --- | --- |
| High | No clean distribution archive or TestFlight result exists. | Local Personal Team success cannot support a participant or prove App Store Connect acceptance. | #122 records ownership, clean build, external review, non-owner install, replacement, and rollback. |
| High | Deliberate network-loss, timeout, reconnect, and conflict behavior is unproven. | The current spike UI could hang or mislabel a queued/ambiguous write as saved if copied into production. | #158, #159, and #138 implement and physically exercise the accepted command/read contracts before mobile material writes ship. |
| High | Accessibility and representative failure states are untested. | Framework selection is possible, but daily-use and invitation readiness are not. | #140 verifies VoiceOver, Dynamic Type, focus, touch, keyboard, motion, offline, expiry, and non-owner behavior on the selected client. |
| High | The temporary development key has no application restriction. | The narrow API allowlist limits impact, but this is not an acceptable permanent client-key posture. | #83 cleanup deletes the comparison key; #125 proves selected environment configuration; #161 enforces App Check before external beta. |
| High | Native Apple App Check compatibility is unproven for the proposed Capacitor plus Firebase JS boundary. | A security gate could force a late SDK/plugin change or reopen the framework decision. | #83 names the allowed bridge/provider and reopen rule; #161 audits it and proves App Attest or the approved fallback on a physical iPhone before enforcement. |
| High if Expo is selected | Expo's time-bounded dependency acceptance expires October 18 and is not production approval. | Selecting Expo without clearing the gate would knowingly promote unresolved build-tool findings. | Re-run #153's audit and satisfy its upstream-or-rigorous-override gate before an Expo ADR can be approved. |
| Medium | Production crash monitoring and privacy-filtered telemetry are undefined. | Testers could experience failures without an owned diagnostic or response path. | #83 names the minimum monitoring boundary and #109 owns invitation-readiness operations; no sensitive record body may enter logs. |
| Medium | Capacitor exposed one named/default Firebase-app integration defect and one delayed read. | Web reuse lowers duplication but does not eliminate WebView-specific integration work. | Preserve a single selected Firebase-client bridge, add timeout/recovery states, and cover exact copied-bundle behavior in mobile checks. |
| Medium | Expo local LAN serving failed and required an authenticated tunnel. | The observed local workflow adds service/account dependence and was not repeatable over LAN. | If Expo becomes the fallback, require a development build and documented LAN/tunnel recovery before calling the workflow dependable. |
| Medium | Android is inferred, not proven. | “Shared core” cannot be presented as an Android delivery result to investors or users. | Hold Android under #82; #90 and #93 own project generation, signed runtime, registration, restrictions, and device evidence. |
| Low | No simulator evidence was recorded. | A contributor cannot yet rely on simulator instructions alone. | The selected shell's setup issue must record a clean simulator launch, while physical-device evidence remains the release authority. |

## Decision handoff

Issue #83 can now write the ADR without rerunning the comparison. It should:

1. select Capacitor plus Firebase JS for the founding beta;
2. record Expo plus Firebase JS as the tested fallback and React Native Firebase
   as rejected until a hard native requirement appears;
3. approve the minimal repository and adapter boundary above;
4. preserve the online-only material-command and memory-only training-cache
   contract;
5. record the unproven native App Check boundary, its allowed implementation
   path, and failure as an explicit ADR-reopen trigger;
6. choose the manual Xcode/App Store Connect path as the first distribution
   route, with automation deferred until a clean archive is repeatable;
7. name #125, #158, #159, #122, #137, #138, #140, and #161 as binding
   implementation or release gates; and
8. assign removal of the temporary key, rule, and disposable candidates.

After the ADR merges and the comparison infrastructure is removed, #33 can
close with the production Capacitor shell as the next implementation slice. A
closed architecture spike will then mean “the least-duplicated path was selected
from physical evidence,” not “the mobile beta is finished.”

## Primary external references

- [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Capacitor iOS documentation](https://capacitorjs.com/docs/ios)
- [Expo: create a build](https://docs.expo.dev/build/setup/)
- [Expo: iOS build process](https://docs.expo.dev/build-reference/ios-builds/)
- [Expo: Firebase guide](https://docs.expo.dev/guides/using-firebase/)
- [Firebase: App Check with reCAPTCHA Enterprise for web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
- [Firebase: custom App Check provider for web](https://firebase.google.com/docs/app-check/web/custom-provider)
- [Firebase: App Check with App Attest on Apple platforms](https://firebase.google.com/docs/app-check/ios/app-attest-provider)
- [Capacitor Firebase App Check plugin](https://github.com/capawesome-team/capacitor-firebase/tree/main/packages/app-check)
- [Apple Developer Program enrollment](https://developer.apple.com/help/account/membership/program-enrollment/)
- [Apple: TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
- [GitHub-hosted runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
