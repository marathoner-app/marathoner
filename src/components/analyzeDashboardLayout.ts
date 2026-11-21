import type { Layout, LayoutItem } from "react-grid-layout";

export const ANALYZE_DASHBOARD_COLUMNS = 12;
export const ANALYZE_DASHBOARD_ROWS = 12;
export const ANALYZE_DASHBOARD_STORAGE_VERSION = 1;

export const analyzeDashboardWidgetIds = [
  "latest-run",
  "training-summary",
  "weekly-distance",
  "recent-pace",
  "recent-effort",
] as const;

export type AnalyzeDashboardWidgetId =
  (typeof analyzeDashboardWidgetIds)[number];

export type AnalyzeDashboardWidgetDefinition = {
  readonly id: AnalyzeDashboardWidgetId;
  readonly label: string;
  readonly description: string;
  readonly minW: number;
  readonly minH: number;
  readonly maxW: number;
  readonly maxH: number;
};

export type AnalyzeDashboardWidgetLayout = LayoutItem & {
  readonly i: AnalyzeDashboardWidgetId;
  readonly visible: boolean;
};

export type AnalyzeDashboardLayout = readonly AnalyzeDashboardWidgetLayout[];

type StoredAnalyzeDashboardLayout = {
  readonly version: typeof ANALYZE_DASHBOARD_STORAGE_VERSION;
  readonly widgets: readonly AnalyzeDashboardWidgetLayout[];
};

export const analyzeDashboardWidgetDefinitions: Record<
  AnalyzeDashboardWidgetId,
  AnalyzeDashboardWidgetDefinition
> = {
  "latest-run": {
    id: "latest-run",
    label: "Latest run",
    description: "Your most recent run and its essential details.",
    minW: 3,
    minH: 4,
    maxW: 7,
    maxH: 8,
  },
  "training-summary": {
    id: "training-summary",
    label: "Training summary",
    description: "Lifetime and current-week totals at a glance.",
    minW: 3,
    minH: 4,
    maxW: 7,
    maxH: 8,
  },
  "weekly-distance": {
    id: "weekly-distance",
    label: "Weekly distance",
    description: "Your recent weekly mileage or kilometer trend.",
    minW: 4,
    minH: 4,
    maxW: 9,
    maxH: 9,
  },
  "recent-pace": {
    id: "recent-pace",
    label: "Recent pace",
    description: "How your average run pace is changing.",
    minW: 4,
    minH: 4,
    maxW: 9,
    maxH: 9,
  },
  "recent-effort": {
    id: "recent-effort",
    label: "Recent effort",
    description: "How recent runs felt compared with their plan.",
    minW: 3,
    minH: 6,
    maxW: 6,
    maxH: 12,
  },
};

const defaultPositions: Record<
  AnalyzeDashboardWidgetId,
  Pick<LayoutItem, "x" | "y" | "w" | "h">
> = {
  "weekly-distance": { x: 0, y: 0, w: 5, h: 6 },
  "recent-pace": { x: 0, y: 6, w: 5, h: 6 },
  "latest-run": { x: 5, y: 0, w: 4, h: 6 },
  "training-summary": { x: 5, y: 6, w: 4, h: 6 },
  "recent-effort": { x: 9, y: 0, w: 3, h: 12 },
};

function withDefinitionConstraints(
  id: AnalyzeDashboardWidgetId,
  position: Pick<LayoutItem, "x" | "y" | "w" | "h">,
  visible = true,
): AnalyzeDashboardWidgetLayout {
  const definition = analyzeDashboardWidgetDefinitions[id];
  return {
    i: id,
    ...position,
    minW: definition.minW,
    minH: definition.minH,
    maxW: definition.maxW,
    maxH: definition.maxH,
    isBounded: true,
    resizeHandles: ["se"],
    visible,
  };
}

export function createDefaultAnalyzeDashboardLayout(): AnalyzeDashboardLayout {
  return analyzeDashboardWidgetIds.map((id) =>
    withDefinitionConstraints(id, defaultPositions[id]),
  );
}

function isWidgetId(value: unknown): value is AnalyzeDashboardWidgetId {
  return (
    typeof value === "string" &&
    analyzeDashboardWidgetIds.includes(value as AnalyzeDashboardWidgetId)
  );
}

function finiteInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number.isFinite(value);
}

function overlaps(first: LayoutItem, second: LayoutItem): boolean {
  return !(
    first.x + first.w <= second.x ||
    second.x + second.w <= first.x ||
    first.y + first.h <= second.y ||
    second.y + second.h <= first.y
  );
}

function isValidVisibleLayout(layout: AnalyzeDashboardLayout): boolean {
  const visible = layout.filter((item) => item.visible);
  return visible.every(
    (item, index) =>
      item.x >= 0 &&
      item.y >= 0 &&
      item.x + item.w <= ANALYZE_DASHBOARD_COLUMNS &&
      item.y + item.h <= ANALYZE_DASHBOARD_ROWS &&
      visible.slice(index + 1).every((other) => !overlaps(item, other)),
  );
}

export function normalizeAnalyzeDashboardLayout(
  value: unknown,
): AnalyzeDashboardLayout | null {
  if (typeof value !== "object" || value === null) return null;
  const stored = value as Partial<StoredAnalyzeDashboardLayout>;
  if (
    stored.version !== ANALYZE_DASHBOARD_STORAGE_VERSION ||
    !Array.isArray(stored.widgets) ||
    stored.widgets.length !== analyzeDashboardWidgetIds.length
  ) {
    return null;
  }

  const ids = new Set<AnalyzeDashboardWidgetId>();
  const normalized: AnalyzeDashboardWidgetLayout[] = [];
  for (const candidate of stored.widgets) {
    if (typeof candidate !== "object" || candidate === null) return null;
    const item = candidate as Partial<AnalyzeDashboardWidgetLayout>;
    if (
      !isWidgetId(item.i) ||
      ids.has(item.i) ||
      !finiteInteger(item.x) ||
      !finiteInteger(item.y) ||
      !finiteInteger(item.w) ||
      !finiteInteger(item.h) ||
      typeof item.visible !== "boolean"
    ) {
      return null;
    }

    const definition = analyzeDashboardWidgetDefinitions[item.i];
    if (
      item.w < definition.minW ||
      item.w > definition.maxW ||
      item.h < definition.minH ||
      item.h > definition.maxH ||
      item.x < 0 ||
      item.y < 0 ||
      item.x + item.w > ANALYZE_DASHBOARD_COLUMNS ||
      item.y + item.h > ANALYZE_DASHBOARD_ROWS
    ) {
      return null;
    }

    ids.add(item.i);
    normalized.push(
      withDefinitionConstraints(
        item.i,
        { x: item.x, y: item.y, w: item.w, h: item.h },
        item.visible,
      ),
    );
  }

  return isValidVisibleLayout(normalized) ? normalized : null;
}

export function serializeAnalyzeDashboardLayout(
  layout: AnalyzeDashboardLayout,
): StoredAnalyzeDashboardLayout {
  return {
    version: ANALYZE_DASHBOARD_STORAGE_VERSION,
    widgets: layout.map(({ i, x, y, w, h, visible }) =>
      withDefinitionConstraints(i, { x, y, w, h }, visible),
    ),
  };
}

export function visibleGridLayout(layout: AnalyzeDashboardLayout): Layout {
  return layout
    .filter((item) => item.visible)
    .map(({ i, x, y, w, h, minW, minH, maxW, maxH, isBounded, resizeHandles }) => ({
      i,
      x,
      y,
      w,
      h,
      minW,
      minH,
      maxW,
      maxH,
      isBounded,
      resizeHandles,
    }));
}

export function applyVisibleGridLayout(
  current: AnalyzeDashboardLayout,
  gridLayout: Layout,
): AnalyzeDashboardLayout {
  const positions = new Map(gridLayout.map((item) => [item.i, item]));
  return current.map((item) => {
    const position = positions.get(item.i);
    if (position === undefined || !item.visible) return item;
    return withDefinitionConstraints(
      item.i,
      {
        x: position.x,
        y: position.y,
        w: position.w,
        h: position.h,
      },
      true,
    );
  });
}

export function analyzeDashboardLayoutsEqual(
  first: AnalyzeDashboardLayout,
  second: AnalyzeDashboardLayout,
): boolean {
  return analyzeDashboardWidgetIds.every((id) => {
    const left = first.find((item) => item.i === id);
    const right = second.find((item) => item.i === id);
    return (
      left !== undefined &&
      right !== undefined &&
      left.x === right.x &&
      left.y === right.y &&
      left.w === right.w &&
      left.h === right.h &&
      left.visible === right.visible
    );
  });
}

function firstAvailablePosition(
  occupied: readonly LayoutItem[],
  w: number,
  h: number,
): Pick<LayoutItem, "x" | "y" | "w" | "h"> | null {
  for (let y = 0; y <= ANALYZE_DASHBOARD_ROWS - h; y += 1) {
    for (let x = 0; x <= ANALYZE_DASHBOARD_COLUMNS - w; x += 1) {
      const candidate = { i: "candidate", x, y, w, h };
      if (occupied.every((item) => !overlaps(candidate, item))) {
        return { x, y, w, h };
      }
    }
  }
  return null;
}

function repackAtMinimumSizes(
  layout: AnalyzeDashboardLayout,
  restoredId: AnalyzeDashboardWidgetId,
): AnalyzeDashboardLayout | null {
  const visible = layout
    .filter((item) => item.visible && item.i !== restoredId)
    .sort((left, right) => left.y - right.y || left.x - right.x);
  const packed: AnalyzeDashboardWidgetLayout[] = [];

  for (const item of visible) {
    const definition = analyzeDashboardWidgetDefinitions[item.i];
    const position = firstAvailablePosition(
      packed,
      definition.minW,
      definition.minH,
    );
    if (position === null) return null;
    packed.push(withDefinitionConstraints(item.i, position, true));
  }

  const restoredDefinition = analyzeDashboardWidgetDefinitions[restoredId];
  const restoredPosition = firstAvailablePosition(
    packed,
    restoredDefinition.minW,
    restoredDefinition.minH,
  );
  if (restoredPosition === null) return null;
  packed.push(withDefinitionConstraints(restoredId, restoredPosition, true));

  return layout.map((item) => {
    const replacement = packed.find((candidate) => candidate.i === item.i);
    return replacement ?? item;
  });
}

export function hideAnalyzeDashboardWidget(
  layout: AnalyzeDashboardLayout,
  id: AnalyzeDashboardWidgetId,
): AnalyzeDashboardLayout {
  return layout.map((item) =>
    item.i === id ? { ...item, visible: false } : item,
  );
}

export function restoreAnalyzeDashboardWidget(
  layout: AnalyzeDashboardLayout,
  id: AnalyzeDashboardWidgetId,
): AnalyzeDashboardLayout | null {
  const item = layout.find((candidate) => candidate.i === id);
  if (item === undefined || item.visible) return layout;

  const occupied = visibleGridLayout(layout);
  const preferredPosition = firstAvailablePosition(occupied, item.w, item.h);
  if (preferredPosition !== null) {
    return layout.map((candidate) =>
      candidate.i === id
        ? withDefinitionConstraints(id, preferredPosition, true)
        : candidate,
    );
  }

  const definition = analyzeDashboardWidgetDefinitions[id];
  const minimumPosition = firstAvailablePosition(
    occupied,
    definition.minW,
    definition.minH,
  );
  if (minimumPosition !== null) {
    return layout.map((candidate) =>
      candidate.i === id
        ? withDefinitionConstraints(id, minimumPosition, true)
        : candidate,
    );
  }

  return repackAtMinimumSizes(layout, id);
}

export function updateAnalyzeDashboardWidgetFromKeyboard(
  layout: AnalyzeDashboardLayout,
  id: AnalyzeDashboardWidgetId,
  direction: "left" | "right" | "up" | "down",
  mode: "move" | "resize",
): AnalyzeDashboardLayout | null {
  const item = layout.find((candidate) => candidate.i === id);
  if (item === undefined || !item.visible) return null;
  const definition = analyzeDashboardWidgetDefinitions[id];
  const next = { ...item };

  if (mode === "move") {
    if (direction === "left") next.x -= 1;
    if (direction === "right") next.x += 1;
    if (direction === "up") next.y -= 1;
    if (direction === "down") next.y += 1;
  } else {
    if (direction === "left") next.w -= 1;
    if (direction === "right") next.w += 1;
    if (direction === "up") next.h -= 1;
    if (direction === "down") next.h += 1;
  }

  if (
    next.x < 0 ||
    next.y < 0 ||
    next.x + next.w > ANALYZE_DASHBOARD_COLUMNS ||
    next.y + next.h > ANALYZE_DASHBOARD_ROWS ||
    next.w < definition.minW ||
    next.w > definition.maxW ||
    next.h < definition.minH ||
    next.h > definition.maxH
  ) {
    return null;
  }

  const otherVisible = layout.filter(
    (candidate) => candidate.visible && candidate.i !== id,
  );
  if (otherVisible.some((candidate) => overlaps(next, candidate))) return null;

  return layout.map((candidate) =>
    candidate.i === id
      ? withDefinitionConstraints(
          id,
          { x: next.x, y: next.y, w: next.w, h: next.h },
          true,
        )
      : candidate,
  );
}

