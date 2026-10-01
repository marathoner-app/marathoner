# Founding-beta Firebase project record

- **Status:** Provisioned; rules deployment and live fixture verification pending
- **Tracking issue:** [#168](https://github.com/marathoner-app/marathoner/issues/168)
- **Parent:** [#125](https://github.com/marathoner-app/marathoner/issues/125)

## Project boundary

The founding beta uses `marathonerapp-beta`. It is visibly distinct from the
`marathoner-d9bf9` development/prototype project and belongs to the
`marathonerapp.com` Google Cloud organization.

The dedicated privileged domain-administrator identity owns the beta project.
Its recovery factors are maintained outside the repository. The public support
identity at `kevin@marathonerapp.com` has no cloud-administration role. A
temporary organization-level Project Creator grant was used for provisioning,
verified against project-level ownership, and removed immediately afterward.

## Provisioned controls

The live console was verified on September 30, 2026:

| Control | Live setting |
| --- | --- |
| Billing | Spark plan; no billing account attached |
| Analytics and AI assistance | Google Analytics and Gemini disabled during project creation |
| Web registration | `Marathoner Beta Web`; Firebase Hosting not configured |
| Authentication | Email/Password enabled; Google and every other provider disabled |
| Firestore | Standard edition, default database, `nam5`, production-mode deny-all initialization |
| Browser-key APIs | Datastore, Firestore, Logging, App Check, Installations, Firebase Management, Identity Toolkit, and Token Service only |
| Browser-key websites | `https://marathonerapp.com/*` and `https://www.marathonerapp.com/*` only |

The public Firebase web identifiers are versioned in `src/firebaseConfig.ts`.
They are identifiers delivered to browser clients, not administrator
credentials. Service-account keys, private keys, CLI tokens, passwords,
recovery material, and App Check debug tokens remain prohibited from source.

## Deployment boundary

The repository default, local development, CI, GitHub Pages, and disconnected
mobile spikes remain pinned to development or emulators. Beta can initialize
only when a production build explicitly selects
`VITE_FIREBASE_ENVIRONMENT=beta`.

The beta browser key intentionally permits no localhost or GitHub Pages
referrer. It will remain unusable from those origins. The custom-domain
publication and Authentication authorized-domain changes remain owned by #162.

After this record and alias merge, deploy the already reviewed beta rules with
an explicit target:

```sh
npx firebase deploy --config firebase.beta.json --project marathonerapp-beta --only firestore
```

The predeploy guard must print that it verified the beta target before the CLI
uploads rules. If the selected project differs from the `beta` alias, deployment
must stop. Use only fictional fixture accounts and records for the subsequent
approved and denied live checks; do not enroll participants in this issue.

## Remaining activation gates

- Deploy `firestore.beta.rules` after the configuration PR merges.
- Prove one approved, verified fictional owner can read and write its permitted
  data while anonymous, unverified, unapproved, and cross-owner attempts fail.
- Complete App Check enforcement and rollback planning in #161.
- Publish the custom domain and authorized-domain configuration in #162.
- Complete participant-data integrity, deletion, incident, and support controls
  before invitations.
