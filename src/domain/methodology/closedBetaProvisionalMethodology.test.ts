import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseClosedBetaProvisionalMethodologyManifest,
  type ClosedBetaProvisionalMethodologyManifest,
} from "./closedBetaProvisionalMethodology";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const manifestPath = path.join(
  repositoryRoot,
  "docs/methodology/artifacts/closed-beta-provisional-methodology/0.1.0/manifest.json",
);

async function readPinnedManifest(): Promise<ClosedBetaProvisionalMethodologyManifest> {
  return parseClosedBetaProvisionalMethodologyManifest(
    await readFile(manifestPath, "utf8"),
  );
}

describe("closed beta provisional methodology manifest", () => {
  it("pins one active plan, adaptation, guidance, and safety artifact", async () => {
    const manifest = await readPinnedManifest();

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      manifestVersion: "closed-beta-provisional-methodology@0.1.0",
      reviewState: "provisional_unreviewed",
      publicationState: "closed_beta_only",
      firebaseEnvironment: "beta",
      eligibleCohort: {
        kind: "founding_closed_beta",
        minimumParticipants: 5,
        maximumParticipants: 8,
      },
    });
    expect(manifest.artifacts.map(({ kind }) => kind)).toEqual([
      "plan",
      "adaptation",
      "guidance",
      "safety",
    ]);
  });

  it("pins the current contents of every repository source", async () => {
    const manifest = await readPinnedManifest();

    for (const artifact of manifest.artifacts) {
      const contents = await readFile(
        path.join(repositoryRoot, artifact.sourcePath),
      );
      expect(
        createHash("sha256").update(contents).digest("hex"),
        artifact.sourcePath,
      ).toBe(artifact.sha256);
    }
  });

  it.each([
    ["unknown kind", (value: Record<string, unknown>) => {
      const artifacts = value.artifacts as Record<string, unknown>[];
      artifacts[0] = { ...artifacts[0], kind: "nutrition" };
    }],
    ["missing artifact", (value: Record<string, unknown>) => {
      (value.artifacts as unknown[]).pop();
    }],
    ["retired artifact", (value: Record<string, unknown>) => {
      const artifacts = value.artifacts as Record<string, unknown>[];
      artifacts[0] = { ...artifacts[0], status: "retired" };
    }],
    ["mismatched artifact family", (value: Record<string, unknown>) => {
      const artifacts = value.artifacts as Record<string, unknown>[];
      artifacts[0] = {
        ...artifacts[0],
        version: "beta-adaptation@0.2.0-draft",
      };
    }],
  ])("rejects a %s", async (_name, mutate) => {
    const value = JSON.parse(await readFile(manifestPath, "utf8")) as Record<
      string,
      unknown
    >;
    mutate(value);

    expect(() =>
      parseClosedBetaProvisionalMethodologyManifest(value),
    ).toThrow();
  });
});
