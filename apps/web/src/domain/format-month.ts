const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format monthly display labels without changing ISO month keys or using time zones. */
export function formatMonth(month: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  return match ? `${monthNames[Number(match[2]) - 1]}-${match[1].slice(-2)}` : month;
}
