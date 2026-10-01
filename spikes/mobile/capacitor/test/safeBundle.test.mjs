import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const candidateRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const webRoot = path.join(candidateRoot, 'web');

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? filesBelow(entryPath) : [entryPath];
    }),
  );

  return nested.flat();
}

test('Capacitor bundle is visibly disposable and contains no web Firebase project', async () => {
  const files = await filesBelow(webRoot);
  const rootFirebaseConfig = await readFile(
    path.resolve(candidateRoot, '../../../src/firebaseConfig.ts'),
    'utf8',
  );
  const configuredRemoteValues = Array.from(
    rootFirebaseConfig.matchAll(/:\s*"([^"]+)"/g),
    (match) => match[1],
  );
  const text = (
    await Promise.all(
      files.map(async (file) => {
        try {
          return await readFile(file, 'utf8');
        } catch {
          return '';
        }
      }),
    )
  ).join('\n');

  assert.match(text, /Disposable architecture spike/);
  assert.match(text, /Remote authentication and data writes are disabled/);
  assert.ok(configuredRemoteValues.length > 0);
  for (const remoteValue of configuredRemoteValues) {
    assert.equal(text.includes(remoteValue), false);
  }
});
