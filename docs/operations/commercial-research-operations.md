# Commercial research operations

- **Status:** Workspace active; synthetic withdrawal/deletion rehearsal passed;
  real-participant collection remains disabled
- **Decision date:** October 6, 2026
- **Owner:** Kevin Tulloch
- **Research-operations issue:**
  [#212](https://github.com/marathoner-app/marathoner/issues/212)
- **Commercial evidence epic:**
  [#126](https://github.com/marathoner-app/marathoner/issues/126)
- **Consent copy:**
  [Commercial research consent](templates/commercial-research-consent.md)

## Decision

The small commercial-proof study will use an organization-controlled Google
Workspace boundary for research operations and Stripe-hosted Payment Links for
any later reservation transaction.

Google Workspace will hold the participant identity register, consent
responses, scheduling records, raw notes, coded evidence ledger, and withdrawal
log. Stripe will be the source of truth for payment, refund, and card data.
Marathoner will not build payment handling into the app for this experiment or
copy card or bank details into Workspace.

The Google Workspace owner and operator is
`kevin-admin@marathonerapp.com`. The participant-facing support and withdrawal
address remains `kevin@marathonerapp.com`; the administrator identity is not a
participant support channel.

This is a proportionate system for 15–20 interviews and a maximum of five
initial concierge participants. It is not the assumed permanent research
platform. A larger team, a second study owner, regulated research, or materially
larger volume requires a new privacy and access review.

### Activation state

The October 6 account inspection first found that the Marathoner organization
had zero bytes of organization storage. The owner then activated Google
Workspace Business Starter, assigned its operator seat to
`kevin-admin@marathonerapp.com`, and confirmed a shared 30 GB Workspace storage
pool. The available personal Google account storage remains intentionally
rejected for participant operations.

The owner-only **Marathoner Restricted Research** root and all seven folders
below now exist. Drive reports the root, control record, and linked response
Sheet as private to the operator. The consent Form has owner-only editor access
and is published only to the Marathoner organization; it is not open to outside
participants. The October 6 synthetic rehearsal submitted one response and
then removed that response and every related record. A fresh empty linked Sheet
is now attached to the Form, which reports zero responses. The dated result is
recorded in the
[synthetic withdrawal rehearsal evidence](evidence/2026-10-06-commercial-research-withdrawal-rehearsal.md).
Until the remaining commercial-proof recruitment gates pass:

- no screener, consent form, or participant ledger may collect responses;
- no interview or recording may begin;
- no reservation link may be sent; and
- the real-participant activation state must remain closed.

## Selected private boundary

Create one top-level folder named **Marathoner Restricted Research** in the
licensed `kevin-admin@marathonerapp.com` My Drive. General access must remain
**Restricted**, no other account may have access, and editors must not be able
to change access. Business Starter is sufficient for the single-operator study;
the folder must move to an organization-owned shared drive before a second
operator receives access. Do not use a personal Drive, a public link, this
repository, an unencrypted local folder, or a participant-shared document as
the record store.

The restricted root contains these folders, which inherit its owner-only
access:

| Folder | Contents | Access rule |
| --- | --- | --- |
| `00 Control` | Protocol versions, access review, retention schedule, withdrawal register, and rehearsal evidence | Owner only |
| `01 Identity and contact` | Random research ID mapped to name, email, time zone, and recruitment status | Owner only; never copied into evidence notes |
| `02 Consent` | Published consent form, linked response sheet, and consent-version record | Form editor and Sheet owner only; responder access stays organization-only until recruitment is authorized |
| `03 Scheduling` | Scheduling ledger and session status; Google Calendar remains the event source of truth | Owner only |
| `04 Raw notes` | One file per research ID with raw task notes | Owner only |
| `05 Evidence ledger` | Coded, pseudonymous evidence used for the frozen rubric | Owner only |
| `06 Reservations` | Research ID, offer version, amount, state, dates, and Stripe object reference; no payment method data | Owner only |

Google Forms may collect consent into a linked Google Sheet inside `02
Consent`. The Form and linked Sheet are separate records: changing or deleting
one does not automatically change or delete the other. Both are included in
every access and deletion check.

Google Calendar and the participant-support mailbox remain Workspace records
outside the restricted root. Calendar descriptions and email subjects use the
random research ID once assigned and contain no training or health narrative.
This sprint does not record interviews. Introducing audio, video, automated
notes, or transcription requires a new reviewed protocol and consent version,
a Business Standard or suitable recording-system decision, a deletion
rehearsal, and an updated data inventory before the first recording.

Stripe activation, seller identity, terms, and the end-to-end refund proof are
owned by issue [#215](https://github.com/marathoner-app/marathoner/issues/215).
Issue #212 selects the boundary only; it does not open a Stripe account, accept
money, or prove the refund flow.

## Minimum collection

Assign a random ID in the form `CP01-P###`. Only the identity register maps it
to a person. Every note, evidence row, scheduling entry, and reservation ledger
row uses that ID.

Collect only what the frozen protocol requires:

- adult and United States eligibility confirmations, not date of birth,
  government ID, or proof of residence;
- name, email, broad time zone, and scheduling availability;
- broad race window, first-marathon status, plan status, and the participant's
  description of a disruption or workaround;
- responses to the fictional artifact tasks and commercial questions;
- consent version, decision, timestamp, and no-recording acknowledgment; and
- for a reservation, amount, status, dates, offer version, and the Stripe
  object reference needed to reconcile or refund it.

Do not request a home address, exact location, medical record, diagnosis,
medication list, device export, GPS history, race-registration proof, payment
card data, account password, or another person's information. A participant may
volunteer health or training context while describing a disruption; record only
the minimum meaning needed for the research question and omit unnecessary
clinical detail.

## Consent boundaries

Research, the no-recording boundary, a reservation, and a later live pilot are
four independent decisions:

1. Research consent is required before the interview or artifact task begins.
2. This sprint does not record. Every session uses facilitator notes and
   provides the same tasks, time, follow-up, and reservation eligibility.
3. A reservation is offered only under the versioned terms prepared by #215.
   Declining or refunding it does not remove the interview from the study.
4. A concierge or product pilot requires a new consent event. Research consent
   and a reservation do not authorize live training recommendations, account
   creation, or beta participation.

The exact participant-facing language is versioned in the
[consent template](templates/commercial-research-consent.md). A live Form must
display the version and effective date and preserve separate affirmative
choices. A bundled checkbox is invalid.

The frozen
[commercial interview protocol](commercial-interview-protocol.md) owns the
screener, question order, artifact tasks, classification rules, source tags,
observation windows, and public decision format. Completed notes and ledger
rows use its private templates but remain inside the restricted Workspace.

## Retention and deletion

The following limits apply from collection. Earlier deletion is required when
the information is no longer needed or the participant withdraws, except for a
financial record that must be retained.

| Record | Maximum retention | Deletion outcome |
| --- | --- | --- |
| Unqualified, declined, or unresponsive contact | 30 days after disposition | Permanently delete contact, screener response, email thread, and scheduling record |
| Identity mapping and contact details for a qualified participant | 90 days after the #218 decision, and never more than 12 months after collection | Permanently delete the mapping and contact records |
| Research consent evidence | 90 days after the #218 decision, and never more than 12 months after collection | Delete the individual Form response and linked Sheet row; retain only the protocol version and aggregate consent count |
| Calendar event and research email thread | 90 days after the #218 decision, and never more than 12 months after collection | Delete the event and thread, including trash |
| Raw notes | 90 days after the #218 decision, and never more than 12 months after collection | Permanently delete after coded evidence is checked |
| Pseudonymous evidence row | 90 days after the #218 decision, and never more than 12 months after collection | Delete the row after the public aggregate and decision are verified |
| Workspace withdrawal record | 30 days after completion | Permanently delete; the public repo may retain only the dated synthetic rehearsal and aggregate request count |
| Reservation operations row | Seven years after the transaction year unless qualified tax or legal advice approves a shorter period | Retain only research ID, offer, amount, state, dates, and processor reference; remove research notes and identity mapping |
| Stripe payment/refund record | Provider-controlled and subject to financial, tax, dispute, and legal obligations | Refund through Stripe when due; do not promise erasure of a record Marathoner is required or unable to delete |

The seven-year reservation rule is a conservative operating default, not legal
advice. Issue #215 must validate the seller's actual obligation and participant
terms before accepting money. Any approved shorter period replaces the default
in a reviewed change; an extension requires a reason and updated notice.

## Withdrawal procedure

A participant can stop a session immediately or email
`kevin@marathonerapp.com` with the subject **Withdraw from Marathoner
research**. Do not require a reason. Acknowledge the request within two business
days and complete the private research deletion within seven calendar days.

Using the exact research ID, the operator must:

1. mark recruitment, follow-up, and reservation outreach stopped;
2. delete the individual response in Google Forms and the separate linked
   Google Sheet row;
3. delete the identity row, scheduling row, raw note, and coded evidence row;
4. delete the matching Calendar event and research email thread, including
   their trash copies;
5. if a reservation exists, request the full refund, remove the link between
   research notes and the payment, and retain only the minimum financial record
   described above;
6. search the restricted drive, Calendar, and support mailbox by research ID
   and the participant email and require zero undeclared results; and
7. record only a random withdrawal case ID, request date, completion date,
   operator, system-by-system pass/fail, and any non-identifying exception.

Withdrawal removes the private row-level evidence. It does not reverse a
public, non-identifying aggregate already published, and it does not erase a
financial record that must be retained. The consent language states both
limits before participation.

## Public aggregation rule

The public repository may contain protocols, synthetic artifacts, aggregate
counts, coarse source categories, paraphrased themes, counterexamples, and the
final proceed/reposition/stop/redesign decision.

Before publishing:

- require at least five participants in any displayed subgroup; combine or
  suppress smaller cells rather than publishing a small exact count;
- never publish the internal research ID, a row-level dataset, a recording,
  screenshot, consent response, transaction reference, or raw note;
- use paraphrases, not verbatim participant quotations, during this sprint;
- remove exact race, location, employer, date, injury, and rare attribute
  combinations that could identify someone;
- report denominators, source mix, negative evidence, and missing data without
  reconstructing an individual; and
- have the owner complete a second pass specifically for re-identification
  risk before committing the result.

Anonymization is a judgment about reasonable identifiability, not a name-removal
operation. If a useful detail is also identifying, the public report suppresses
the detail.

## Access and incident response

- Use an organization-controlled account with multifactor authentication. Do
  not share credentials.
- Keep the research root's general access restricted and owner-only.
- Audit the root folder's access, Form collaborators, linked Sheet access, and
  Stripe roles before recruitment and before each evidence publication.
- Do not sync `04 Raw notes` to an unmanaged device.
- Do not paste participant material into AI tools, GitHub, issue comments, PRs,
  chat transcripts, or local test fixtures.

Suspected public exposure, unauthorized access, a lost privileged credential,
or participant data sent to the wrong person is a critical incident. Stop
recruitment, interviews, recording, and reservation requests; revoke access and
links; preserve non-content audit evidence; and assess notification obligations
before resuming. A confirmed or unresolved critical incident fails the
commercial gate regardless of reservation or interview counts.

## Synthetic rehearsal

The rehearsal must use an obviously fictional participant and no payment. It
must create and then remove:

1. one identity/contact row;
2. one consent response and its linked Sheet row;
3. one scheduling record and Calendar event;
4. one raw note and a check proving that no recording or transcript was
   created;
5. one coded evidence row; and
6. one public-summary candidate that is suppressed because its subgroup has
   fewer than five records.

Then submit a fictional withdrawal, execute the procedure above, and search
every declared system by research ID and any additional synthetic identifier
retained for verification. The research ID must return no undeclared result
everywhere; any retained synthetic email must also return no result in the
identity-bearing stores. Record the result in `docs/operations/evidence/`
without publishing the synthetic email or any private-system object ID. A
passing record includes date, owner, consent version, systems checked, start
and completion times, service-level result, every deletion check, and any
corrective issue.

The repository document is evidence of the rehearsal outcome, not a copy of
the private records. A paper walkthrough or temporary local folder does not
satisfy this gate.

## Activation checklist

- [x] One Business Starter license is assigned to the operator and Drive
      storage is active.
- [x] `Marathoner Restricted Research` exists in the operator's My Drive.
- [x] General access is Restricted and owner-only access is verified.
- [x] The folder structure above exists.
- [x] The consent Form uses the approved template, its editor access is
      owner-only, responder access is organization-only, and the linked Sheet
      is owner-only.
- [x] Calendar and mailbox records are included in the deletion search, and no
      recording or transcript exists.
- [x] The synthetic withdrawal/deletion rehearsal passes and its
      [public evidence record](evidence/2026-10-06-commercial-research-withdrawal-rehearsal.md)
      is linked here.
- [x] Real-participant response collection remains disabled; the Form is
      limited to the Marathoner organization and reports zero responses after
      the rehearsal.

## Platform references

- [Google Drive folder access and inheritance](https://support.google.com/drive/answer/7166529)
- [Google Drive restricted folder access](https://support.google.com/drive/answer/7166529)
- [Google Workspace business editions](https://knowledge.workspace.google.com/admin/getting-started/editions/business-editions)
- [Google Forms response storage and independent deletion](https://support.google.com/docs/answer/2917686)
- [Google Drive deletion and 30-day trash behavior](https://support.google.com/drive/answer/14933051)
- [Stripe-hosted Payment Links](https://docs.stripe.com/payment-links)
- [Stripe refunds](https://docs.stripe.com/refunds)
