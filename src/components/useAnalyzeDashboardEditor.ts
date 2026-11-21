import { useCallback, useEffect, useMemo, useState } from "react";
import type { Layout } from "react-grid-layout";
import {
  analyzeDashboardLayoutsEqual,
  applyVisibleGridLayout,
  createDefaultAnalyzeDashboardLayout,
  hideAnalyzeDashboardWidget,
  normalizeAnalyzeDashboardLayout,
  restoreAnalyzeDashboardWidget,
  serializeAnalyzeDashboardLayout,
  updateAnalyzeDashboardWidgetFromKeyboard,
  type AnalyzeDashboardLayout,
  type AnalyzeDashboardWidgetId,
} from "./analyzeDashboardLayout";

const desktopDashboardQuery = "(min-width: 1024px) and (min-height: 640px)";
const storageKeyPrefix = "marathoner.analyze-dashboard-layout.v1";

function storageKey(accountScope: string | null): string | null {
  return accountScope === null ? null : `${storageKeyPrefix}:${accountScope}`;
}

function loadLayout(accountScope: string | null): AnalyzeDashboardLayout {
  const key = storageKey(accountScope);
  if (key === null || typeof window === "undefined") {
    return createDefaultAnalyzeDashboardLayout();
  }

  try {
    const stored = window.localStorage.getItem(key);
    if (stored === null) return createDefaultAnalyzeDashboardLayout();
    return (
      normalizeAnalyzeDashboardLayout(JSON.parse(stored)) ??
      createDefaultAnalyzeDashboardLayout()
    );
  } catch {
    return createDefaultAnalyzeDashboardLayout();
  }
}

function persistLayout(
  accountScope: string | null,
  layout: AnalyzeDashboardLayout,
): boolean {
  const key = storageKey(accountScope);
  if (key === null || typeof window === "undefined") return false;

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(serializeAnalyzeDashboardLayout(layout)),
    );
    return true;
  } catch {
    return false;
  }
}

function useDesktopDashboardAvailability(): boolean {
  const [available, setAvailable] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(desktopDashboardQuery).matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(desktopDashboardQuery);
    const update = () => setAvailable(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return available;
}

export type AnalyzeDashboardEditorController = {
  readonly isAvailable: boolean;
  readonly isEditing: boolean;
  readonly isDirty: boolean;
  readonly isDrawerOpen: boolean;
  readonly savedLayout: AnalyzeDashboardLayout;
  readonly draftLayout: AnalyzeDashboardLayout;
  readonly displayedLayout: AnalyzeDashboardLayout;
  readonly message: string | null;
  readonly beginEditing: () => void;
  readonly cancelEditing: () => void;
  readonly saveEditing: () => boolean;
  readonly resetDraft: () => void;
  readonly openDrawer: () => void;
  readonly closeDrawer: () => void;
  readonly updateGridLayout: (layout: Layout) => void;
  readonly hideWidget: (id: AnalyzeDashboardWidgetId) => void;
  readonly restoreWidget: (id: AnalyzeDashboardWidgetId) => void;
  readonly updateWidgetFromKeyboard: (
    id: AnalyzeDashboardWidgetId,
    direction: "left" | "right" | "up" | "down",
    mode: "move" | "resize",
  ) => boolean;
  readonly clearMessage: () => void;
};

export function useAnalyzeDashboardEditor(
  accountScope: string | null,
): AnalyzeDashboardEditorController {
  const isAvailable = useDesktopDashboardAvailability();
  const [savedLayout, setSavedLayout] = useState<AnalyzeDashboardLayout>(() =>
    loadLayout(accountScope),
  );
  const [draftLayout, setDraftLayout] =
    useState<AnalyzeDashboardLayout>(savedLayout);
  const [isEditing, setIsEditing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const nextLayout = loadLayout(accountScope);
    setSavedLayout(nextLayout);
    setDraftLayout(nextLayout);
    setIsEditing(false);
    setIsDrawerOpen(false);
    setMessage(null);
  }, [accountScope]);

  useEffect(() => {
    if (!isAvailable && isEditing) {
      setDraftLayout(savedLayout);
      setIsEditing(false);
      setIsDrawerOpen(false);
      setMessage(null);
    }
  }, [isAvailable, isEditing, savedLayout]);

  const isDirty = useMemo(
    () => !analyzeDashboardLayoutsEqual(savedLayout, draftLayout),
    [draftLayout, savedLayout],
  );

  const beginEditing = useCallback(() => {
    if (!isAvailable) return;
    setDraftLayout(savedLayout);
    setIsEditing(true);
    setMessage(null);
  }, [isAvailable, savedLayout]);

  const cancelEditing = useCallback(() => {
    setDraftLayout(savedLayout);
    setIsEditing(false);
    setIsDrawerOpen(false);
    setMessage(null);
  }, [savedLayout]);

  const saveEditing = useCallback(() => {
    const validLayout = normalizeAnalyzeDashboardLayout(
      serializeAnalyzeDashboardLayout(draftLayout),
    );
    if (validLayout === null) {
      setMessage(
        "This dashboard has overlapping or out-of-bounds widgets. Move them apart before saving.",
      );
      return false;
    }
    if (!persistLayout(accountScope, validLayout)) {
      setMessage(
        "Marathoner could not save this dashboard on this device. Your draft is still open.",
      );
      return false;
    }
    setSavedLayout(validLayout);
    setIsEditing(false);
    setIsDrawerOpen(false);
    setMessage("Dashboard saved on this device.");
    return true;
  }, [accountScope, draftLayout]);

  const resetDraft = useCallback(() => {
    setDraftLayout(createDefaultAnalyzeDashboardLayout());
    setIsDrawerOpen(false);
    setMessage("Default dashboard restored. Save to keep it.");
  }, []);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);
  const clearMessage = useCallback(() => setMessage(null), []);

  const updateGridLayout = useCallback((layout: Layout) => {
    setDraftLayout((current) => applyVisibleGridLayout(current, layout));
    setMessage(null);
  }, []);

  const hideWidget = useCallback((id: AnalyzeDashboardWidgetId) => {
    setDraftLayout((current) => hideAnalyzeDashboardWidget(current, id));
    setMessage(null);
  }, []);

  const restoreWidget = useCallback((id: AnalyzeDashboardWidgetId) => {
    setDraftLayout((current) => {
      const next = restoreAnalyzeDashboardWidget(current, id);
      if (next === null) {
        setMessage(
          "That widget will not fit without making the dashboard harder to read. Hide or resize another widget first.",
        );
        return current;
      }
      setMessage("Widget added to the first available space.");
      return next;
    });
  }, []);

  const updateWidgetFromKeyboard = useCallback(
    (
      id: AnalyzeDashboardWidgetId,
      direction: "left" | "right" | "up" | "down",
      mode: "move" | "resize",
    ) => {
      const next = updateAnalyzeDashboardWidgetFromKeyboard(
        draftLayout,
        id,
        direction,
        mode,
      );
      if (next === null) return false;
      setDraftLayout(next);
      return true;
    },
    [draftLayout],
  );

  return {
    isAvailable,
    isEditing,
    isDirty,
    isDrawerOpen,
    savedLayout,
    draftLayout,
    displayedLayout: isEditing ? draftLayout : savedLayout,
    message,
    beginEditing,
    cancelEditing,
    saveEditing,
    resetDraft,
    openDrawer,
    closeDrawer,
    updateGridLayout,
    hideWidget,
    restoreWidget,
    updateWidgetFromKeyboard,
    clearMessage,
  };
}

