import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { RecommendationEvidenceV2 } from "../domain/recommendations/recommendationEvidence";
import { createUserId, type UserId } from "../domain/training";
import type {
  RecommendationEvidenceLiveReadEvent,
  RecommendationEvidenceLiveReadSource,
} from "../persistence/firestore/firestoreRecommendationEvidenceLiveReadSource";
import RecommendationEvidenceProvider, {
  type RecommendationEvidenceLiveReadSourceFactory,
} from "./RecommendationEvidenceProvider";
import { useRecommendationEvidence } from "./useRecommendationEvidence";

class ControlledLiveReadSource implements RecommendationEvidenceLiveReadSource {
  readonly unsubscribe = vi.fn();
  private listener:
    | ((event: RecommendationEvidenceLiveReadEvent) => void)
    | null = null;

  subscribe(listener: (event: RecommendationEvidenceLiveReadEvent) => void) {
    this.listener = listener;
    return this.unsubscribe;
  }

  emit(event: RecommendationEvidenceLiveReadEvent) {
    this.listener?.(event);
  }
}

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
}

function deferred<Value>(): Deferred<Value> {
  let resolvePromise: (value: Value) => void = () => undefined;
  const promise = new Promise<Value>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

const firstOwnerId = createUserId("owner-1");
const secondOwnerId = createUserId("owner-2");
const evidence = [
  { recommendationId: "recommendation-provider-0001" },
] as unknown as readonly RecommendationEvidenceV2[];

function Consumer() {
  const value = useRecommendationEvidence();

  return (
    <div>
      <p data-testid="status">{value.status}</p>
      <p data-testid="count">{value.evidence.length}</p>
      <p data-testid="origin">{value.origin ?? "none"}</p>
      <p data-testid="pending">{String(value.hasPendingWrites)}</p>
      <p data-testid="error">{value.error ?? "none"}</p>
      <button type="button" onClick={value.retry}>
        Retry evidence
      </button>
    </div>
  );
}

class HookErrorBoundary extends Component<
  { readonly children: ReactNode },
  { readonly message: string | null }
> {
  state = { message: null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }

  render() {
    return this.state.message === null ? (
      this.props.children
    ) : (
      <p role="alert">{this.state.message}</p>
    );
  }
}

function renderProvider(
  ownerId: UserId,
  liveReadSourceFactory: RecommendationEvidenceLiveReadSourceFactory,
) {
  return render(
    <RecommendationEvidenceProvider
      ownerId={ownerId}
      liveReadSourceFactory={liveReadSourceFactory}
    >
      <Consumer />
    </RecommendationEvidenceProvider>,
  );
}

function snapshot(
  ownerId: UserId,
  overrides: Partial<
    Extract<RecommendationEvidenceLiveReadEvent, { type: "snapshot" }>
  > = {},
): RecommendationEvidenceLiveReadEvent {
  return {
    type: "snapshot",
    ownerId,
    evidence,
    origin: "server",
    hasPendingWrites: false,
    ...overrides,
  };
}

describe("RecommendationEvidenceProvider", () => {
  it("publishes loading and complete owner-scoped snapshot state", async () => {
    const source = new ControlledLiveReadSource();
    const factory = vi.fn(async () => source);
    renderProvider(firstOwnerId, factory);

    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    await waitFor(() => expect(factory).toHaveBeenCalledWith(firstOwnerId));

    act(() => {
      source.emit(
        snapshot(firstOwnerId, {
          origin: "cache",
          hasPendingWrites: true,
        }),
      );
    });

    expect(screen.getByTestId("status")).toHaveTextContent("ready");
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("origin")).toHaveTextContent("cache");
    expect(screen.getByTestId("pending")).toHaveTextContent("true");
    expect(screen.getByTestId("error")).toHaveTextContent("none");
  });

  it("preserves the last complete snapshot on a recoverable read error", async () => {
    const source = new ControlledLiveReadSource();
    renderProvider(firstOwnerId, async () => source);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("loading"));

    act(() => source.emit(snapshot(firstOwnerId)));
    act(() => {
      source.emit({
        type: "error",
        ownerId: firstOwnerId,
        message: "Recommendation history could not be synchronized.",
        recoverable: true,
      });
    });

    expect(screen.getByTestId("status")).toHaveTextContent("error");
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("origin")).toHaveTextContent("server");
    expect(screen.getByTestId("error")).toHaveTextContent(
      "Recommendation history could not be synchronized.",
    );
  });

  it("retries with a new source and ignores later events from the old listener", async () => {
    const user = userEvent.setup();
    const firstSource = new ControlledLiveReadSource();
    const secondSource = new ControlledLiveReadSource();
    const factory = vi
      .fn<RecommendationEvidenceLiveReadSourceFactory>()
      .mockResolvedValueOnce(firstSource)
      .mockResolvedValueOnce(secondSource);
    renderProvider(firstOwnerId, factory);
    await waitFor(() => expect(factory).toHaveBeenCalledTimes(1));

    act(() => firstSource.emit(snapshot(firstOwnerId)));
    await user.click(screen.getByRole("button", { name: "Retry evidence" }));

    await waitFor(() => expect(factory).toHaveBeenCalledTimes(2));
    expect(firstSource.unsubscribe).toHaveBeenCalledOnce();
    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    expect(screen.getByTestId("count")).toHaveTextContent("1");

    act(() => {
      firstSource.emit(
        snapshot(firstOwnerId, { evidence: [], origin: "cache" }),
      );
    });
    expect(screen.getByTestId("count")).toHaveTextContent("1");

    act(() => secondSource.emit(snapshot(firstOwnerId, { evidence: [] })));
    expect(screen.getByTestId("status")).toHaveTextContent("ready");
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("clears prior-owner evidence and tears down its active listener", async () => {
    const firstSource = new ControlledLiveReadSource();
    const secondSource = new ControlledLiveReadSource();
    const factory = vi.fn(async (ownerId: UserId) =>
      ownerId === firstOwnerId ? firstSource : secondSource,
    );
    const view = renderProvider(firstOwnerId, factory);
    await waitFor(() => expect(factory).toHaveBeenCalledTimes(1));
    act(() => firstSource.emit(snapshot(firstOwnerId)));

    view.rerender(
      <RecommendationEvidenceProvider
        ownerId={secondOwnerId}
        liveReadSourceFactory={factory}
      >
        <Consumer />
      </RecommendationEvidenceProvider>,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    expect(screen.getByTestId("count")).toHaveTextContent("0");
    await waitFor(() => expect(factory).toHaveBeenCalledTimes(2));
    expect(firstSource.unsubscribe).toHaveBeenCalledOnce();

    act(() => firstSource.emit(snapshot(firstOwnerId)));
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("ignores a source factory that resolves after the owner changes", async () => {
    const firstSource = new ControlledLiveReadSource();
    const secondSource = new ControlledLiveReadSource();
    const firstFactory = deferred<RecommendationEvidenceLiveReadSource>();
    const factory = vi.fn((ownerId: UserId) =>
      ownerId === firstOwnerId
        ? firstFactory.promise
        : Promise.resolve(secondSource),
    );
    const view = renderProvider(firstOwnerId, factory);

    view.rerender(
      <RecommendationEvidenceProvider
        ownerId={secondOwnerId}
        liveReadSourceFactory={factory}
      >
        <Consumer />
      </RecommendationEvidenceProvider>,
    );
    await waitFor(() => expect(factory).toHaveBeenCalledTimes(2));

    await act(async () => firstFactory.resolve(firstSource));

    expect(firstSource.unsubscribe).not.toHaveBeenCalled();
    act(() => secondSource.emit(snapshot(secondOwnerId)));
    expect(screen.getByTestId("status")).toHaveTextContent("ready");
    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });

  it("reports a generic recoverable error when the source cannot be created", async () => {
    renderProvider(firstOwnerId, async () => {
      throw new Error("raw Firebase startup detail");
    });

    expect(await screen.findByTestId("status")).toHaveTextContent("error");
    expect(screen.getByTestId("error")).toHaveTextContent(
      "Recommendation history could not be synchronized.",
    );
  });

  it("tears down its listener and ignores delivery after unmount", async () => {
    const source = new ControlledLiveReadSource();
    const view = renderProvider(firstOwnerId, async () => source);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("loading"));

    view.unmount();
    expect(source.unsubscribe).toHaveBeenCalledOnce();
    expect(() => source.emit(snapshot(firstOwnerId))).not.toThrow();
  });

  it("rejects consumers outside the provider", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const preventExpectedError = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener("error", preventExpectedError);

    render(
      <HookErrorBoundary>
        <Consumer />
      </HookErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "useRecommendationEvidence must be used within RecommendationEvidenceProvider.",
    );

    window.removeEventListener("error", preventExpectedError);
    errorSpy.mockRestore();
  });
});
