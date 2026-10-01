export function displayDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}${match[4] ? ' ' + match[4] : ''}` : '';
}
export function parseDateInput(text: string, withTime = false): string | null {
  if (!text) return '';
  const match = (withTime ? /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/ : /^(\d{2})\/(\d{2})\/(\d{4})$/).exec(text);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(iso + 'T00:00:00Z');
  if (Number(year) < 1 || !Number.isFinite(+date) || date.toISOString().slice(0, 10) !== iso) return null;
  if (withTime && (Number(hour) > 23 || Number(minute) > 59)) return null;
  return iso + (withTime ? `T${hour}:${minute}` : '');
}
