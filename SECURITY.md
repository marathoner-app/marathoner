# Security policy

## Project status

Marathoner is a foundation-stage private prototype, not a production coaching
service. There is no security-supported public release or open beta. Reports
about the current `main` branch, the deployed GitHub Pages prototype, Firebase
access boundaries, or repository automation are still welcome.

Creator Radar is excluded from this repository and security policy. Report an
issue in that system through its own private owner channel.

## Report a vulnerability privately

Do not open a public GitHub issue for a suspected vulnerability.

Email [`kevin@marathonerapp.com`](mailto:kevin@marathonerapp.com?subject=Marathoner%20security%20report)
with the subject **Marathoner security report**. Kevin Tulloch is the current
security owner.

Include only what is necessary to understand the report:

- the affected surface or file;
- the observed and expected behavior;
- minimal reproduction steps;
- likely impact; and
- a safe way to contact you for follow-up.

Do not send passwords, API keys, authentication tokens, private keys,
participant identities, health information, raw training records, or unrelated
personal data. Begin with a minimal description if sensitive evidence may be
needed so a safer exchange can be agreed first.

The owner will acknowledge the report when it has been received, assess its
scope and severity, and coordinate remediation and disclosure. Marathoner does
not currently operate a bug-bounty program and cannot promise compensation or
a fixed resolution time.

## Safe research boundaries

Please use local fixtures, tests, and emulators whenever possible. Do not:

- access, modify, delete, or retain another person's account or data;
- attempt denial of service, spam, social engineering, credential stuffing, or
  persistence;
- run automated scanning against the deployed application or Firebase project;
- create accounts or bypass the closed-registration posture;
- exfiltrate secrets or prove impact beyond the minimum safe evidence; or
- disrupt GitHub Actions, Pages, Cloudflare, Firebase, or another provider.

If you encounter participant or credential data unexpectedly, stop, preserve
the minimum evidence without copying the data, and report the exposure
privately.

## Public security work

Non-sensitive hardening, dependency maintenance, and defense-in-depth proposals
may use a normal public issue. When a report could reveal an exploitable path,
private reporting takes precedence until the owner confirms that public
discussion is safe.

Security fixes follow the normal issue-linked pull-request checks where public
details are safe. Critical incidents may require containment before a complete
public explanation; the repository must receive an appropriately redacted
record afterward. The full beta incident, participant-communication, deletion,
backup, and recovery procedures remain tracked in
[#124](https://github.com/marathoner-app/marathoner/issues/124).
