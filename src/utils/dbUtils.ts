import { DB } from '@lib';
import { MathUtils } from '@utils';
import formatISO from 'date-fns/formatISO';

/**
 * Converts default DB date string to Date object
 * @param stringDate - Default DB string date
 * @returns {Date} A date object
 */
export const stringDateToDate = (stringDate: string) => {
  const dateUnits = stringDate.split('-').map(MathUtils.toInt);
  return new Date(dateUnits[0], dateUnits[1] - 1, dateUnits[2]);
};

export const dateToStringDate = (date: Date) => {
  return formatISO(date).split('T')[0];
};

export const filterByYear = (year: number) => (r: { date: string }) => {
  return year === stringDateToDate(r.date).getFullYear();
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

export const sortByDate = (a: Date, b: Date) => {
  return a.valueOf() - b.valueOf();
};

export const addPrefix = (prefix: string) => (fields: string[]) => {
  return fields.map((i) => ({ [`${prefix}-${i}`]: `${prefix}.${i}` }));
};

export const createTransaction = () => {
  return DB.transaction();
};
