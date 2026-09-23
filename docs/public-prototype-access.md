# Public prototype access and trust posture

- **Status:** Open registration disabled; public support contact configured
- **Decision date:** September 22, 2026
- **Owner:** Kevin Tulloch
- **Decision issue:** [#123](https://github.com/marathoner-app/marathoner/issues/123)
- **Related controls:** [#78](https://github.com/marathoner-app/marathoner/issues/78),
  [#79](https://github.com/marathoner-app/marathoner/issues/79),
  [#87](https://github.com/marathoner-app/marathoner/issues/87), and
  [#124](https://github.com/marathoner-app/marathoner/issues/124)

## Decision

Marathoner disables public account creation until the bounded founding beta is
ready. The deployed application keeps login available only for existing
accounts and presents its readiness, limitations, data use, support,
withdrawal, and deletion-request information before a visitor can open the
login form.

There is no public waitlist, open beta, or self-service invitation path. The
future first invitation batch remains limited to five to eight allowlisted
adults who already run consistently and are preparing for a first marathon.

## Rationale

The current application is a foundation-stage prototype. Its methodology and
safety guidance are not approved, the allowlist and full privacy controls are
not implemented, and complete deletion operations have not been rehearsed.
Collecting additional accounts during that state would create privacy and
support obligations without providing the ratified beta experience.

Removing registration is a clearer and more reversible control than placing a
disclaimer beside an active signup form. It also avoids implying that public
access, qualified training guidance, or a production coaching service exists.

## Implemented containment

- The unauthenticated application does not render a signup action or collect a
  new account email or password.
- The production browser bundle no longer imports Firebase's account-creation
  operation through Marathoner's authentication service.
- Existing-account login remains available and is explicitly labeled as such.
- The public surface says that Marathoner is a private prototype, has no public
  waitlist, and has not received qualified methodology or safety approval.
- Privacy and data-use copy describes the current Firebase Authentication and
  training-record boundary and names integrations that are not present.
- Support, withdrawal, and deletion information appears before login.
- The public surface uses semantic headings, landmarks, labels, focus return,
  keyboard dismissal, visible focus treatment, and a single-column mobile
  layout.

## Current public data statement

Existing accounts use Firebase Authentication. Their email address and any
training records they enter are stored through Firebase services. The current
product does not import watch, GPS, payment, or health-platform data and does
not expose a social feed. A user must not enter another person's information.

This summary is truthful containment copy, not a replacement for the beta
privacy notice, consent record, retention policy, or complete data inventory
required by #78 and #79.

## Support, withdrawal, and deletion

The public support and deletion-request contact is
`kevin@marathonerapp.com`. It allows an existing account holder to ask for
support, withdraw from future research, or initiate deletion of the account and
its training records. Requests should come from the account email when possible
and must never contain passwords or unnecessary health or training details.

Privileged administrator and recovery identities are not public support
channels and must not be published through the application.

Initiation is not proof of complete deletion. Issue #124 must define and
rehearse identity verification, deletion across Authentication and every owned
data path, completion evidence, and the response service level.

## Security boundary

Removing the signup UI and client service contains ordinary public use; it is
not the beta authorization boundary. Firebase client configuration is public
by design, and someone can call an identity endpoint outside the shipped user
interface. Issue #87 must enforce allowlisted, verified-email access and data
writes before invitations. Firestore Security Rules, not hidden UI, protect
participant data.

## Reopening criteria

Self-service registration must not return for the founding beta. Invitation
access may begin only when:

- #119 provides dated qualified approval for the exact supported methodology;
- #87 enforces the allowlist and verified-email boundary;
- #78 and #79 provide usable privacy, consent, withdrawal, and deletion paths;
- #124 rehearses complete deletion and participant support operations;
- the invitation gate in the
  [committee remediation sprint](committee-remediation-sprint.md) passes; and
- production copy and actions match the actual invitation state.

Any later decision to enable public registration requires a new issue, an
updated privacy and support posture, and explicit approval; founding-beta
readiness does not authorize it automatically.
