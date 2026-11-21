import { describe, expect, it } from "vitest";
import {
  ANALYZE_DASHBOARD_COLUMNS,
  ANALYZE_DASHBOARD_ROWS,
  analyzeDashboardLayoutsEqual,
  createDefaultAnalyzeDashboardLayout,
  hideAnalyzeDashboardWidget,
  normalizeAnalyzeDashboardLayout,
  restoreAnalyzeDashboardWidget,
  serializeAnalyzeDashboardLayout,
  updateAnalyzeDashboardWidgetFromKeyboard,
  visibleGridLayout,
} from "./analyzeDashboardLayout";

describe("analyzeDashboardLayout", () => {
  it("creates a complete, non-overlapping default dashboard", () => {
    const layout = createDefaultAnalyzeDashboardLayout();

    expect(layout).toHaveLength(5);
    expect(layout.every((item) => item.visible)).toBe(true);
    expect(
      normalizeAnalyzeDashboardLayout(serializeAnalyzeDashboardLayout(layout)),
    ).toEqual(layout);
  });

  it("rejects malformed, duplicate, out-of-bounds, and overlapping storage", () => {
    const stored = serializeAnalyzeDashboardLayout(
      createDefaultAnalyzeDashboardLayout(),
    );
    expect(normalizeAnalyzeDashboardLayout({ ...stored, version: 2 })).toBeNull();
    expect(
      normalizeAnalyzeDashboardLayout({
        ...stored,
        widgets: stored.widgets.map((item, index) =>
          index === 0 ? { ...item, w: 99 } : item,
        ),
      }),
    ).toBeNull();
    expect(
      normalizeAnalyzeDashboardLayout({
        ...stored,
        widgets: stored.widgets.map((item, index) =>
          index === 1 ? { ...item, i: stored.widgets[0].i } : item,
        ),
      }),
    ).toBeNull();
    expect(
      normalizeAnalyzeDashboardLayout({
        ...stored,
        widgets: stored.widgets.map((item, index) =>
          index === 1
            ? { ...item, x: stored.widgets[0].x, y: stored.widgets[0].y }
            : item,
        ),
      }),
    ).toBeNull();
  });

  it("hides and restores a widget in an available space", () => {
    const original = createDefaultAnalyzeDashboardLayout();
    const hidden = hideAnalyzeDashboardWidget(original, "latest-run");
    const restored = restoreAnalyzeDashboardWidget(hidden, "latest-run");

    expect(hidden.find((item) => item.i === "latest-run")?.visible).toBe(false);
    expect(restored).not.toBeNull();
    expect(restored?.find((item) => item.i === "latest-run")?.visible).toBe(true);
    expect(
      normalizeAnalyzeDashboardLayout(
        serializeAnalyzeDashboardLayout(restored ?? hidden),
      ),
    ).not.toBeNull();
  });

  it("re-packs visible widgets at useful minimum sizes when restoring needs room", () => {
    const original = createDefaultAnalyzeDashboardLayout();
    const hidden = hideAnalyzeDashboardWidget(original, "recent-effort").map(
      (item) =>
        item.visible
          ? {
              ...item,
              x:
                item.i === "latest-run" || item.i === "training-summary"
                  ? 6
                  : 0,
              y:
                item.i === "recent-pace" || item.i === "training-summary"
                  ? 6
                  : 0,
              w: 6,
              h: 6,
            }
          : item,
    );
    const restored = restoreAnalyzeDashboardWidget(hidden, "recent-effort");

    expect(restored).not.toBeNull();
    const visible = visibleGridLayout(restored ?? hidden);
    expect(visible).toHaveLength(5);
    expect(
      visible.every(
        (item) =>
          item.x + item.w <= ANALYZE_DASHBOARD_COLUMNS &&
          item.y + item.h <= ANALYZE_DASHBOARD_ROWS,
      ),
    ).toBe(true);
  });

  it("supports bounded keyboard movement and resizing without collisions", () => {
    const original = hideAnalyzeDashboardWidget(
      createDefaultAnalyzeDashboardLayout(),
      "latest-run",
    );
    const moved = updateAnalyzeDashboardWidgetFromKeyboard(
      original,
      "weekly-distance",
      "right",
      "move",
    );
    const resized = updateAnalyzeDashboardWidgetFromKeyboard(
      moved ?? original,
      "weekly-distance",
      "up",
      "resize",
    );

    expect(moved?.find((item) => item.i === "weekly-distance")?.x).toBe(1);
    expect(resized?.find((item) => item.i === "weekly-distance")?.h).toBe(5);
    expect(
      updateAnalyzeDashboardWidgetFromKeyboard(
        original,
        "weekly-distance",
        "left",
        "move",
      ),
    ).toBeNull();
    expect(analyzeDashboardLayoutsEqual(original, original.map((item) => ({ ...item })))).toBe(true);
  });
});

