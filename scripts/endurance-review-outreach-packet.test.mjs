import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const packetDirectory = path.join(repositoryRoot, 'docs', 'methodology');

async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath));
}

async function readPacketManifest() {
  return JSON.parse(
    await readFile(
      path.join(packetDirectory, 'endurance-review-outreach-packet.json'),
      'utf8',
    ),
  );
}

async function readPacketDocument() {
  return readFile(
    path.join(packetDirectory, 'endurance-review-outreach-packet.md'),
    'utf8',
  );
}

async function readReviewerDocument(name) {
  return readFile(path.join(packetDirectory, name), 'utf8');
}

describe('endurance-methodology review outreach packet', () => {
  it('keeps the combined draft blocked until a final repository pin exists', async () => {
    const manifest = await readPacketManifest();
    const document = await readPacketDocument();

    expect(manifest).toEqual(
      expect.objectContaining({
        schemaVersion: 'endurance-review-outreach-packet@2',
        status: 'draft-awaiting-pin',
        reviewRole: 'EMR',
        protocolVersion: 'methodology-review@0.1.0',
        pinnedRepositoryCommit: null,
        bundles: [
          {
            name: 'beta-rules',
            version: 'beta-rules@0.1.0-draft',
            state: 'draft-not-approved-not-runtime-eligible',
          },
          {
            name: 'beta-adaptation',
            version: 'beta-adaptation@0.1.0-draft',
            state: 'draft-not-approved-not-runtime-eligible',
          },
        ],
      }),
    );
    expect(document).toContain('Repository commit: not assigned');
    expect(document).toContain('outreach remains blocked');
    expect(document).toContain('Not approved. Not training advice.');
  });

  it('fails if any pinned artifact changes without repinning its hash', async () => {
    const manifest = await readPacketManifest();

    for (const artifact of manifest.artifacts) {
      const digest = createHash('sha256')
        .update(await read(artifact.path))
        .digest('hex');
      expect(digest, artifact.path).toBe(artifact.sha256);
      expect(artifact.sha256, artifact.path).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('drafts all eleven endurance rows without claiming review submission', async () => {
    const manifest = await readPacketManifest();
    const document = await readPacketDocument();
    const expectedInventoryIds = [
      'ELIG-001',
      'ELIG-002',
      'FEAS-001',
      'PLAN-001',
      'PROG-001',
      'UNSUP-001',
      'UNSUP-002',
      'ADAPT-001',
      'ADAPT-002',
      'ADAPT-003',
      'ADAPT-004',
    ];

    expect(manifest.inventoryIds).toEqual(expectedInventoryIds);
    for (const inventoryId of expectedInventoryIds) {
      expect(document).toContain(`| \`${inventoryId}\` | \`[Blank]\``);
    }
    expect(document).not.toContain('| `SAFE-001` | `[Blank]`');
    expect(document).not.toContain('| `GUIDE-001` | `[Blank]`');
    expect(manifest.status).toBe('draft-awaiting-pin');
  });

  it('gives every reviewer fixed decision choices and evidence requirements', async () => {
    const manifest = await readPacketManifest();
    const document = await readPacketDocument();

    expect(manifest.rowDecisionOptions).toEqual([
      'Approve for non-draft finalization',
      'Conditional',
      'Reject',
      'Outside competence',
    ]);
    expect(manifest.overallDecisionOptions).toEqual([
      'Approve for non-draft finalization',
      'Conditional',
      'Reject',
      'Partially reviewed',
    ]);
    expect(document).toContain('The reviewer must answer every question');
    expect(document).toContain('dated, attributable confirmation');
    expect(document).toContain('compensation was for my time');
    expect(document).toContain('## Blank approval record');
    expect(document).toContain('methodology-approval-record@2026-10-08');
    expect(document).toContain('Do not pre-fill a decision');
  });

  it('records screening without claiming contact, engagement, or approval', async () => {
    const manifest = await readPacketManifest();
    const document = await readPacketDocument();

    expect(manifest.screening).toEqual({
      privateCandidateCount: 3,
      contactedCount: 0,
      acceptedScopeCount: 0,
      scheduledCount: 0,
      engagedCount: 0,
    });
    expect(document).toContain('| Contacted | 0 |');
    expect(document).toContain('| Engaged | 0 |');
    expect(document).toContain('| Decision evidence | 0 |');
    expect(document).toContain('No methodology is approved');
  });

  it('keeps technical integrity evidence out of the reviewer-facing experience', async () => {
    const document = await readPacketDocument();
    const invitation = await readReviewerDocument(
      'endurance-review-invitation.md',
    );
    const workbook = await readReviewerDocument(
      'endurance-reviewer-workbook.md',
    );
    const technicalTerms = [
      'SHA-256',
      'repository commit',
      'pinned commit',
      'inventory ID',
    ];

    expect(document).toContain('## Review delivery model');
    expect(document).toContain('The candidate need not interact with the repository');
    expect(invitation).toContain(
      'Would you be interested in taking a look at a short overview',
    );
    expect(invitation).toContain('https://marathonerapp.com');
    expect(workbook).toContain('## Intended runner');
    expect(workbook).toContain('## Proposed weekly plan');
    expect(workbook).toContain('## Reviewer information and overall conclusion');

    for (const term of technicalTerms) {
      expect(invitation).not.toContain(term);
      expect(workbook).not.toContain(term);
    }
  });

  it('keeps a candidate-ready combined workbook behind the outreach gate', async () => {
    const document = await readPacketDocument();
    const invitation = await readReviewerDocument(
      'endurance-review-invitation.md',
    );
    const workbook = await readReviewerDocument(
      'endurance-reviewer-workbook.md',
    );

    expect(document).toContain('**Outreach is blocked.**');
    expect(document).toContain('#435 merges the proposed reschedule');
    expect(invitation).toContain('Do not send this invitation yet.');
    expect(workbook).toContain('Draft for independent review');
    expect(workbook).toContain('not approved for participant use');
    expect(workbook).toContain('## Proposed adaptation rules');
    expect(workbook).toContain(
      'One hard run never rewrites the plan',
    );
    expect(workbook).toContain('Repeating an interrupted week');
  });

  it('keeps the reviewer workbook aligned with the exact proposed schedule', async () => {
    const workbook = await readReviewerDocument(
      'endurance-reviewer-workbook.md',
    );
    const rules = JSON.parse(
      await read(
        'docs/methodology/artifacts/beta-rules/0.1.0-draft/beta-rules.json',
      ),
    );
    const phaseLabel = (week) => {
      if (week.kind === 'cutback') return 'Cutback';
      if (week.kind === 'peak') return 'Peak';
      if (week.kind === 'taper') return 'Taper';
      if (week.kind === 'race') return 'Race';
      return week.phase === 'base_building' ? 'Base' : 'Build';
    };

    for (const week of rules.planFamily.coreWeeks) {
      const distances = week.distancesMetersByPosition.map(
        (distance) => distance / 1000,
      );
      const finalDistance = week.kind === 'race'
        ? `${distances[3]} race`
        : distances[3];
      const total = week.kind === 'race'
        ? `${distances.slice(0, 3).reduce((sum, value) => sum + value, 0)} plus race`
        : distances.reduce((sum, value) => sum + value, 0);
      const row = `| ${week.week} | ${phaseLabel(week)} | ${distances[0]} | ${distances[1]} | ${distances[2]} | ${finalDistance} | ${total} |`;

      expect(workbook).toContain(row);
    }

    expect(workbook).toContain('At least eight consecutive weeks');
    expect(workbook).toContain('Average 40–45 km');
    expect(workbook).toContain('14–20 km');
    expect(workbook).toContain('An exact race date 18–22 weeks');
  });
});
