import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { UserId } from "../domain/training";
import type {
  RecommendationEvidenceLiveReadEvent,
  RecommendationEvidenceLiveReadSource,
} from "../persistence/firestore/firestoreRecommendationEvidenceLiveReadSource";
import {
  RecommendationEvidenceContext,
  type RecommendationEvidenceContextValue,
} from "./RecommendationEvidenceContext";

export type RecommendationEvidenceLiveReadSourceFactory = (
  ownerId: UserId,
) => Promise<RecommendationEvidenceLiveReadSource>;

interface RecommendationEvidenceProviderProps {
  readonly ownerId: UserId;
  readonly children: ReactNode;
  readonly liveReadSourceFactory?: RecommendationEvidenceLiveReadSourceFactory;
}

interface RecommendationEvidenceProviderState
  extends Omit<RecommendationEvidenceContextValue, "retry"> {
  readonly ownerId: UserId;
}

const READ_ERROR_MESSAGE = "Recommendation history could not be synchronized.";

const defaultLiveReadSourceFactory: RecommendationEvidenceLiveReadSourceFactory =
  async (ownerId) => {
    const { createFirestoreRecommendationEvidenceLiveReadSource } = await import(
      "../persistence/firestore"
    );
    return createFirestoreRecommendationEvidenceLiveReadSource(ownerId);
  };

function initialState(ownerId: UserId): RecommendationEvidenceProviderState {
  return {
    ownerId,
    status: "loading",
    evidence: [],
    origin: null,
    hasPendingWrites: false,
    error: null,
  };
}

function reduceEvent(
  current: RecommendationEvidenceProviderState,
  event: RecommendationEvidenceLiveReadEvent,
): RecommendationEvidenceProviderState {
  if (event.ownerId !== current.ownerId) return current;

  if (event.type === "error") {
    return {
      ...current,
      status: "error",
      error: event.message,
    };
  }

  return {
    ownerId: current.ownerId,
    status: "ready",
    evidence: event.evidence,
    origin: event.origin,
    hasPendingWrites: event.hasPendingWrites,
    error: null,
  };
}

export default function RecommendationEvidenceProvider({
  ownerId,
  children,
  liveReadSourceFactory = defaultLiveReadSourceFactory,
}: RecommendationEvidenceProviderProps) {
  const [retrySequence, setRetrySequence] = useState(0);
  const [state, setState] = useState(() => initialState(ownerId));
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    let active = true;
    let unsubscribe: (() => void) | null = null;

    setState((current) =>
      current.ownerId === ownerId
        ? { ...current, status: "loading", error: null }
        : initialState(ownerId),
    );

    void liveReadSourceFactory(ownerId)
      .then((source) => {
        if (!active || generation !== generationRef.current) return;

        const stop = source.subscribe((event) => {
          if (!active || generation !== generationRef.current) return;
          setState((current) => reduceEvent(current, event));
        });

        if (!active || generation !== generationRef.current) {
          stop();
          return;
        }

        unsubscribe = stop;
      })
      .catch(() => {
        if (!active || generation !== generationRef.current) return;

        setState((current) => ({
          ...current,
          status: "error",
          error: READ_ERROR_MESSAGE,
        }));
      });

    return () => {
      active = false;
      generationRef.current += 1;
      unsubscribe?.();
      unsubscribe = null;
    };
  }, [liveReadSourceFactory, ownerId, retrySequence]);

  const retry = useCallback(() => {
    setRetrySequence((sequence) => sequence + 1);
  }, []);

  const visibleState =
    state.ownerId === ownerId ? state : initialState(ownerId);

  const value = useMemo<RecommendationEvidenceContextValue>(
    () => ({
      status: visibleState.status,
      evidence: visibleState.evidence,
      origin: visibleState.origin,
      hasPendingWrites: visibleState.hasPendingWrites,
      error: visibleState.error,
      retry,
    }),
    [retry, visibleState],
  );

  return (
    <RecommendationEvidenceContext.Provider value={value}>
      {children}
    </RecommendationEvidenceContext.Provider>
  );
}
