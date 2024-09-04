import { DB } from '@lib';
import { MathUtils } from '@utils';
import formatISO from 'date-fns/formatISO';
import subMonths from 'date-fns/subMonths';

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

export const filterByYear = (year: number) => (r: { date: string | Date }) => {
  const d = typeof r.date === 'string' ? r.date : dateToStringDate(r.date);
  return year === stringDateToDate(d).getFullYear();
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

/**
 * Pass 1 for january
 * 12 for december
 */
export const filterByMonth = (month: number) => (i: { date: string }) => {
  return Number(i.date.split('-')[1]) === month;
};

export const filterByYearAndMonth = (p: { date: string | Date }) => (record: { date: string | Date }) => {
  const d = typeof p.date === 'string' ? p.date : dateToStringDate(p.date);
  const itemDate = typeof record.date === 'string' ? record.date : dateToStringDate(record.date);
  const [year, month] = d.split('-').map(Number);
  return filterByYear(year)(record) && filterByMonth(month)({ date: itemDate });
};

export const numberToMonth = (n: number) => {
  return n <= 9 ? `0${n}` : n;
};

export const increaseYear = (p: { date: string }, amount: number) => {
  const [year, month] = p.date.split('-').map(Number);
  return `${year + amount}-${numberToMonth(month)}-01`;
};

export const decreaseYear = (p: { date: string }, amount: number) => {
  const [year, month] = p.date.split('-').map(Number);
  return `${year - amount}-${numberToMonth(month)}-01`;
};

export const decreaseMonth = (p: { date: string }, amount: number) => {
  const [year, month] = p.date.split('-').map(Number);
  const date = new Date(year, month, 1);
  return subMonths(date, amount + 1)
    .toISOString()
    .split('T')[0];
};
export const createTransaction = () => {
  return DB.transaction();
};
