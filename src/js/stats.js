/*
 * Schedule-aware statistics. Pure functions (no page code), so they can be tested on their own.
 *
 * A habit looks like { days: [1, 3, 5], start: "2026-11-02", done: { "2026-11-02": true, ... } }
 *   days  = weekdays it is done on (Sunday = 0 ... Saturday = 6)
 *   start = first day it counts when no tracking day is set (the day it was added, or its earliest tick)
 *   done  = ticked days
 *
 * The user can also set one global "tracking day". Every habit then counts from that day, and the boxes before it are locked.
 * Only scheduled days are ever counted, so rest days never lower a score or break a streak.
 */
import { keyOf } from './config.js';

const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const nextDay = (d) => d.setDate(d.getDate() + 1);

/* First day a habit counts: the tracking day if one is set, otherwise the habit's own start. */
export const startOf = (h, trackStart) => trackStart || h.start;

/*
 * What a grid box should do:
 *   "open"   scheduled, tracked and not in the future  -> can be ticked
 *   "locked" before the tracking day                   -> disabled
 *   "future" after today                               -> disabled
 *   "rest"   not a scheduled weekday                   -> disabled
 *   "extra"  not scheduled but already ticked (old data or a changed schedule) -> enabled so it can be removed
 */
export function cellState(h, date, trackStart, today) {
  const key = keyOf(date);
  if (date > today) return 'future';
  if (trackStart && key < trackStart) return 'locked';
  if (!h.days.includes(date.getDay())) return h.done[key] ? 'extra' : 'rest';
  return 'open';
}

/*
 * Counts scheduled days from..to (inclusive) that are on or after startKey, and how many of them are ticked.
 * pendingKey (optional): a scheduled day that is not ticked yet is skipped, so "today" is never held against you.
 */
export function rangeStats(h, from, to, startKey, pendingKey) {
  let planned = 0, done = 0;
  for (const d = midnight(from); d <= to; nextDay(d)) {
    const key = keyOf(d);
    if (key < startKey || !h.days.includes(d.getDay())) continue;
    if (h.done[key]) { planned++; done++; }
    else if (key !== pendingKey) planned++;
  }
  return { planned, done };
}

/*
 * Current streak in days: from the first day of the unbroken run to the latest completed scheduled day.
 *  - a scheduled day that was missed ends the run;
 *  - rest days neither break nor start it, but count as days inside the run;
 *  - today being scheduled but not ticked yet does not end the run;
 *  - nothing before the habit's start (or the tracking day) counts.
 */
export function streakOf(h, trackStart, today) {
  const start = startOf(h, trackStart);
  const day = midnight(today);
  let latest = -1, earliest = -1;
  for (let i = 0; i < 3660; i++) {
    const key = keyOf(day);
    if (key < start) break;
    if (h.days.includes(day.getDay())) {
      if (h.done[key]) { if (latest < 0) latest = i; earliest = i; }
      else if (i > 0) break;
    }
    day.setDate(day.getDate() - 1);
  }
  return latest < 0 ? 0 : earliest - latest + 1;
}