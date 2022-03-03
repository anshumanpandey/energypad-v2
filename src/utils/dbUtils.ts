const toInt = (i: string) => parseInt(i, 10);

/**
 * Converts default DB date string to Date object
 * @param stringDate - Default DB string date
 * @returns {Date} A date object
 */
export const stringDateToDate = (stringDate: string) => {
  const dateUnits = stringDate.split('-').map(toInt);
  return new Date(dateUnits[0], dateUnits[1] - 1, dateUnits[2]);
};

/**
 * Sort array of objects with a date property
 * where the date property is the default DB date string
 * eg: `{ date: "2020-01-01" }`
 * @param {Object} a.date - Default DB string date
 * @param {Object} b.date - Default DB string date
 * @returns {number} Result of `a.date.valueOf()` minus `b.date.valueOf()`
 */
export const sortByStringDate = (a: { date: string }, b: { date: string }) => {
  const startDate = stringDateToDate(a.date);
  const endDate = stringDateToDate(b.date);
  return startDate.valueOf() - endDate.valueOf();
};
