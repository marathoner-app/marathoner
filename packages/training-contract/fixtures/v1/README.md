# Training contract fixtures v1

`training-contract.json` is the canonical, technology-neutral example set for
`training-domain@1`. Its values are JSON rather than TypeScript objects,
Firestore documents, or Firebase timestamps so another client can consume them
without adopting the web implementation.

## What conformance means

A client conforms to this fixture version when it:

1. rejects an unknown `fixtureFormatVersion`, `contractVersion`, or per-case
   `schemaVersion`;
2. evaluates every fixture with the validator for its `subject`;
3. produces the declared `expected.valid` result; and
4. adds or updates fixtures before intentionally changing a represented rule.

The checked-in JSON Schema describes the fixture envelope. It is not a complete
schema for Marathoner records; acceptance still comes from the client domain
constructors and validators. Fixture compatibility also does not prove
Firestore compatibility, ownership enforcement, migrations, or offline conflict
behavior. Those remain separate persistence and architecture gates.

## Coverage

The set includes valid records, invalid records, and boundary values for all
current identifiers, meter and second base units, calendar and UTC values,
runner profiles, plans, workouts, completed runs, and shoes. Values use
obviously synthetic identifiers and contain no email address, account identity,
or other personally identifying sample data.

The web conformance test uses the existing TypeScript domain constructors and
validators. The Expo spike independently evaluates the same raw JSON. A future
client in another language can copy the same pattern without translating the
fixture data.
