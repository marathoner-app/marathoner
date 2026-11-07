import type { UserId } from "../domain/training";

const historyStateKey = "marathoner:pending-run-save:v1";
const commandIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export const pendingRunSaveMessage =
  "Marathoner couldn't confirm whether this run finished saving. Don't log it again yet. Check the save status below.";

export class PendingRunSaveError extends Error {
  constructor() {
    super(pendingRunSaveMessage);
    this.name = "PendingRunSaveError";
  }
}

export type PendingRunSaveCheckResult =
  | { readonly status: "confirmed" }
  | { readonly status: "still_unconfirmed" }
  | { readonly status: "failed"; readonly message: string }
  | { readonly status: "none" };

export interface PendingRunSaveStore {
  read(ownerId: UserId): string | null;
  write(ownerId: UserId, commandId: string): void;
  clear(ownerId: UserId): void;
}

interface PendingRunSaveHistoryRecord {
  readonly ownerId: UserId;
  readonly commandId: string;
}

function browserHistory(): History | null {
  try {
    return typeof window === "undefined" ? null : window.history;
  } catch {
    return null;
  }
}

function historyRecord(history: History): PendingRunSaveHistoryRecord | null {
  const state: unknown = history.state;
  if (typeof state !== "object" || state === null) return null;

  const record = (state as Record<string, unknown>)[historyStateKey];
  if (typeof record !== "object" || record === null) return null;
  const ownerId = (record as Record<string, unknown>).ownerId;
  const commandId = (record as Record<string, unknown>).commandId;
  return typeof ownerId === "string" &&
    typeof commandId === "string" &&
    commandIdPattern.test(commandId)
    ? { ownerId: ownerId as UserId, commandId }
    : null;
}

function replaceHistoryRecord(
  history: History,
  record: PendingRunSaveHistoryRecord | null,
): void {
  const current =
    typeof history.state === "object" && history.state !== null
      ? (history.state as Record<string, unknown>)
      : {};
  const next = { ...current };
  if (record === null) {
    delete next[historyStateKey];
  } else {
    next[historyStateKey] = record;
  }
  history.replaceState(next, document.title);
}

export const browserPendingRunSaveStore: PendingRunSaveStore = {
  read(ownerId) {
    const history = browserHistory();
    if (history === null) return null;

    try {
      const record = historyRecord(history);
      if (record === null) return null;
      if (record.ownerId === ownerId) {
        return record.commandId;
      }
      replaceHistoryRecord(history, null);
      return null;
    } catch {
      return null;
    }
  },

  write(ownerId, commandId) {
    if (!commandIdPattern.test(commandId)) return;

    try {
      const history = browserHistory();
      if (history !== null) {
        replaceHistoryRecord(history, { ownerId, commandId });
      }
    } catch {
      // Reload recovery is best-effort when navigation state is unavailable.
    }
  },

  clear(ownerId) {
    try {
      const history = browserHistory();
      if (history !== null && historyRecord(history)?.ownerId === ownerId) {
        replaceHistoryRecord(history, null);
      }
    } catch {
      // An unavailable history entry must not change the command result.
    }
  },
};

export function clearBrowserPendingRunSave(): void {
  try {
    const history = browserHistory();
    if (history !== null) replaceHistoryRecord(history, null);
  } catch {
    // Session cleanup must not block sign-out.
  }
}
