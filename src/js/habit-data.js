/* Habit data: creation, validation, repair of saved data and the tracking day. No page code, so it can be tested alone. */
import {
  COLORS, DATE_RE, DEFAULT_DAYS, HEX_RE, ID_RE, NAME_MAX, STORAGE_KEY, TRACK_KEY, WEEK_ORDER,
  isRealDate, keyOf, lsGet, parseKey, readJSON, uid
} from './config.js';

const isPlainObject = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

/* Weekdays: 1 to 7 different numbers from 0 (Sunday) to 6 (Saturday) */
export const validDays = (d) => Array.isArray(d) && d.length >= 1 && d.length <= 7 &&
  d.every((n) => WEEK_ORDER.includes(n)) && new Set(d).size === d.length;
export const sortDays = (d) => [...d].sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b));
const normGoal = (g) => (Number.isInteger(g) && g >= 1 && g <= 7 ? g : 7);

/*
 * Old habits only had a "times a week" number. Pick the weekdays the person really used most
 * (ties and empty slots fall back to the usual pattern for that number), so their history still lines up.
 */
export function inferDays(done, goal) {
  const counts = new Map();
  for (const k of Object.keys(done)) {
    if (!DATE_RE.test(k)) continue;
    const wd = parseKey(k).getDay();
    counts.set(wd, (counts.get(wd) || 0) + 1);
  }
  const used = WEEK_ORDER.filter((d) => counts.get(d))
    .sort((a, b) => counts.get(b) - counts.get(a) || WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b));
  const picked = used.slice(0, goal);
  for (const d of [...DEFAULT_DAYS[goal], ...WEEK_ORDER]) {
    if (picked.length >= goal) break;
    if (!picked.includes(d)) picked.push(d);
  }
  return sortDays(picked);
}

/*
 * Moves a weekday selection to exactly n days when the person changes "Frequency":
 *  - going up: keep their days and add the usual ones until there are n;
 *  - going down: use the usual spread for n (e.g. Mon/Wed/Fri for 3) if their days include it, otherwise keep the first n.
 */
export function fitDays(current, n) {
  const days = sortDays(current);
  if (days.length === n) return days;
  if (days.length > n) {
    const usual = DEFAULT_DAYS[n];
    return usual.every((d) => days.includes(d)) ? sortDays(usual) : days.slice(0, n);
  }
  for (const d of [...DEFAULT_DAYS[n], ...WEEK_ORDER]) {
    if (days.length >= n) break;
    if (!days.includes(d)) days.push(d);
  }
  return sortDays(days);
}

export const makeHabit = (name, color, days) => {
  const sorted = sortDays(days);
  return { id: uid(), name, color, goal: sorted.length, days: sorted, start: keyOf(new Date()), done: {} };
};
export const defaultHabits = () => ['Habit 1', 'Habit 2', 'Habit 3'].map((name, i) => makeHabit(name, COLORS[i], WEEK_ORDER));

export const isHabit = (h) => isPlainObject(h) && typeof h.id === 'string' && ID_RE.test(h.id) && typeof h.name === 'string' &&
  typeof h.color === 'string' && HEX_RE.test(h.color) && typeof h.start === 'string' && DATE_RE.test(h.start) &&
  validDays(h.days) && sortDays(h.days).every((d, i) => d === h.days[i]) && h.goal === h.days.length &&
  isPlainObject(h.done) && Object.keys(h.done).every((k) => DATE_RE.test(k));
export const isHabits = (d) => Array.isArray(d) && d.every(isHabit) && new Set(d.map((h) => h.id)).size === d.length;

/* Rebuilds one stored habit: keeps every ticked day and replaces only what is broken, unsafe or missing */
function cleanHabit(h, i, ids) {
  if (!isPlainObject(h)) return null;
  const done = {};
  if (isPlainObject(h.done)) for (const k of Object.keys(h.done)) if (DATE_RE.test(k) && h.done[k]) done[k] = true;
  const first = Object.keys(done).sort()[0];
  let start = typeof h.start === 'string' && DATE_RE.test(h.start) ? h.start : (first || keyOf(new Date()));
  if (first && first < start) start = first;
  let id = typeof h.id === 'string' && ID_RE.test(h.id) ? h.id : uid();
  while (ids.has(id)) id = uid();
  ids.add(id);
  const name = typeof h.name === 'string' ? h.name.trim().slice(0, NAME_MAX).trim() : '';
  const days = validDays(h.days) ? sortDays(h.days) : inferDays(done, normGoal(h.goal));
  return {
    id,
    name: name || `Habit ${i + 1}`,
    color: typeof h.color === 'string' && HEX_RE.test(h.color) ? h.color : COLORS[i % COLORS.length],
    goal: days.length,
    days,
    start,
    done
  };
}

/* Returns the cleaned list, or null when nothing is recoverable (the caller then falls back to defaults) */
export const repairHabits = (data) => {
  if (!Array.isArray(data)) return null;
  const ids = new Set();
  const cleaned = data.map((h, i) => cleanHabit(h, i, ids)).filter(Boolean);
  return cleaned.length ? cleaned : null;
};

export const loadHabits = () => readJSON(STORAGE_KEY, isHabits, defaultHabits, repairHabits);

/* The "tracking day" is one date for everything. null means it hasn't been set. */
export const loadTrackStart = () => {
  const v = lsGet(TRACK_KEY);
  return isRealDate(v) ? v : null;
};