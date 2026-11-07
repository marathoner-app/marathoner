import { beforeEach, describe, expect, it } from "vitest";
import { createUserId } from "../domain/training";
import {
  browserPendingRunSaveStore,
  clearBrowserPendingRunSave,
} from "./pendingRunSave";

describe("pending run save storage", () => {
  beforeEach(() => {
    history.replaceState({}, document.title);
  });

  it("stores only the command ID under the signed-in owner", () => {
    const owner = createUserId("runner-one");
    const otherOwner = createUserId("runner-two");

    browserPendingRunSaveStore.write(owner, "run-complete-command-0001");

    expect(browserPendingRunSaveStore.read(owner)).toBe(
      "run-complete-command-0001",
    );
    expect(JSON.stringify(history.state)).toContain(
      '"commandId":"run-complete-command-0001"',
    );
    expect(JSON.stringify(history.state)).not.toContain("distance");
    expect(JSON.stringify(history.state)).not.toContain("notes");
    expect(browserPendingRunSaveStore.read(otherOwner)).toBeNull();
  });

  it("ignores a malformed stored command instead of resolving it", () => {
    const owner = createUserId("runner-one");
    history.replaceState(
      {
        "marathoner:pending-run-save:v1": {
          ownerId: owner,
          commandId: "not a valid command id",
        },
      },
      document.title,
    );

    expect(browserPendingRunSaveStore.read(owner)).toBeNull();
  });

  it("clears only the current owner's recovery command", () => {
    const owner = createUserId("runner-one");
    const otherOwner = createUserId("runner-two");
    browserPendingRunSaveStore.write(
      otherOwner,
      "run-complete-command-0002",
    );

    browserPendingRunSaveStore.clear(owner);

    expect(browserPendingRunSaveStore.read(otherOwner)).toBe(
      "run-complete-command-0002",
    );
  });

  it("clears recovery navigation state when the session ends", () => {
    const owner = createUserId("runner-one");
    browserPendingRunSaveStore.write(owner, "run-complete-command-0001");

    clearBrowserPendingRunSave();

    expect(browserPendingRunSaveStore.read(owner)).toBeNull();
  });
});
