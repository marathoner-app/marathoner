import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  analyzeDashboardWidgetDefinitions,
  analyzeDashboardWidgetIds,
} from "./analyzeDashboardLayout";
import type { AnalyzeDashboardEditorController } from "./useAnalyzeDashboardEditor";

type ConfirmationDialogProps = {
  readonly title: string;
  readonly description: ReactNode;
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
};

function EditorConfirmationDialog({
  title,
  description,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    cancelRef.current?.focus();
    return () => {
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;

    const buttons = Array.from(
      dialogRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
    );
    const first = buttons[0];
    const last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <div className="analyze-editor-dialog-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="analyze-editor-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="analyze-editor-dialog-title"
        aria-describedby="analyze-editor-dialog-description"
        onKeyDown={handleKeyDown}
      >
        <p className="analyze-editor-dialog-eyebrow">Dashboard layout</p>
        <h2 id="analyze-editor-dialog-title">{title}</h2>
        <div id="analyze-editor-dialog-description">{description}</div>
        <div className="analyze-editor-dialog-actions">
          <button ref={cancelRef} type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="analyze-editor-dialog-confirm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AnalyzeDashboardHeaderControls({
  editor,
}: {
  readonly editor: AnalyzeDashboardEditorController;
}) {
  const [confirmingReset, setConfirmingReset] = useState(false);

  if (!editor.isAvailable) return null;

  return (
    <>
      <nav className="analyze-editor-header-actions" aria-label="Dashboard editing">
        {!editor.isEditing ? (
          <button type="button" onClick={editor.beginEditing}>
            Edit dashboard
          </button>
        ) : (
          <>
            <button
              id="analyze-add-widgets-button"
              type="button"
              onClick={editor.openDrawer}
            >
              Add widgets
            </button>
            <button type="button" onClick={() => setConfirmingReset(true)}>
              Reset
            </button>
            <button type="button" onClick={editor.cancelEditing}>
              Cancel
            </button>
            <button
              type="button"
              className="analyze-editor-save"
              disabled={!editor.isDirty}
              onClick={() => editor.saveEditing()}
            >
              Save
            </button>
          </>
        )}
      </nav>

      {confirmingReset && (
        <EditorConfirmationDialog
          title="Reset this dashboard?"
          description={
            <p>
              All five widgets will return to Marathoner’s default desktop
              layout. Nothing changes until you select Save.
            </p>
          }
          cancelLabel="Keep my layout"
          confirmLabel="Reset layout"
          onCancel={() => setConfirmingReset(false)}
          onConfirm={() => {
            editor.resetDraft();
            setConfirmingReset(false);
          }}
        />
      )}
    </>
  );
}

export function AnalyzeDashboardDrawer({
  editor,
}: {
  readonly editor: AnalyzeDashboardEditorController;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const hiddenWidgets = editor.draftLayout.filter((item) => !item.visible);
  const isDrawerOpen = editor.isDrawerOpen;
  const closeDrawer = editor.closeDrawer;

  useEffect(() => {
    if (!isDrawerOpen) return;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeRef.current?.focus();
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
      if (trigger?.isConnected) trigger.focus();
    };
  }, [closeDrawer, isDrawerOpen]);

  if (!editor.isEditing || !editor.isDrawerOpen) return null;

  return (
    <aside
      className="analyze-widget-drawer"
      aria-labelledby="analyze-widget-drawer-title"
    >
      <div className="analyze-widget-drawer-header">
        <div>
          <p>Dashboard editor</p>
          <h2 id="analyze-widget-drawer-title">Add widgets</h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          aria-label="Close Add widgets"
          onClick={editor.closeDrawer}
        >
          ×
        </button>
      </div>

      {hiddenWidgets.length === 0 ? (
        <p className="analyze-widget-drawer-empty">
          Every available widget is already on your dashboard.
        </p>
      ) : (
        <ul className="analyze-widget-drawer-list">
          {analyzeDashboardWidgetIds
            .filter((id) => hiddenWidgets.some((item) => item.i === id))
            .map((id) => {
              const definition = analyzeDashboardWidgetDefinitions[id];
              return (
                <li key={id}>
                  <div>
                    <h3>{definition.label}</h3>
                    <p>{definition.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => editor.restoreWidget(id)}
                  >
                    Add
                  </button>
                </li>
              );
            })}
        </ul>
      )}

      {editor.message && (
        <p className="analyze-widget-drawer-message" role="status">
          {editor.message}
        </p>
      )}
    </aside>
  );
}

export function AnalyzeDashboardDiscardDialog({
  onKeepEditing,
  onDiscard,
}: {
  readonly onKeepEditing: () => void;
  readonly onDiscard: () => void;
}) {
  return (
    <EditorConfirmationDialog
      title="Discard dashboard changes?"
      description={
        <p>
          Your saved desktop dashboard will stay as it was. The changes in this
          editing session will be lost.
        </p>
      }
      cancelLabel="Keep editing"
      confirmLabel="Discard changes"
      onCancel={onKeepEditing}
      onConfirm={onDiscard}
    />
  );
}

