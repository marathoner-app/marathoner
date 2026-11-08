# Landing-page interest list

- **Owner:** Kevin Tulloch
- **Provider:** Loops
- **Purpose:** Collect explicit consent for occasional Marathoner product and
  beta-access updates without creating a product account or access request.
- **Implementation issue:** [#683](https://github.com/marathoner-app/marathoner/issues/683)

## Boundary

The interest list is not part of Firebase Authentication, beta membership, or
training-data storage. The landing page sends only the submitted email address,
the fixed source `marathoner-public-landing`, and the public mailing-list ID to
the Loops Form endpoint. No Loops API key belongs in Vite, GitHub Pages, the
iPhone bundle, repository files, browser storage, or browser logs.

The form requires explicit consent for occasional product and beta-access
updates. It does not collect a name, phone number, health information, running
history, or a password. Loops owns the contact's subscription and suppression
state and provides the unsubscribe path used by future email.

## Provider configuration

1. Create the Marathoner Loops account with an owner-controlled operational
   identity.
2. Enter a physical mailing address the owner is comfortable showing in every
   marketing-email footer. Loops requires it for CAN-SPAM compliance; do not
   publish a private address accidentally.
3. Authenticate the selected Marathoner sending domain using the exact DNS
   records Loops supplies. Review the records against Cloudflare Email Routing
   and the planned Zoho mail setup before saving them; do not replace the
   existing inbound MX records unless the provider explicitly requires and the
   owner approves that cutover.
4. Create one public mailing list named `Marathoner product and beta updates`.
5. Create one public form for the landing page. Configure it to add contacts to
   that mailing list and copy its public Form endpoint.
6. Keep double opt-in disabled for the first small, explicitly consented list
   unless the owner deliberately chooses the extra confirmation step. The form
   itself records explicit consent, and every marketing email must retain the
   Loops unsubscribe path.
7. Create one Workflow limited to the public mailing list. Use a one-time
   `Contact added to list` trigger and a single immediate email node. Do not add
   follow-up messages in this issue.
8. Send a provider preview, then start the Workflow only after the subject and
   body below are approved.

## Initial email

**Subject:** `You're on the Marathoner list`

**Body:**

> Thanks for signing up for Marathoner.
>
> You'll be among the first to know when we're ready to invite more runners.
>
> Kevin and Joseph
> Marathoner

Use `Marathoner` as the visible sender name and
`support@marathonerapp.com` as Reply-To. Keep the provider-managed unsubscribe
and required sender footer enabled even though the authored body is plain text.

## Public build configuration

The provider Form endpoint and mailing-list ID are public identifiers, not
credentials. The GitHub Pages dogfood build reads:

```text
VITE_LOOPS_FORM_ENDPOINT=https://app.loops.so/api/newsletter-form/<form-id>
VITE_LOOPS_INTEREST_LIST_ID=<public-mailing-list-id>
```

The component accepts only HTTPS Form endpoints hosted at
`app.loops.so/api/newsletter-form/`. When the endpoint is missing or malformed,
the page shows a non-interactive unavailable state rather than sending an email
address to an arbitrary host.

## Production proof

After the pull request is merged and GitHub Pages deploys:

1. Open `https://marathonerapp.com/` in a private browser session.
2. Follow **Get Marathoner updates** to the interest form.
3. Submit a personal inbox address after selecting the consent checkbox.
4. Confirm the page announces that the address is on the list.
5. Confirm exactly one Loops contact exists in the intended mailing list with
   the landing-page source.
6. Confirm the initial email arrives and inspect the visible From, Reply-To,
   subject, body, sender footer, and unsubscribe link.
7. Inspect the message headers for SPF, DKIM, and DMARC pass results.
8. Submit the same address again after the provider's one-minute form throttle
   window. Confirm the page treats the existing contact calmly and the Workflow
   does not send an uncontrolled duplicate welcome sequence.
9. Use the unsubscribe link and confirm the preference is reflected in Loops.

Record the date and result in issue #683. Do not paste the personal test email,
provider API credentials, DNS verification tokens, or complete message headers
into the public issue.
