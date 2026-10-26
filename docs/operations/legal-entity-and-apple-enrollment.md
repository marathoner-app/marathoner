# Legal entity and Apple organization enrollment

- **Status:** Approved direction; paid execution deferred under the internal-first policy
- **Decision date:** October 21, 2026
- **Sequencing update:** October 26, 2026;
  [internal-first resource sequencing](../internal-first-resource-sequencing.md)
- **Planning issue:** [#280](https://github.com/marathoner-app/marathoner/issues/280)
- **Execution issue:** [#281](https://github.com/marathoner-app/marathoner/issues/281)
- **App Attest rollout:** [#281](https://github.com/marathoner-app/marathoner/issues/281)
  then [#205](https://github.com/marathoner-app/marathoner/issues/205)
- **TestFlight dependency:** [#122](https://github.com/marathoner-app/marathoner/issues/122)

This record is an operating decision, not legal, tax, or trademark advice. It
keeps the repository honest about the chosen path, its cost, its external
dependencies, and the evidence that may safely be recorded in public.

## Decision

Marathoner will form a **California single-member limited liability company**
and enroll that legal entity in the Apple Developer Program as an organization.
The preferred filing name is **Marathoner Technologies LLC**. **Marathoner App
LLC** is the fallback if the preferred name is unavailable when the filing is
reviewed. The consumer product may continue to use **Marathoner** and
`marathonerapp.com`; the legal entity name does not determine the final product
trademark.

This is the proportional structure for the next 12 to 18 months because the
owner is in California, expects grassroots rather than institutional growth,
and wants the App Store seller to be the company instead of the owner's
personal legal name. A Delaware corporation would add a second jurisdiction,
California foreign qualification, and more administration without a current
financing requirement. Reconsider the structure before a priced institutional
financing, a meaningful equity grant program, or another event for which
investors or counsel recommend a corporation.

`Marathoner Technologies LLC` is preferred over `Marathoner App LLC` because it
can own more than one product and does not require an entity-name change if the
consumer brand changes. It still makes the relationship to Marathoner clear.

The direction is settled, but formation is not required merely because the
path is prepared. Continue ordinary web and Personal Team development first.
Activate the filing and organization-enrollment sequence when seller identity,
App Attest, or external distribution is within the next four to six weeks of
becoming the real blocker and the owner approves the exact current cost.

## Preliminary name and trademark screen

The following screen was completed on October 21, 2026. It is evidence for the
planning decision, not a promise that the name is available or registrable.

| Screen | Result | Interpretation |
| --- | --- | --- |
| [California bizfile business search](https://bizfileonline.sos.ca.gov/search/business) for `Marathoner Technologies` | No results | No obvious California entity-name collision appeared. Final availability is determined only when the Secretary of State reviews a filing. |
| California bizfile search for `Marathoner App` | No results | The fallback also had no obvious collision. |
| California bizfile keyword search for `Marathoner` | Three association names: one active nonprofit and two terminated entities | None used either proposed LLC name. The root word is already present in California records. |
| [USPTO federal trademark search](https://tmsearch.uspto.gov/search/search-information) for the `MARATHONER` wordmark | Six results; no live exact `MARATHONER` mark in software, SaaS, or training services was found. Live results included `TOGHU MARATHONER` for athletic-event services and `MARATHONER GOLD` for ovens. | No obvious exact federal blocker appeared, but similar marks, common-law use, state marks, and related goods still require a comprehensive clearance search. |
| General market screen | A recent [Devpost project named `Marathoner`](https://devpost.com/software/marathoner) describes a React/Vite/TypeScript running and walking application. | The consumer name is not unique in the software/running space even though the screen did not find an established commercial conflict. |

California checks proposed names only against like entity types and explicitly
does not clear trademarks, service marks, or fictitious business names. Its
[entity-name rules](https://www.sos.ca.gov/administration/regulations/current-regulations/business/business-entity-names)
also make the filing review—not a search result—the final availability
decision. The [name-reservation guidance](https://www.sos.ca.gov/business-programs/business-entities/name-reservations/)
explains the separation between entity names and trademark rights.

The consumer word **Marathoner** directly describes the intended user. That
creates a plausible weak-or-descriptive-mark risk and makes broad exclusivity
less certain; this is an inference, not a legal conclusion. The USPTO explains
that [stronger marks are easier to protect](https://www.uspto.gov/trademarks/basics/strong-trademarks)
and that a clearance search must consider
[likelihood of confusion](https://www.uspto.gov/trademarks/search/likelihood-confusion),
not only identical federal registrations.

Proceed with the entity path, while treating the consumer trademark as a
**yellow risk** rather than cleared. Before a trademark filing, substantial
paid acquisition, or a public launch whose name would be expensive to change,
either obtain a qualified trademark clearance or explicitly accept the risk
and preserve a rebrand path.

## Formation and enrollment sequence

Issue #281 owns execution in this order:

1. Repeat the California search immediately before filing. Use
   `Marathoner Technologies LLC` unless filing review rejects it; use
   `Marathoner App LLC` only as the approved fallback.
2. Choose the public business address and agent for service of process before
   filing. California filings are public; do not use a home address by accident.
3. File California Articles of Organization (LLC-1). The published filing fee
   is $70.
4. Sign a single-member operating agreement and record who owns the entity.
5. Inventory and assign or license the existing source code, domain, brand
   assets, and relevant service accounts to the entity with professional help
   where needed.
6. Obtain a free EIN from the IRS **after** the state entity exists.
7. File the initial California Statement of Information within 90 days. The
   published fee is $20; repeat it biennially while the LLC is active.
8. Calendar California tax and information-return obligations, including the
   current $800 annual tax and Form 568, with a California tax professional.
9. Open entity banking and bookkeeping before accepting revenue or mixing
   material company expenses with personal funds.
10. Recheck the current federal beneficial-ownership reporting rule. As of the
    decision date, FinCEN exempts U.S.-created entities, but this rule can change.
11. Request or verify a D-U-N-S Number using the legal name and address exactly
    as accepted by California. D-U-N-S registration is free.
12. Keep a functional public company website and a domain-based organization
    email ready for Apple's verification.
13. Enroll the LLC in the Apple Developer Program as an organization. Apple
    requires a legal entity, D-U-N-S Number, legal authority to bind it, public
    website, organization email, two-factor authentication, and the $99 annual
    membership fee. Apple displays the legal entity name as the seller.
14. After enrollment, enable App Attest for the explicit App ID, regenerate the
    development and distribution profiles, complete #205's beta signed-device
    proof and observation window, and resume #122's external TestFlight work.

Apple does not accept a DBA, trade name, or branch as the organization being
enrolled. Its [program-enrollment requirements](https://developer.apple.com/help/account/membership/program-enrollment/)
are why a real entity—not just a branded domain—is on the critical path.

## Cost and elapsed-time model

| Item | Current public amount | Planning treatment |
| --- | ---: | --- |
| California Articles of Organization | $70 once | Required to create the entity |
| California Statement of Information | $20 initially and biennially | Initial filing due within 90 days |
| California annual LLC tax | $800 per year | Applies even with no business; the temporary first-year exemption no longer applies to a 2026 formation |
| Apple Developer Program | $99 per year | Required for organization distribution and the capabilities used by the selected App Attest design |
| IRS EIN | $0 | Obtain only through the IRS after formation |
| D-U-N-S Number | $0 | Request through Apple's documented D&B path |

The minimum first-year public fixed cost is therefore **$989**, excluding an
optional registered-agent or address service, name reservation, legal advice,
tax preparation, bookkeeping, and payment-processing or banking costs. Confirm
fees again at the moment of filing.

California processing time is variable. After accepted formation, Apple says
a new D-U-N-S record can take up to five business days and then up to two more
business days to become available to Apple. Organization verification and any
follow-up add an unguaranteed wait. Keep **one to three calendar weeks after
accepted formation** as the planning allowance, not as a service promise, and
activate #281 early enough to absorb that wait once the internal-first spending
test passes.

The LLC and organization enrollment do not block ordinary web development or
all owner-only local iPhone work. They do block the intended organization
seller identity, a paid-team profile containing App Attest, and external
TestFlight distribution. Product work can proceed in parallel, but those gates
cannot be declared passed without the organization account.

## Public evidence and private records

Repository and issue evidence may record:

- chosen legal name, jurisdiction, formation date, and public entity status;
- completion dates and public reference URLs;
- D-U-N-S requested, synchronized, or verified as pass/fail without publishing
  supporting verification documents;
- Apple organization enrollment and capability/profile verification as
  pass/fail; and
- the operator role and the next action, without private account details.

Never put these in GitHub, pull requests, screenshots, command output, or public
evidence:

- EIN, Social Security number, identity documents, or tax forms;
- bank or card information;
- a private or home address that has not intentionally become public;
- Apple, D&B, IRS, or state credentials, recovery details, one-time codes, or
  two-factor-authentication material;
- signing certificates, private keys, provisioning profiles, or device
  identifiers; or
- private D-U-N-S verification documents.

California warns that filed names, addresses, and contact information become
public and may be republished by third parties. Make the address/agent decision
before the filing form is populated, not after submission.

## Professional checkpoints

- Decide the address and registered-agent approach before filing.
- Have a California tax professional confirm the first payment and filing
  calendar before its first deadline.
- Use qualified trademark counsel before trademark filing or material public
  marketing if keeping the Marathoner brand would become expensive to reverse.
- Revisit the entity structure if institutional financing, equity compensation,
  or a co-owner becomes concrete.

## Authoritative references

- [California LLC forms and fees](https://www.sos.ca.gov/business-programs/cannabizfile/cannabis-forms-and-fees/limited-liability-companies-llc-california)
- [California LLC-1 Articles of Organization](https://bpd.cdn.sos.ca.gov/llc/forms/llc-1.pdf)
- [California Franchise Tax Board LLC obligations](https://www.ftb.ca.gov/file/business/types/limited-liability-company/index.html)
- [California filing privacy FAQ](https://www.sos.ca.gov/business-programs/pi-faqs/)
- [IRS EIN guidance](https://www.irs.gov/businesses/small-businesses-self-employed/employer-id-numbers)
- [FinCEN beneficial-ownership information](https://www.fincen.gov/boi)
- [Apple organization enrollment](https://developer.apple.com/help/account/membership/program-enrollment/)
- [Apple D-U-N-S guidance](https://developer.apple.com/help/account/membership/D-U-N-S/)
- [Apple TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
