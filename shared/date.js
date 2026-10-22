// Only real calendar dates may reach date grouping or chart rendering.
export function isISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function weekStart(value) {
  if (!isISODate(value)) return '';
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}

// Explicit Vietnam calendar boundaries; date-only sheet values already represent local dates.
export function vietnamDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Ho_Chi_Minh', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(date);
  const get = type => parts.find(part=>part.type===type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
