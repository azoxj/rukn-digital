// Local-day helpers. Timestamps are stored as UTC ISO strings; "today" and
// daily buckets use the organisation's offset (TZ_OFFSET_MINUTES, default
// +180 = Asia/Riyadh, which has no daylight saving).
export const tzOffsetMin = () => {
  const n = Number(process.env.TZ_OFFSET_MINUTES ?? 180);
  return Number.isFinite(n) && Math.abs(n) <= 14 * 60 ? Math.trunc(n) : 180;
};

/** Local calendar date (YYYY-MM-DD) for a Date. */
export const localDate = (d = new Date(), off = tzOffsetMin()) => new Date(d.getTime() + off * 60000).toISOString().slice(0, 10);
export const localToday = () => localDate();

/** UTC ISO instant of local midnight for `day` (+ addDays). */
export function localDayStartIso(day, addDays = 0, off = tzOffsetMin()) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + addDays) - off * 60000).toISOString();
}

export function shiftDay(day, n) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** SQL expression giving the local day of an ISO column. */
export const localDay = (col, off = tzOffsetMin()) => `substr(datetime(${col}, '${off >= 0 ? "+" : ""}${off} minutes'), 1, 10)`;
