/**
 * Pure time-math for the calendar day view: converts a list of appointments
 * (start/end times) into absolute-positioning geometry (top/height) plus
 * overlap-cluster/cascade info (offsetX/zIndex). No React, no DOM — safe to
 * unit test in isolation if a test runner is ever added to this repo.
 */

export const DAY_VIEW_START_HOUR = 8;
export const DAY_VIEW_END_HOUR = 20; // grid spans [08:00, 20:00) → 12h
export const PX_PER_MINUTE = 1; // 60px per hour
export const MIN_BLOCK_HEIGHT_PX = 28;
export const LANE_OFFSET_PX = 12; // desktop cascade step
export const LANE_OFFSET_PX_MOBILE = 20; // wider step on mobile for touch target
export const FOCUS_Z_INDEX = 1000;

export interface DayViewLayoutInput {
  id: string;
  // Prisma `DateTime` fields become ISO strings once they cross the
  // server/client boundary via JSON.parse(JSON.stringify(...)) — accept both
  // so this function is safe regardless of where its input came from.
  startTime: Date | string;
  endTime: Date | string;
}

export interface DayViewBlockLayout {
  id: string;
  /** px offset from the top of the grid (start of startHour) */
  top: number;
  /** px height of the block, floored at minBlockHeightPx */
  height: number;
  /** px lateral offset from the column's right edge, for cascade stacking */
  offsetX: number;
  /** stacking order — later-starting appointments in a cluster get a higher value */
  zIndex: number;
  /** 0-based position within its overlap cluster, ascending by start time */
  clusterIndex: number;
  /** total number of appointments in this overlap cluster */
  clusterSize: number;
  /** true if the appointment starts before the visible grid window */
  clippedTop: boolean;
  /** true if the appointment ends after the visible grid window */
  clippedBottom: boolean;
}

export interface DayViewLayoutOptions {
  startHour?: number;
  endHour?: number;
  pxPerMinute?: number;
  minBlockHeightPx?: number;
  laneOffsetPx?: number;
  zIndexBase?: number;
}

interface TimedItem<T extends DayViewLayoutInput> {
  input: T;
  startMin: number;
  endMin: number;
}

export function computeDayViewLayout<T extends DayViewLayoutInput>(
  appointments: T[],
  options: DayViewLayoutOptions = {}
): DayViewBlockLayout[] {
  const startHour = options.startHour ?? DAY_VIEW_START_HOUR;
  const endHour = options.endHour ?? DAY_VIEW_END_HOUR;
  const pxPerMinute = options.pxPerMinute ?? PX_PER_MINUTE;
  const minBlockHeightPx = options.minBlockHeightPx ?? MIN_BLOCK_HEIGHT_PX;
  const laneOffsetPx = options.laneOffsetPx ?? LANE_OFFSET_PX;
  const zIndexBase = options.zIndexBase ?? 10;

  const gridStartMin = 0;
  const gridEndMin = (endHour - startHour) * 60;
  const dayStartMs = startHour * 60 * 60 * 1000;

  const minutesSinceGridStart = (d: Date | string) => {
    const date = d instanceof Date ? d : new Date(d);
    const localMidnight = new Date(date);
    localMidnight.setHours(0, 0, 0, 0);
    return (date.getTime() - localMidnight.getTime() - dayStartMs) / 60000;
  };

  // 1. Clamp into the visible window, drop anything with zero overlap with it.
  const items: TimedItem<T>[] = [];
  for (const a of appointments) {
    const rawStart = minutesSinceGridStart(a.startTime);
    const rawEnd = minutesSinceGridStart(a.endTime);
    if (rawEnd <= gridStartMin || rawStart >= gridEndMin) continue;
    items.push({
      input: a,
      startMin: Math.max(rawStart, gridStartMin),
      endMin: Math.min(rawEnd, gridEndMin),
    });
  }

  // 2. Sort ascending by start, then end, then id for determinism.
  items.sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    if (a.endMin !== b.endMin) return a.endMin - b.endMin;
    return a.input.id.localeCompare(b.input.id);
  });

  // 3. Sweep-line clustering: group items whose [start,end) intervals form a
  // connected overlap chain (A-B overlap, B-C overlap ⇒ same cluster even if
  // A-C don't directly overlap).
  const clusters: TimedItem<T>[][] = [];
  let currentCluster: TimedItem<T>[] = [];
  let clusterEnd = -Infinity;
  for (const item of items) {
    if (currentCluster.length === 0 || item.startMin < clusterEnd) {
      currentCluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMin);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterEnd = item.endMin;
    }
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);

  // 4. Assign geometry per item.
  const result: DayViewBlockLayout[] = [];
  for (const cluster of clusters) {
    const clusterSize = cluster.length;
    cluster.forEach((item, clusterIndex) => {
      const rawHeight = (item.endMin - item.startMin) * pxPerMinute;
      const originalStart = minutesSinceGridStart(item.input.startTime);
      const originalEnd = minutesSinceGridStart(item.input.endTime);
      result.push({
        id: item.input.id,
        top: item.startMin * pxPerMinute,
        height: Math.max(rawHeight, minBlockHeightPx),
        offsetX: clusterIndex * laneOffsetPx,
        zIndex: zIndexBase + clusterIndex,
        clusterIndex,
        clusterSize,
        clippedTop: originalStart < gridStartMin,
        clippedBottom: originalEnd > gridEndMin,
      });
    });
  }

  return result;
}
