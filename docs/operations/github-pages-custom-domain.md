# GitHub Pages custom-domain runbook

- **Status:** Cutover in progress; organization verification, authoritative
  DNS, and development Firebase allowlists complete; repository deployment,
  certificate, HTTPS enforcement, and custom-domain smoke test pending
- **Cutover date:** October 21, 2026
- **Owner:** Kevin Tulloch
- **Tracking issue:**
  [#162](https://github.com/marathoner-app/marathoner/issues/162)
- **Canonical origin:** `https://marathonerapp.com/`

## Supported topology

GitHub Pages remains the web host. `marathonerapp.com` is the only canonical
application origin, and `www.marathonerapp.com` must resolve through GitHub
Pages and redirect to the apex. The legacy project URL,
`https://marathoner-app.github.io/marathoner/`, is a GitHub-managed redirect
while the repository custom domain is active, not a separately supported copy.

The GitHub organization owns a verified-domain record for
`marathonerapp.com`. Keep its `_github-pages-challenge-marathoner-app` TXT
record in DNS after verification; removing it weakens the domain-takeover
control for every Pages repository in the organization.

Cloudflare is authoritative for DNS. Keep these GitHub-documented web records
as **DNS only** while GitHub provisions and renews the Pages certificate:

| Host | Type | Value |
| --- | --- | --- |
| `@` | `A` | `185.199.108.153` |
| `@` | `A` | `185.199.109.153` |
| `@` | `A` | `185.199.110.153` |
| `@` | `A` | `185.199.111.153` |
| `www` | `CNAME` | `marathoner-app.github.io` |

Do not add a wildcard record. Do not remove or replace the existing MX, SPF,
DKIM, Google verification, or email-routing records during a web cutover.

## Application and Firebase boundary

The Pages workflow deliberately selects the `development` Firebase environment
until a separate beta-activation change is approved. On October 21, 2026,
`marathonerapp.com` and `www.marathonerapp.com` were added to all three
development-web controls and the saved settings were reopened to verify them:

1. Firebase Authentication authorized domains;
2. the development browser API key's website restrictions, using
   `https://marathonerapp.com/*` and `https://www.marathonerapp.com/*`; and
3. the development reCAPTCHA Enterprise/App Check web-key domain allowlist,
   alongside the retained `marathoner-app.github.io` entry.

The existing Pages application continued to initialize, authenticate, and read
its owner-scoped Firestore data after the browser-key change. That protects the
current origin from a cutover regression, but it is not evidence for the custom
domain until the root-path build is deployed there.

The beta browser and App Check keys already name the two custom-domain hosts,
but the beta project remains an explicit non-default environment. Domain
publication does not activate beta or migrate accounts or data.

Firebase password-reset emails currently use the project's default hosted
action handler because `requestPasswordReset` supplies no custom action URL.
The application support path remains `kevin@marathonerapp.com`; it does not
depend on the Pages hostname.

## Deployment verification

After the root-path change reaches `main` and the Pages workflow succeeds:

1. confirm public DNS returns all four apex A records and the `www` CNAME;
2. wait until GitHub reports the custom domain healthy, then enable and confirm
   HTTPS enforcement;
3. load the apex in a fresh browser and confirm HTML, JavaScript, CSS, images,
   and icons return successfully without `/marathoner/` asset paths;
4. load `www` and the legacy GitHub Pages URL and confirm both converge on the
   apex rather than exposing divergent content;
5. sign in with an existing development account, load an owner-scoped
   Firestore view, sign out, and confirm the signed-out state survives refresh;
6. request a password-reset message for a controlled account and confirm the
   hosted action link is valid without publishing its token; and
7. record pass/fail evidence in issue #162 without credentials, tokens,
   participant data, or unredacted console screenshots.

The current application has no URL-based client router. A root refresh is the
relevant navigation test; add nested-route refresh coverage when routing is
introduced.

## Recovery

Prefer a forward fix for application defects while DNS and the verified-domain
record remain stable. If the custom domain itself must be removed:

1. stop and record the reason in issue #162 or an incident issue;
2. restore the Vite web base to `/marathoner/` in a reviewed pull request and
   wait for its Pages deployment;
3. remove the repository's Pages custom-domain setting so the GitHub project
   URL becomes primary again;
4. only after the project URL is healthy, remove the apex A and `www` CNAME web
   records;
5. retain the GitHub organization verification TXT and all mail-related DNS;
6. update Firebase website restrictions and authorized domains only after the
   active origin is confirmed; and
7. reverse these steps, beginning with organization verification, for a later
   retry.

Do not point DNS at a placeholder, leave two live copies, or weaken Firebase
restrictions as a recovery shortcut.
