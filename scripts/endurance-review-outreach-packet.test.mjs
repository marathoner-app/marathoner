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

describe('endurance-methodology review outreach packet', () => {
  it('pins one exact draft bundle and immutable repository commit', async () => {
    const manifest = await readPacketManifest();
    const document = await readPacketDocument();

    expect(manifest).toEqual(
      expect.objectContaining({
        schemaVersion: 'endurance-review-outreach-packet@1',
        status: 'prepared-not-sent',
        reviewRole: 'EMR',
        protocolVersion: 'methodology-review@0.1.0',
        pinnedRepositoryCommit:
          '1ef241ac5b6bdbe52d819e7107b25d9ba9347b23',
        bundle: {
          name: 'beta-rules',
          version: 'beta-rules@0.1.0-draft',
          state: 'draft-not-approved-not-runtime-eligible',
        },
      }),
    );
    expect(manifest.pinnedRepositoryCommit).toMatch(/^[a-f0-9]{40}$/);
    expect(document).toContain(manifest.pinnedRepositoryCommit);
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

  it('submits exactly the seven authored endurance inventory rows', async () => {
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
    ];

    expect(manifest.inventoryIds).toEqual(expectedInventoryIds);
    for (const inventoryId of expectedInventoryIds) {
      expect(document).toContain(`| \`${inventoryId}\` | \`[Blank]\``);
    }
    expect(document).not.toContain('| `SAFE-001` | `[Blank]`');
    expect(document).not.toContain('| `GUIDE-001` | `[Blank]`');
    expect(document).not.toContain('| `ADAPT-001` | `[Blank]`');
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
    expect(document).toContain('did not depend on the outcome');
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
});
